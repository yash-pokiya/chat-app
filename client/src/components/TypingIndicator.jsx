import { motion } from 'framer-motion';

export default function TypingIndicator({ username }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.2 }}
      className="flex items-end gap-2 mt-1"
    >
      {/* Avatar placeholder */}
      <div className="w-7 h-7 rounded-full bg-surface-muted border border-border flex items-center justify-center text-[11px] font-bold text-ink-faint uppercase shrink-0">
        {(username || 'P')[0]}
      </div>

      <div className="bubble-recv flex items-center gap-1 !py-3 !px-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </motion.div>
  );
}
