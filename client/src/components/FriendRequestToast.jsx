import React from 'react';

const FriendRequestToast = ({ fromUser, onAccept, onDecline }) => {
  const username = fromUser?.username || '';
  const displayName = fromUser?.displayName || fromUser?.username || '';
  const avatar = fromUser?.avatar || '';

  return (
    <div className="flex items-center gap-3 bg-white dark:bg-gray-900 border border-violet-200 dark:border-violet-900/60 rounded-2xl px-4 py-3 shadow-xl max-w-sm w-full animate-slideIn">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-violet-100 dark:bg-violet-950 flex items-center justify-center">
          {avatar ? (
            <img src={avatar} className="w-full h-full object-cover" alt={username} />
          ) : (
            <span className="text-violet-500 dark:text-violet-400 font-bold text-lg">
              {username ? username[0].toUpperCase() : '?'}
            </span>
          )}
        </div>
        {/* Online dot */}
        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm truncate">
          {displayName}
        </p>
        <p className="text-xs text-gray-400">
          @{username} sent you a friend request
        </p>

        {/* Action buttons */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={onAccept}
            className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-violet-500 to-cyan-400 hover:opacity-90 active:scale-95 transition-all"
          >
            Accept
          </button>
          <button
            onClick={onDecline}
            className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-gray-500 dark:text-gray-405 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
};

export default FriendRequestToast;
