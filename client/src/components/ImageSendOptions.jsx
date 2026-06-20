import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Clock, Infinity } from 'lucide-react';

const TIMER_OPTIONS = [
  { label: '10 min',  value: 10 * 60 * 1000 },
  { label: '30 min',  value: 30 * 60 * 1000 },
  { label: '1 hour',  value: 60 * 60 * 1000 },
  { label: '6 hours', value: 6 * 60 * 60 * 1000 },
  { label: '24 hours', value: 24 * 60 * 60 * 1000 },
  { label: 'Never',   value: 0 },
];

export default function ImageSendOptions({ previewUrl, onSend, onCancel }) {
  const [selectedTimer, setSelectedTimer] = useState(24 * 60 * 60 * 1000); // default 24h

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
        >
          {/* Close button */}
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <h3 className="text-base font-bold text-gray-900">Send Photo</h3>
            <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Image preview */}
          <div className="px-5 pb-4">
            <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full max-h-48 object-cover"
              />
            </div>
          </div>

          {/* Timer selection */}
          <div className="px-5 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-violet-500" />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Auto-delete after</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {TIMER_OPTIONS.map((opt) => {
                const isActive = selectedTimer === opt.value;
                return (
                  <button
                    key={opt.label}
                    onClick={() => setSelectedTimer(opt.value)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-gradient-to-br from-violet-500 to-cyan-400 text-white shadow-md scale-[1.03]'
                        : 'bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100'
                    }`}
                  >
                    {opt.value === 0 ? (
                      <span className="flex items-center justify-center gap-1">
                        <Infinity size={12} /> Never
                      </span>
                    ) : (
                      opt.label
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Send button */}
          <div className="px-5 pb-5 flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-2xl text-sm font-semibold hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onSend(selectedTimer)}
              className="flex-1 py-3 bg-gradient-to-br from-violet-500 to-cyan-400 text-white rounded-2xl text-sm font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Send size={16} /> Send
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
