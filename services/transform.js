const cloudinary = require('../config/cloudinary');

/**
 * Content-aware crop for thumbnails using AI-detected focal point.
 */
function smartCropUrl(publicId, width, height) {
  return cloudinary.url(publicId, {
    width,
    height,
    crop: 'auto',
    gravity: 'auto',
    fetch_format: 'auto',
    quality: 'auto'
  });
}

/**
 * Background removal — requires the Cloudinary AI Background Removal add-on.
 */
function removeBackgroundUrl(publicId) {
  return cloudinary.url(publicId, {
    effect: 'background_removal',
    fetch_format: 'png'
  });
}

/**
 * Responsive, network-aware delivery URL.
 */
function responsiveUrl(publicId, width) {
  return cloudinary.url(publicId, {
    width,
    crop: 'scale',
    fetch_format: 'auto',
    quality: 'auto',
    dpr: 'auto'
  });
}

/**
 * Optimized video delivery (adaptive bitrate friendly).
 */
function optimizedVideoUrl(publicId, width) {
  return cloudinary.url(publicId, {
    resource_type: 'video',
    width,
    crop: 'scale',
    fetch_format: 'auto',
    quality: 'auto',
    video_codec: 'auto'
  });
}

/**
 * Generate a full delivery bundle for a media item (thumbnail, responsive, original-optimized).
 */
function buildDeliveryBundle(publicId, resourceType = 'image') {
  if (resourceType === 'video') {
    return {
      thumbnail: cloudinary.url(publicId, {
        resource_type: 'video',
        width: 400,
        height: 300,
        crop: 'fill',
        gravity: 'auto',
        format: 'jpg'
      }),
      optimized: optimizedVideoUrl(publicId, 1280)
    };
  }

  return {
    thumbnail: smartCropUrl(publicId, 400, 300),
    responsiveSmall: responsiveUrl(publicId, 480),
    responsiveMedium: responsiveUrl(publicId, 1024),
    responsiveLarge: responsiveUrl(publicId, 1920),
    backgroundRemoved: removeBackgroundUrl(publicId)
  };
}

module.exports = {
  smartCropUrl,
  removeBackgroundUrl,
  responsiveUrl,
  optimizedVideoUrl,
  buildDeliveryBundle
};
