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
      className="mx-3 sm:mx-4 mt-2 px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-2xl flex items-center gap-3 cursor-pointer hover:bg-violet-100 transition-colors shadow-sm"
    >
      <Pin size={14} className="text-violet-600 flex-shrink-0 -rotate-45" />

      {/* Show thumbnail if pinned message is image */}
      {isImage && message.content && (
        <img
          src={message.content}
          className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-violet-200"
          alt="Pinned thumbnail"
        />
      )}

      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wider mb-0.5">Pinned Message</p>
        <p className="text-xs text-gray-700 truncate">{previewText}</p>
      </div>

      {/* Unpin button — always visible and easily tap-able */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onUnpin();
        }}
        className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-200 hover:bg-violet-300 flex items-center justify-center text-violet-700 text-xs font-bold transition-colors"
        aria-label="Unpin message"
      >
        ✕
      </button>
    </div>
  );
}
