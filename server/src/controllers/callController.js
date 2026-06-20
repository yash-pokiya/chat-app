const DM = require('../../models/DM');
const Message = require('../../models/Message');
const catchAsync = require('../utils/catchAsync');
const ApiResponse = require('../utils/ApiResponse');

const getCallHistory = catchAsync(async (req, res) => {
  const userId = req.user._id;

  // Optimized query projecting only participants
  const dms = await DM.find({ participants: userId })
    .populate('participants', 'username displayName avatar')
    .select('participants')
    .lean();

  const dmIds = dms.map(dm => dm._id);

  // Retrieve matching call_log entries
  const callLogs = await Message.find({
    dmId: { $in: dmIds },
    type: 'call_log',
  })
    .sort({ _id: -1 })
    .limit(100)
    .lean();

  // Create lookup dictionary of DM ID -> partner info
  const dmPartnerMap = {};
  for (const dm of dms) {
    const partner = dm.participants.find(p => p._id.toString() !== userId.toString());
    if (partner) {
      dmPartnerMap[dm._id.toString()] = {
        _id: partner._id,
        username: partner.username,
        displayName: partner.displayName,
        avatar: partner.avatar,
      };
    }
  }

  // Map partner profile data to Call Logs
  const enriched = callLogs.map(log => ({
    ...log,
    partner: dmPartnerMap[log.dmId?.toString()] || null,
  }));

  res.status(200).json(new ApiResponse(200, { calls: enriched }));
});

module.exports = { getCallHistory };
