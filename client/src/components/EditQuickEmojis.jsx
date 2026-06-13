import React, { useState } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import useQuickEmojis, { DEFAULT_QUICK_EMOJIS } from '../hooks/useQuickEmojis';

const EditQuickEmojis = ({ currentUser, onClose }) => {
  const { quickEmojis, saveQuickEmojis } = useQuickEmojis(currentUser?._id || currentUser?.id);

  const [draft, setDraft] = useState([...quickEmojis]);
  const [editingSlot, setEditingSlot] = useState(null);
  // editingSlot: 0-4 (which slot is being changed) | null
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSlotClick = (index) => {
    setEditingSlot(editingSlot === index ? null : index);
  };

  const handleEmojiSelect = (emoji) => {
    if (editingSlot === null) return;
    const updated = [...draft];
    updated[editingSlot] = emoji.native;
    setDraft(updated);
    setEditingSlot(null); // auto close after pick
  };

  const handleSave = async () => {
    setSaving(true);
    await saveQuickEmojis(draft);
    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1000);
  };

  const handleReset = () => {
    setDraft([...DEFAULT_QUICK_EMOJIS]);
    setEditingSlot(null);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg">
              Quick Reactions
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Tap a slot to change that emoji
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            ✕
          </button>
        </div>

        {/* 5 Emoji Slots */}
        <div className="flex justify-center gap-3 px-5 py-4">
          {draft.map((emoji, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <button
                onClick={() => handleSlotClick(i)}
                className={`w-14 h-14 rounded-2xl text-3xl flex items-center justify-center border-2 transition-all duration-200 hover:scale-110 active:scale-95 ${
                  editingSlot === i
                    ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 scale-110 shadow-lg shadow-violet-200 dark:shadow-none'
                    : 'border-gray-200 dark:border-gray-750 bg-gray-550 dark:bg-gray-750 hover:border-violet-300'
                }`}
              >
                {emoji}
              </button>
              <span className="text-xs text-gray-400">
                {editingSlot === i ? '👆 pick' : `#${i + 1}`}
              </span>
            </div>
          ))}
        </div>

        {/* Hint when slot selected */}
        {editingSlot !== null && (
          <p className="text-center text-xs text-violet-500 font-medium mb-2 animate-pulse">
            Pick an emoji for slot #{editingSlot + 1} below
          </p>
        )}

        {/* Full Emoji Picker — always visible in modal */}
        <div className="border-t border-gray-100 dark:border-gray-700 overflow-y-auto flex-1">
          <Picker
            data={data}
            onEmojiSelect={handleEmojiSelect}
            theme="light"
            previewPosition="none"
            skinTonePosition="search"
            set="native"
            maxFrequentRows={1}
            style={{ width: '100%', border: 'none' }}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 px-5 pb-5 pt-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <button
            onClick={handleReset}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
          >
            Reset Default
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-all ${
              saved
                ? 'bg-green-500'
                : 'bg-gradient-to-r from-violet-500 to-cyan-400 hover:opacity-90'
            }`}
          >
            {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditQuickEmojis;
