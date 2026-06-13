import { motion, AnimatePresence } from 'framer-motion';
import { PhoneOff, Video, Phone } from 'lucide-react';

export default function IncomingCall({ caller, callType = 'video', onAccept, onReject }) {
  if (!caller) return null;

  const avatar = caller.avatar
    ? <img src={caller.avatar} className="w-20 h-20 rounded-full mx-auto mb-3 object-cover ring-4 ring-emerald-400 animate-pulse" alt={caller.displayName} />
    : (
      <div className="w-20 h-20 rounded-full mx-auto mb-3 bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-white font-bold text-3xl ring-4 ring-emerald-400 animate-pulse">
        {(caller.displayName || caller.username || '?')[0].toUpperCase()}
      </div>
    );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]"
      >
        {/* Ripple rings */}
        <div className="absolute pointer-events-none">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="absolute rounded-full border-2 border-emerald-400/30"
              style={{
                width: 160 + i * 60,
                height: 160 + i * 60,
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                animation: `pulseRing ${1.2 + i * 0.3}s ease-out infinite`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', damping: 20 }}
          className="bg-white rounded-3xl p-8 text-center shadow-2xl w-80 relative z-10"
        >
          {avatar}

          <p className="font-bold text-lg text-gray-900">{caller.displayName || caller.username}</p>
          <p className="text-gray-400 text-sm mb-2">@{caller.username}</p>
          <p className="text-gray-500 text-sm mb-8 flex items-center justify-center gap-2">
            {callType === 'video' ? <Video size={14} className="text-violet-500" /> : <Phone size={14} className="text-violet-500" />}
            Incoming {callType} call...
          </p>

          <div className="flex justify-center gap-8">
            <button
              onClick={onReject}
              className="w-14 h-14 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-red-600 active:scale-95 transition-all"
              aria-label="Reject call"
            >
              <PhoneOff size={24} />
            </button>
            <button
              onClick={onAccept}
              className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-emerald-600 active:scale-95 transition-all"
              aria-label="Accept call"
            >
              {callType === 'video' ? <Video size={24} /> : <Phone size={24} />}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
