const express = require('express');
const crypto = require('crypto');
const cloudinary = require('../config/cloudinary');
const Media = require('../models/Media');
const { attachStructuredMetadata, deriveCategory } = require('../services/metadata');

const router = express.Router();

/**
 * Verify Cloudinary webhook signature.
 * https://cloudinary.com/documentation/notifications#verifying_notification_signatures
 */
function verifySignature(rawBody, timestamp, signature) {
  const expected = crypto
    .createHash('sha1')
    .update(rawBody + timestamp + process.env.CLOUDINARY_API_SECRET)
    .digest('hex');
  return expected === signature;
}

// POST /api/webhook
// Use express.raw here so we can verify the exact byte payload Cloudinary signed.
router.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  const signature = req.headers['x-cld-signature'];
  const timestamp = req.headers['x-cld-timestamp'];
  const rawBody = req.body.toString('utf8');

  if (process.env.NODE_ENV === 'production') {
    const valid = verifySignature(rawBody, timestamp, signature);
    if (!valid) {
      console.warn('Invalid Cloudinary webhook signature');
      return res.sendStatus(401);
    }
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { public_id, tags, moderation, info, notification_type } = payload;

  try {
    if (notification_type === 'moderation' || moderation) {
      const moderationStatus = moderation?.[0]?.status || 'pending';
      const category = deriveCategory(info);
      const dominantColor = info?.colors?.data?.[0]?.[0] || info?.colors?.[0]?.[0] || 'unknown';
      const subjectCount = info?.detection?.coco_v2?.data?.length || 0;

      const update = {
        tags: tags || [],
        moderationStatus,
        moderationDetails: moderation,
        aiCategories: info?.categorization,
        detectedObjects: info?.detection?.coco_v2?.data || [],
        colors: info?.colors?.data || info?.colors || [],
        category,
        dominantColor,
        subjectCount
      };

      await Media.findOneAndUpdate({ publicId: public_id }, update, { upsert: true });

      // Sync AI-derived context back onto the Cloudinary asset for Search API queries
      await attachStructuredMetadata(public_id, {
        category,
        subjectCount,
        moderationStatus,
        dominantColor
      });

      // Auto-quarantine rejected content
      if (moderationStatus === 'rejected') {
        await cloudinary.uploader.add_context({ moderation_status: 'rejected' }, [public_id]);
        // Optionally auto-delete instead:
        // await cloudinary.uploader.destroy(public_id);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.sendStatus(500);
  }
});

module.exports = router;
