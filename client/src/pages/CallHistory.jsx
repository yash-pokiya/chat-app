import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Phone, Video, PhoneMissed, PhoneOff, PhoneIncoming } from 'lucide-react';
import { useCall } from '../context/CallContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

const statusConfig = {
  completed:  { icon: Phone,          label: 'Call',         color: 'text-green-500',  bg: 'bg-green-50' },
  missed:     { icon: PhoneMissed,    label: 'Missed',       color: 'text-red-400',    bg: 'bg-red-50' },
  declined:   { icon: PhoneOff,       label: 'Declined',     color: 'text-gray-400',   bg: 'bg-gray-50' },
  no_answer:  { icon: PhoneIncoming,  label: 'No Answer',    color: 'text-orange-400', bg: 'bg-orange-50' },
};

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Avatar({ user, size = 11 }) {
  const cls = `w-${size} h-${size} rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0`;
  if (user?.avatar) return <img src={user.avatar} className={`${cls} object-cover rounded-xl`} alt={user.displayName} />;
  return (
    <div className={`${cls} bg-gradient-to-br from-violet-500 to-cyan-400 text-sm`}>
      {(user?.displayName || user?.username || '?')[0].toUpperCase()}
    </div>
  );
}

export default function CallHistory() {
  const navigate = useNavigate();
  const { initiateCall } = useCall();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCalls = async () => {
      try {
        const { data } = await api.get('/calls/history');
        if (data.success) setCalls(data.calls);
      } catch (err) {
        toast.error('Failed to load call history');
      } finally {
        setLoading(false);
      }
    };
    fetchCalls();
  }, []);

  // Group calls by date
  const grouped = calls.reduce((acc, call) => {
    const dateKey = formatDate(call.createdAt);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(call);
    return acc;
  }, {});

  const handleCallback = (call, callType) => {
    if (!call.partner) return;
    initiateCall({
      _id: call.partner._id,
      username: call.partner.username,
      displayName: call.partner.displayName || call.partner.username,
      avatar: call.partner.avatar,
    }, callType);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="h-[100dvh] flex flex-col bg-gray-50"
    >
      {/* Top bar */}
      <div className="frosted-bar px-4 py-4 flex items-center gap-3 z-10 flex-shrink-0">
        <button onClick={() => navigate('/')} className="p-2 rounded-xl hover:bg-gray-100 text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Call History</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-violet-50 flex items-center justify-center mb-4">
              <Phone size={24} className="text-violet-400" />
            </div>
            <p className="text-gray-400 font-medium text-sm">No calls yet</p>
            <p className="text-gray-300 text-xs mt-1">Your call history will appear here</p>
          </div>
        ) : (
          Object.entries(grouped).map(([dateKey, dateCalls]) => (
            <div key={dateKey} className="mb-6">
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3 mt-2">
                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">{dateKey}</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Call rows */}
              <div className="space-y-1">
                {dateCalls.map((call) => {
                  const config = statusConfig[call.callData?.status] || statusConfig.completed;
                  const StatusIcon = config.icon;
                  const isVideo = call.callData?.callType === 'video';
                  const durationStr = formatDuration(call.callData?.duration);

                  return (
                    <motion.div
                      key={call._id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 p-3 bg-white rounded-2xl hover:shadow-sm transition-all group"
                    >
                      {/* Avatar */}
                      <Avatar user={call.partner} />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {call.partner?.displayName || call.partner?.username || 'Unknown'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <StatusIcon size={12} className={config.color} />
                          <span className={`text-xs ${config.color} font-medium`}>
                            {isVideo ? 'Video' : 'Audio'} {config.label}
                          </span>
                          {durationStr && (
                            <span className="text-xs text-gray-300"> · {durationStr}</span>
                          )}
                        </div>
                      </div>

                      {/* Time */}
                      <span className="text-xs text-gray-300 font-medium flex-shrink-0">
                        {new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      {/* Callback buttons */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCallback(call, 'audio')}
                          className="p-2 rounded-xl hover:bg-green-50 text-gray-400 hover:text-green-500 transition-colors"
                          title="Audio call"
                        >
                          <Phone size={16} />
                        </button>
                        <button
                          onClick={() => handleCallback(call, 'video')}
                          className="p-2 rounded-xl hover:bg-violet-50 text-gray-400 hover:text-violet-500 transition-colors"
                          title="Video call"
                        >
                          <Video size={16} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
