const dmService = require('../services/dmService');
const catchAsync = require('../utils/catchAsync');
const ApiResponse = require('../utils/ApiResponse');

const getOrCreateDM = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const dm = await dmService.getOrCreateDM(req.user._id, userId);
  res.status(200).json(new ApiResponse(200, { dm }));
});

const getMessages = catchAsync(async (req, res) => {
  const { dmId } = req.params;
  const { beforeId = null, limit = 40 } = req.query;
  
  const parsedLimit = parseInt(limit, 10);
  const result = await dmService.getMessages(dmId, req.user._id, beforeId, parsedLimit);
  
  res.status(200).json(new ApiResponse(200, result));
});

const sendMessage = catchAsync(async (req, res) => {
  const { dmId } = req.params;
  const { content, type = 'text', replyTo = null } = req.body;
  
  const message = await dmService.sendMessage(dmId, req.user._id, content, type, replyTo);
  res.status(201).json(new ApiResponse(201, { message }));
});

module.exports = { getOrCreateDM, getMessages, sendMessage };
