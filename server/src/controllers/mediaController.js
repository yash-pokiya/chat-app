const mediaService = require('../services/mediaService');
const catchAsync = require('../utils/catchAsync');
const ApiResponse = require('../utils/ApiResponse');

const uploadMedia = catchAsync(async (req, res) => {
  const { roomId, dmId } = req.body;
  const result = await mediaService.uploadImage(req.file, req.user, roomId, dmId);
  res.status(201).json(new ApiResponse(201, {
    url: result.url,
    publicId: result.publicId,
    cloudinaryId: result.publicId,
    mediaId: result.mediaId
  }));
});

const uploadVoice = catchAsync(async (req, res) => {
  const { roomId, dmId, duration } = req.body;
  const result = await mediaService.uploadVoiceNote(req.file, req.user, roomId, dmId, duration);
  res.status(201).json(new ApiResponse(201, {
    url: result.url,
    publicId: result.publicId,
    cloudinaryId: result.publicId,
    mediaId: result.mediaId
  }));
});

module.exports = { uploadMedia, uploadVoice };
