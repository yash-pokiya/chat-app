import React, { useState, useRef, useEffect } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import useQuickEmojis from '../hooks/useQuickEmojis';

const ReactionBar = ({
  message,
  currentUser,
  onReact,          // (emoji) => void
  onClose,
  position = 'top', // 'top' | 'bottom'
  isMe,             // is this my message
}) => {
  const { quickEmojis } = useQuickEmojis(currentUser?._id || currentUser?.id);
  const [showFullPicker, setShowFullPicker] = useState(false);
  const pickerRef = useRef(null);

  // Current user's reaction on this message:
  const myId = currentUser?._id || currentUser?.id;
  const myReaction = message.reactions?.find((r) => r.userId?.toString() === myId?.toString())?.emoji;

  // Close picker on outside click:
  useEffect(() => {
    if (!showFullPicker) return;
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowFullPicker(false);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFullPicker]);

  const handleQuickReact = (emoji) => {
    onReact(emoji);
    onClose();
  };

  const handleFullPickerSelect = (emoji) => {
    onReact(emoji.native);
    setShowFullPicker(false);
    onClose();
  };

  return (
    <div
      className={`absolute z-50 ${isMe ? 'right-0' : 'left-0'} ${
        position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
      }`}
    >
      {/* ── QUICK REACTION BAR ── */}
      <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-1.5 shadow-xl shadow-black/10 backdrop-blur-sm animate-popIn">
        {/* 5 Quick Emojis */}
        {quickEmojis.map((emoji, i) => (
          <button
            key={i}
            onClick={() => handleQuickReact(emoji)}
            className={`w-9 h-9 rounded-full text-xl flex items-center justify-center transition-all duration-150 hover:scale-125 hover:bg-gray-100 dark:hover:bg-gray-750 active:scale-95 ${
              myReaction === emoji ? 'bg-violet-100 dark:bg-violet-900/40 scale-110' : ''
            }`}
            title={emoji}
          >
            {emoji}
          </button>
        ))}

        {/* Divider */}
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />

        {/* "+" button -> opens full picker */}
        <button
          onClick={() => setShowFullPicker(!showFullPicker)}
          className={`w-9 h-9 rounded-full text-lg flex items-center justify-center transition-all duration-150 hover:scale-110 hover:bg-gray-100 dark:hover:bg-gray-750 active:scale-95 ${
            showFullPicker ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-500' : 'text-gray-500'
          }`}
        >
          ➕
        </button>
      </div>

      {/* ── FULL EMOJI PICKER ── */}
      {showFullPicker && (
        <div
          ref={pickerRef}
          className={`absolute z-50 mt-2 ${isMe ? 'right-0' : 'left-0'}`}
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
        </div>
      )}
    </div>
  );
};

export default ReactionBar;
