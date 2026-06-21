import React from 'react';
import { CornerUpLeft } from 'lucide-react';

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
    <div className="mx-3 mb-2 flex items-stretch gap-2.5 bg-violet-50/80 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/50 rounded-xl overflow-hidden shadow-sm">
      {/* Left accent indicator line */}
      <div className="w-1 bg-violet-500 shrink-0" />

      {/* Reply body */}
      <div className="flex-1 flex items-center justify-between gap-3 py-2 pr-3 pl-0.5 min-w-0">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-black tracking-wide text-violet-500 uppercase leading-none mb-1">
            Replying to @{replyingTo.senderName || replyingTo.sender?.username || replyingTo.senderId?.username || 'Partner'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate leading-tight">
            {preview?.icon && `${preview.icon} `}
            {preview?.text}
          </p>
        </div>

        {/* Thumbnail preview */}
        {preview?.thumbnail && (
          <img
            src={preview.thumbnail}
            className="w-8 h-8 rounded object-cover flex-shrink-0 border border-violet-200/50"
            alt="Reply thumbnail"
          />
        )}
      </div>

      <button
        onClick={onCancel}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0 px-3 flex items-center justify-center border-l border-violet-100/50 dark:border-violet-900/30"
      >
        ✕
      </button>
    </div>
  );
};

// ─── Inside message bubble (quoted reply): ───
const QuotedMessage = ({ replyTo, isSent, onScrollTo }) => {
  if (!replyTo) return null;
  const preview = getReplyContent(replyTo);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation(); // Prevent parent trigger mechanics
        onScrollTo?.(replyTo._id);
      }}
      className={`group/quote flex items-stretch gap-2.5 rounded-lg overflow-hidden border cursor-pointer transition-all duration-200 backdrop-blur-md select-none text-left w-full mb-2 hover:translate-y-[-1px] hover:shadow-sm active:scale-[0.985] ${
        isSent
          ? 'bg-white/[0.08] hover:bg-white/[0.12] border-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
          : 'bg-black/[0.02] dark:bg-white/[0.04] hover:bg-black/[0.05] dark:hover:bg-white/[0.07] border-gray-200/50 dark:border-gray-700/50 text-gray-800 dark:text-gray-100 shadow-sm'
      }`}
    >
      {/* Left accent bar indicator */}
      <div 
        className={`w-1 flex-shrink-0 ${
          isSent 
            ? 'bg-white/80' 
            : 'bg-violet-500 dark:bg-violet-400'
        }`} 
      />

      {/* Main Quote Content Wrapper */}
      <div className="flex-1 flex items-center justify-between gap-3 pl-0.5 pr-2.5 py-2 min-w-0">
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {/* Sender Username */}
          <span
            className={`text-[10px] font-black tracking-wider uppercase leading-none mb-1 truncate ${
              isSent ? 'text-white' : 'text-violet-600 dark:text-violet-400'
            }`}
          >
            {replyTo.senderName || replyTo.sender?.username || replyTo.senderId?.username || 'Partner'}
          </span>
          {/* Quoted Message Preview Text */}
          <p
            className={`text-[11px] truncate leading-tight font-medium ${
              isSent ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {preview?.icon && <span className="mr-1">{preview.icon}</span>}
            {preview?.text}
          </p>
        </div>

        {/* Thumbnail block for attachments */}
        {preview?.thumbnail && (
          <div className="relative flex-shrink-0 w-8 h-8 rounded-md overflow-hidden shadow-sm border border-black/5 dark:border-white/10">
            <img
              src={preview.thumbnail}
              className="w-full h-full object-cover"
              alt="Quote thumbnail"
            />
            <div className="absolute inset-0 bg-black/5" />
          </div>
        )}
      </div>
    </div>
  );
};

export default ReplyBar;
export { ReplyBar, QuotedMessage, getReplyContent };
