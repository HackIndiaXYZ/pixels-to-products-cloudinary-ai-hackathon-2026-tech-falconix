const cloudinary = require('../config/cloudinary');

/**
 * Write AI-derived structured metadata back onto the Cloudinary asset
 * as "context" so it becomes searchable via the Search API.
 */
async function attachStructuredMetadata(publicId, data) {
  const context = {
    category: data.category || 'uncategorized',
    subject_count: String(data.subjectCount ?? 0),
    moderation_status: data.moderationStatus || 'pending',
    dominant_color: data.dominantColor || 'unknown',
    processed_at: new Date().toISOString()
  };

  await cloudinary.uploader.add_context(context, [publicId]);
  return context;
}

/**
 * Derive a simple top-level category from AI categorization/detection results.
 */
function deriveCategory(info) {
  const googleTags = info?.categorization?.google_tagging?.data;
  const imaggaTags = info?.categorization?.imagga_tagging?.data;

  const top = (googleTags && googleTags[0]) || (imaggaTags && imaggaTags[0]);
  return top ? top.tag : 'general';
}

module.exports = { attachStructuredMetadata, deriveCategory };
