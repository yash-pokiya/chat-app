import React from 'react';

const MessageTicks = ({ status }) => {
  // Single gray tick = sent to server
  if (status === 'sent') {
    return (
      <svg width="14" height="10" viewBox="0 0 14 10" className="flex-shrink-0">
        <path
          d="M1 5l3 3 5-7"
          stroke="#9CA3AF"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    );
  }

  // Double gray tick = delivered to device
  if (status === 'delivered') {
    return (
      <svg width="18" height="10" viewBox="0 0 18 10" className="flex-shrink-0">
        <path
          d="M1 5l3 3 5-7"
          stroke="#9CA3AF"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M5 5l3 3 5-7"
          stroke="#9CA3AF"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    );
  }

  // Double BLUE/VIOLET tick = seen/read
  if (status === 'seen' || status === 'read') {
    return (
      <svg width="18" height="10" viewBox="0 0 18 10" className="flex-shrink-0">
        <path
          d="M1 5l3 3 5-7"
          stroke="#6C63FF"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M5 5l3 3 5-7"
          stroke="#6C63FF"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    );
  }

  return null;
};

export default MessageTicks;
