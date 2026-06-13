import React from 'react';

const getReplyContent = (message) => {
  if (!message) return null;

  switch (message.type) {
    case 'image':
      return {
        icon: null,
        thumbnail: message.content, // Cloudinary URL
        text: '📷 Photo',
      };
    case 'audio':
      return {
        icon: '🎵',
        text: 'Voice message',
      };
    case 'sketch':
      return {
        icon: '✏️',
        text: 'Sketch',
      };
    case 'location':
      return {
        icon: '📍',
        text: 'Location',
      };
    case 'video':
      return {
        icon: '🎥',
        text: 'Video',
      };
    default:
      return {
        icon: null,
        text: message.content,  // plain text
      };
  }
};

// ─── Above input bar (composing reply): ───
const ReplyBar = ({ replyingTo, onCancel }) => {
  if (!replyingTo) return null;
  const preview = getReplyContent(replyingTo);

  return (
    <div className="mx-3 mb-2 flex items-center gap-2 bg-violet-50 border-l-4 border-violet-500 rounded-xl px-3 py-2">
      {/* Thumbnail for image replies */}
      {preview?.thumbnail && (
        <img
          src={preview.thumbnail}
          className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-violet-200"
          alt="Reply thumbnail"
        />
      )}

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-violet-500">
          Replying to @{replyingTo.senderName || replyingTo.sender?.username || replyingTo.senderId?.username || 'Partner'}
        </p>
        <p className="text-xs text-gray-500 truncate">
          {preview?.icon && `${preview.icon} `}
          {preview?.text}
        </p>
      </div>

      <button
        onClick={onCancel}
        className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-1"
      >
        ✕
      </button>
    </div>
  );
};

// ─── Inside message bubble (quoted reply): ───
const QuotedMessage = ({ replyTo, onScrollTo }) => {
  if (!replyTo) return null;
  const preview = getReplyContent(replyTo);

  return (
    <div
      onClick={() => onScrollTo?.(replyTo._id)}
      className="flex items-center gap-2 bg-black/5 dark:bg-white/10 rounded-xl px-3 py-2 mb-2 border-l-4 border-violet-400 cursor-pointer hover:bg-black/10 dark:hover:bg-white/15 transition-colors max-w-full text-left"
    >
      {/* Thumbnail for image replies */}
      {preview?.thumbnail && (
        <img
          src={preview.thumbnail}
          className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
          alt="Quote thumbnail"
        />
      )}

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-violet-500 dark:text-violet-400 truncate">
          @{replyTo.senderName || replyTo.sender?.username || replyTo.senderId?.username || 'Partner'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-300 truncate">
          {preview?.icon && `${preview.icon} `}
          {preview?.text}
        </p>
      </div>
    </div>
  );
};

export { ReplyBar, QuotedMessage, getReplyContent };
