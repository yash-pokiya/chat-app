import React from 'react';
import { X, Pin } from 'lucide-react';

export default function PinnedMessage({ message, onScrollTo, onUnpin }) {
  if (!message) return null;

  const isImage = message.type === 'image';
  const previewText = isImage
    ? '📷 Photo'
    : message.content?.slice(0, 80) || 'Pinned message';

  return (
    <div
      onClick={onScrollTo}
      className="mx-3 mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-amber-100 transition-colors"
    >
      <Pin size={14} className="text-amber-600 flex-shrink-0 -rotate-45" />

      {/* Show thumbnail if pinned message is image */}
      {isImage && message.content && (
        <img
          src={message.content}
          className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-amber-200"
          alt="Pinned thumbnail"
        />
      )}

      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-0.5">Pinned Message</p>
        <p className="text-xs text-gray-700 truncate">{previewText}</p>
      </div>

      {/* Unpin button — always visible and easily tap-able */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onUnpin();
        }}
        className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-200 hover:bg-amber-300 flex items-center justify-center text-amber-700 text-xs font-bold transition-colors"
        aria-label="Unpin message"
      >
        ✕
      </button>
    </div>
  );
}
