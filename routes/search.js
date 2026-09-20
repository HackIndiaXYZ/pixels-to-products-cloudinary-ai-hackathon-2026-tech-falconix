const express = require('express');
const cloudinary = require('../config/cloudinary');
const { buildDeliveryBundle } = require('../services/transform');

const router = express.Router();

// GET /api/search?query=&tag=&category=&minWidth=&approvedOnly=true
router.get('/search', async (req, res) => {
  const { query, tag, category, minWidth, approvedOnly = 'true', maxResults = 30 } = req.query;

  let expression = 'resource_type:image';

  if (approvedOnly === 'true') {
    expression += ' AND context.moderation_status=approved';
  }
  if (tag) expression += ` AND tags=${tag}`;
  if (category) expression += ` AND context.category=${category}`;
  if (minWidth) expression += ` AND width>=${minWidth}`;
  if (query) expression += ` AND (${query})`;

  try {
    const result = await cloudinary.search
      .expression(expression)
      .sort_by('created_at', 'desc')
      .with_field('context')
      .with_field('tags')
      .max_results(Number(maxResults))
      .execute();

    const resources = result.resources.map((r) => ({
      ...r,
      delivery: buildDeliveryBundle(r.public_id, r.resource_type)
    }));

    res.json({ total: result.total_count, resources });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed', details: err.message });
  }
});

module.exports = router;
