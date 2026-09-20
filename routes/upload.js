const express = require('express');
const multer = require('multer');
const fs = require('fs');
const cloudinary = require('../config/cloudinary');
const Media = require('../models/Media');
const { buildDeliveryBundle } = require('../services/transform');

const router = express.Router();
const path = require('path');
const upload = multer({ dest: path.join(__dirname, '../tmp/'), limits: { fileSize: 100 * 1024 * 1024 } });
const addOnEnabled = (name) => process.env[name]?.trim().toLowerCase() === 'true';

// POST /api/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided (field name: "file")' });
  }

  const userId = req.body.userId || 'anonymous';

  try {
    // Keep add-ons opt-in: Cloudinary returns a 420 error when a requested
    // add-on is not included in the current account subscription.
    const uploadOptions = {
      resource_type: 'auto',
      folder: `users/${userId}`,
      colors: true,
      image_metadata: true,
      public_id: `${userId}_${Date.now()}`,
      overwrite: false
    };

    if (process.env.CLOUDINARY_WEBHOOK_URL) {
      uploadOptions.notification_url = process.env.CLOUDINARY_WEBHOOK_URL;
    }
    if (addOnEnabled('CLOUDINARY_ENABLE_TAGGING')) {
      uploadOptions.categorization = 'google_tagging,imagga_tagging';
      uploadOptions.auto_tagging = 0.6;
    }
    if (addOnEnabled('CLOUDINARY_ENABLE_OBJECT_DETECTION')) {
      uploadOptions.detection = 'coco_v2';
    }
    if (addOnEnabled('CLOUDINARY_ENABLE_MODERATION')) {
      uploadOptions.moderation = 'aws_rek';
    }

    const result = await cloudinary.uploader.upload(req.file.path, uploadOptions);

    // Persist an initial record; webhook will enrich it once AI/moderation finishes
    const media = await Media.create({
      publicId: result.public_id,
      userId,
      resourceType: result.resource_type,
      format: result.format,
      url: result.url,
      secureUrl: result.secure_url,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      tags: result.tags || [],
      moderationStatus: addOnEnabled('CLOUDINARY_ENABLE_MODERATION') ? 'pending' : 'approved',
      raw: result
    });

    fs.unlink(req.file.path, (err) => { if (err) console.error('Cleanup error:', err); });

    res.status(201).json({
      status: 'processing',
      media,
      delivery: buildDeliveryBundle(result.public_id, result.resource_type)
    });
  } catch (err) {
    console.error('Upload error:', err);
    fs.unlink(req.file.path, (err) => { if (err) console.error('Cleanup error:', err); });
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});

// GET /api/media/:publicId
router.get('/media/:publicId(*)', async (req, res) => {
  const media = await Media.findOne({ publicId: req.params.publicId });
  if (!media) return res.status(404).json({ error: 'Not found' });
  res.json({ media, delivery: buildDeliveryBundle(media.publicId, media.resourceType) });
});

// GET /api/media (list, paginated)
router.get('/media', async (req, res) => {
  const { userId, page = 1, limit = 20 } = req.query;
  const filter = userId ? { userId } : {};

  const items = await Media.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({ items, page: Number(page), limit: Number(limit) });
});

// DELETE /api/media/:publicId
router.delete('/media/:publicId(*)', async (req, res) => {
  const { publicId } = req.params;
  await cloudinary.uploader.destroy(publicId, { resource_type: req.query.resourceType || 'image' });
  await Media.deleteOne({ publicId });
  res.json({ status: 'deleted', publicId });
});

module.exports = router;
