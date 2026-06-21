import React, { useState, useEffect, useRef } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { motion, AnimatePresence } from 'framer-motion';
import { Reply, Pin, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import useQuickEmojis from '../hooks/useQuickEmojis';

const ReactionBar = ({
  message,
  currentUser,
  onReact,
  onClose,
  onReply,
  onPin,
  onCopy,
  isMe,
  anchorRect,
}) => {
  const containerRef = useRef(null);
  const [position, setPosition] = useState(null);
  const [showFullPicker, setShowFullPicker] = useState(false);
  const { quickEmojis } = useQuickEmojis(currentUser?._id || currentUser?.id);

  // Default quick emojis if hook doesn't load/return them
  const emojis = quickEmojis && quickEmojis.length > 0 ? quickEmojis : ['❤️', '😂', '😮', '😢', '👍'];

  // Calculate position based on the bounding rect of the message bubble
  useEffect(() => {
    if (!anchorRect) return;

    const popupHeight = 200; // Combined height of emoji pill + action menu + spacing
    const viewportHeight = window.innerHeight;
    const spaceAbove = anchorRect.top;
    const spaceBelow = viewportHeight - anchorRect.bottom;

    // Prefer showing above; fallback to below if top space is limited
    const showAbove = spaceAbove > popupHeight || spaceAbove > spaceBelow;

    setPosition({
      top: showAbove
        ? Math.max(8, anchorRect.top - popupHeight - 8)
        : anchorRect.bottom + 8,
      left: isMe
        ? Math.min(anchorRect.right - 220, window.innerWidth - 228) // align right edge near bubble
        : Math.max(8, anchorRect.left),
    });
  }, [anchorRect, isMe]);

  // Close reaction bar on any scroll event in the app to prevent floating drift
  useEffect(() => {
    const handleScroll = () => {
      onClose();
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  const handleReact = (emoji) => {
    onReact(emoji);
    onClose();
  };

  const handleAction = (fn, label) => {
    if (fn) {
      fn();
    } else if (label === 'Copy Text') {
      navigator.clipboard.writeText(message.content || '');
      toast.success('Copied!');
    }
    onClose();
  };

  const handleFullPickerSelect = (emoji) => {
    onReact(emoji.native);
    setShowFullPicker(false);
    onClose();
  };

  if (!position) return null;

  return (
    <>
      {/* Backdrop overlay to close when clicking outside */}
      <div
        className="fixed inset-0 z-40 bg-black/5 dark:bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
        onTouchStart={onClose}
      />

      {/* Floating popup container */}
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.85, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85, y: 8 }}
        transition={{ type: 'spring', damping: 25, stiffness: 400 }}
        style={{
          position: 'fixed',
          top: position.top,
          left: position.left,
          zIndex: 50,
        }}
        className="flex flex-col gap-2 w-[220px]"
      >
        {/* Quick Emoji Pill Bar */}
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-full px-3 py-2 shadow-lg shadow-black/10 dark:shadow-black/30 border border-gray-100 dark:border-gray-700">
          {emojis.slice(0, 5).map((emoji, i) => (
            <button
              key={i}
              onClick={() => handleReact(emoji)}
              className="text-xl active:scale-75 transition-transform duration-100 hover:scale-125 select-none"
            >
              {emoji}
            </button>
          ))}
          <button
            onClick={() => setShowFullPicker(true)}
            className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-300 text-sm flex-shrink-0 hover:bg-gray-200 dark:hover:bg-gray-650 active:scale-90 transition-all font-bold select-none"
          >
            +
          </button>
        </div>

        {/* Action Menu (Reply/Pin/Copy) */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg shadow-black/10 dark:shadow-black/30 border border-gray-100 dark:border-gray-700 overflow-hidden">
          {[
            { icon: <Reply size={17} />, label: 'Reply', fn: onReply },
            { icon: <Pin size={17} />, label: 'Pin Message', fn: onPin },
            { icon: <Copy size={17} />, label: 'Copy Text', fn: onCopy },
          ].map(({ icon, label, fn }, i, arr) => {
            if (label === 'Pin Message' && !onPin) return null;
            return (
              <button
                key={label}
                onClick={() => handleAction(fn, label)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-[15px] text-gray-700 dark:text-gray-200 active:bg-gray-50 dark:active:bg-gray-700 transition-colors text-left font-medium ${
                  i < arr.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''
                }`}
              >
                <span className="text-gray-400 dark:text-gray-500">{icon}</span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Full Emoji Picker Modal Overlay */}
      <AnimatePresence>
        {showFullPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div 
              className="absolute inset-0" 
              onClick={() => setShowFullPicker(false)} 
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="z-10 bg-white dark:bg-gray-800 p-3 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700"
            >
              <Picker
                data={data}
                onEmojiSelect={handleFullPickerSelect}
                theme="light"
                previewPosition="none"
                skinTonePosition="search"
                set="native"
                maxFrequentRows={2}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ReactionBar;
