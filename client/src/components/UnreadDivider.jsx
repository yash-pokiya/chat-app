import { motion } from 'framer-motion';

const UnreadDivider = ({ count }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scaleX: 0.7 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex items-center gap-3 my-3 select-none"
      id="unread-divider"
    >
      <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-violet-300 to-violet-400 dark:via-violet-700 dark:to-violet-600" />
      <span className="px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-300 text-xs font-semibold border border-violet-200 dark:border-violet-800 shadow-sm whitespace-nowrap">
        {count === 1 ? '1 unread message' : `${count} unread messages`}
      </span>
      <div className="flex-1 h-[1px] bg-gradient-to-r from-violet-400 via-violet-300 to-transparent dark:from-violet-600 dark:via-violet-700" />
    </motion.div>
  );
};

export default UnreadDivider;
