const roomService = require('../services/roomService');
const catchAsync = require('../utils/catchAsync');
const ApiResponse = require('../utils/ApiResponse');

const joinRoom = catchAsync(async (req, res) => {
  const { code } = req.body;
  const result = await roomService.joinRoom(code, req.user._id);
  res.status(200).json(new ApiResponse(200, { room: result }));
});

const getRoom = catchAsync(async (req, res) => {
  const { code } = req.params;
  const result = await roomService.getRoom(code, req.user._id);
  res.status(200).json(new ApiResponse(200, { room: result }));
});

const leaveRoom = catchAsync(async (req, res) => {
  const { roomId } = req.body;
  const result = await roomService.leaveRoom(roomId, req.user._id);
  res.status(200).json(new ApiResponse(200, result));
});

module.exports = { joinRoom, getRoom, leaveRoom };
