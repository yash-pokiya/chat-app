import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

export default function ChatBox({ messages, currentUserId, partner }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center gap-2 p-8 text-center">
        <div className="text-4xl mb-2">👋</div>
        <p className="text-gray-400 text-sm">Say hello! This conversation is private and expires in 24 hours.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
      {messages.map((msg, idx) => {
        const prevMsg = messages[idx - 1];
        const isSent = msg.senderId?._id?.toString() === currentUserId?.toString()
          || msg.senderId?.toString() === currentUserId?.toString();

        const showAvatar =
          !prevMsg ||
          (prevMsg.senderId?._id?.toString() || prevMsg.senderId?.toString()) !==
          (msg.senderId?._id?.toString() || msg.senderId?.toString());

        return (
          <MessageBubble
            key={msg._id || idx}
            message={msg}
            isSent={isSent}
            showAvatar={showAvatar}
            partnerName={partner?.username}
          />
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
