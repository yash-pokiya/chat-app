import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function SharedNotepad({ roomCode, socket, onClose }) {
  const [content, setContent] = useState('');
  const [lastEditor, setLastEditor] = useState('');
  const [saving, setSaving] = useState(false);

  // Load existing notepad content
  useEffect(() => {
    if (!socket) return;
    socket.emit('notepad:get', { roomCode }, ({ content: c, lastEditBy }) => {
      setContent(c || '');
      setLastEditor(lastEditBy || '');
    });
  }, [socket, roomCode]);

  useEffect(() => {
    if (!socket) return;
    const onUpdated = ({ content: c, username }) => {
      setContent(c);
      setLastEditor(username);
    };
    socket.on('notepad:updated', onUpdated);
    return () => socket.off('notepad:updated', onUpdated);
  }, [socket]);

  let debounceTimer = null;
  const handleChange = (e) => {
    const val = e.target.value;
    setContent(val);
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      socket?.emit('notepad:update', { roomCode, content: val });
    }, 300);
  };

  const handleClear = () => {
    setContent('');
    socket?.emit('notepad:clear', { roomCode });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto"
        >
          {/* Handle */}
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-gray-900">📝 Shared Notepad</h3>
            <div className="flex items-center gap-3">
              {lastEditor && (
                <span className="text-xs text-gray-400 italic">{lastEditor} is editing...</span>
              )}
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="relative">
            <textarea
              value={content}
              onChange={handleChange}
              placeholder="Both of you can type here... ✍️"
              className="w-full h-56 resize-none border border-gray-100 rounded-2xl bg-gray-50 p-4 outline-none text-gray-700 text-sm leading-relaxed focus:border-violet-300 focus:ring-2 focus:ring-violet-100 transition-all"
            />
            <div className="absolute bottom-3 right-3 text-xs text-gray-300">
              {content.length}/10000
            </div>
          </div>

          <div className="flex justify-between mt-4 items-center">
            <button
              onClick={handleClear}
              className="text-red-400 text-sm hover:text-red-600 transition-colors font-medium"
            >
              🗑️ Clear all
            </button>
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-gray-400">Synced live</span>
              <button
                onClick={onClose}
                className="bg-violet-500 text-white text-sm px-5 py-2 rounded-xl font-medium hover:bg-violet-600 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
