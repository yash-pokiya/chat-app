import { Phone, Video, PhoneIncoming, PhoneMissed, PhoneOff } from 'lucide-react';

const statusConfig = {
  completed:  { icon: Phone,          label: 'Call',           color: 'text-green-500' },
  missed:     { icon: PhoneMissed,    label: 'Missed Call',    color: 'text-red-400' },
  declined:   { icon: PhoneOff,       label: 'Declined',       color: 'text-gray-400' },
  no_answer:  { icon: PhoneIncoming,  label: 'No Answer',      color: 'text-orange-400' },
};

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function CallLogBubble({ message }) {
  const { callData } = message;
  if (!callData) return null;

  const config = statusConfig[callData.status] || statusConfig.completed;
  const Icon = config.icon;
  const isVideo = callData.callType === 'video';
  const CallTypeIcon = isVideo ? Video : Phone;
  const durationStr = formatDuration(callData.duration);

  return (
    <div className="flex justify-center my-3">
      <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-violet-50 border border-violet-100 shadow-sm max-w-xs">
        {/* Call type icon */}
        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
          callData.status === 'completed' 
            ? 'bg-gradient-to-br from-violet-500 to-cyan-400' 
            : 'bg-gray-100'
        }`}>
          <CallTypeIcon size={16} className={callData.status === 'completed' ? 'text-white' : config.color} />
        </div>

        {/* Info */}
        <div className="flex flex-col">
          <span className={`text-sm font-semibold ${
            callData.status === 'completed' ? 'text-gray-800' : config.color
          }`}>
            {isVideo ? 'Video' : 'Audio'} {config.label}
          </span>
          <span className="text-xs text-gray-400">
            {durationStr && <span className="font-medium text-gray-500">{durationStr} · </span>}
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
}
