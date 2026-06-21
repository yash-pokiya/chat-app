import React, { useState, useEffect } from 'react';

const FriendRequestToast = ({ fromUser, onAccept, onDecline, duration = 8000 }) => {
  const [progress, setProgress] = useState(100);
  const username = fromUser?.username || '';
  const displayName = fromUser?.displayName || fromUser?.username || '';
  const avatar = fromUser?.avatar || '';

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, [duration]);

  return (
    <div className="relative flex items-center gap-3 bg-white dark:bg-gray-900 border border-violet-200 dark:border-violet-900/60 rounded-2xl px-4 py-3 shadow-xl max-w-[calc(100vw-2rem)] sm:max-w-sm w-full overflow-hidden animate-slideIn">
      {/* Auto-dismiss progress bar at very top: */}
      <div className="absolute top-0 left-0 h-0.5 bg-violet-400 dark:bg-violet-500 transition-all duration-100 ease-linear"
           style={{ width: `${progress}%` }} />

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
            className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
};

export default FriendRequestToast;
