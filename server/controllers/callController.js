const DM = require('../models/DM');
const Message = require('../models/Message');

// GET /api/calls/history
const getCallHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all DMs the user participates in
    const dms = await DM.find({ participants: userId })
      .populate('participants', 'username displayName avatar');

    const dmIds = dms.map(dm => dm._id);

    // Find all call_log messages in those DMs
    const callLogs = await Message.find({
      dmId: { $in: dmIds },
      type: 'call_log',
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Build a map of dmId -> partner info
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

    // Enrich call logs with partner info
    const enriched = callLogs.map(log => ({
      ...log,
      partner: dmPartnerMap[log.dmId?.toString()] || null,
    }));

    res.json({ success: true, calls: enriched });
  } catch (err) {
    console.error('[CallController] getCallHistory error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getCallHistory };
