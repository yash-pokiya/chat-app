import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Reply } from 'lucide-react';
import { useEffect } from 'react';

const SWIPE_THRESHOLD = 60;
const MAX_SWIPE = 80;

const SwipeableMessage = ({ mine, onReply, children }) => {
  // Single source of truth for drag position — no competing controls/motion-value setups
  const x = useMotionValue(0);

  // Direction is now REVERSED:
  // - mine (own message) → swipe LEFT (negative x) to reply
  // - partner's message  → swipe RIGHT (positive x) to reply
  const dragConstraints = mine
    ? { left: -MAX_SWIPE, right: 0 }
    : { left: 0, right: MAX_SWIPE };

  const replyIconOpacity = useTransform(
    x,
    mine ? [-SWIPE_THRESHOLD, 0] : [0, SWIPE_THRESHOLD],
    mine ? [1, 0] : [0, 1]
  );
  
  const replyIconScale = useTransform(
    x,
    mine ? [-SWIPE_THRESHOLD, 0] : [0, SWIPE_THRESHOLD],
    mine ? [1, 0.5] : [0.5, 1]
  );

  const handleDragEnd = (event, info) => {
    const offset = info.offset.x;

    // Reversed threshold check:
    const reachedThreshold = mine
      ? offset < -SWIPE_THRESHOLD   // own message → leftward
      : offset > SWIPE_THRESHOLD;   // partner message → rightward

    if (reachedThreshold) {
      onReply();
      if (navigator.vibrate) {
        try {
          navigator.vibrate(10);
        } catch (_) {}
      }
    }

    // Imperative animate() call on the motion value to guarantee spring-back always fires
    animate(x, 0, {
      type: 'spring',
      stiffness: 500,
      damping: 35,
    });
  };

  // Keep motion value active
  useEffect(() => {
    const unsubscribe = x.on('change', () => {});
    return unsubscribe;
  }, [x]);

  return (
    <div className="relative w-full overflow-visible">
      {/* 
        Reply icon positioning:
        - When mine is true (swiped LEFT), space is created on the right. Icon should be at left-full ml-2 (right side).
        - When mine is false (swiped RIGHT), space is created on the left. Icon should be at right-full mr-2 (left side).
      */}
      <motion.div
        className={`absolute top-1/2 -translate-y-1/2 ${
          mine ? 'left-full ml-2' : 'right-full mr-2'
        } pointer-events-none z-10`}
        style={{ opacity: replyIconOpacity, scale: replyIconScale }}
      >
        <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shadow-sm">
          <Reply size={14} className="text-violet-500 dark:text-violet-300" />
        </div>
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={dragConstraints}
        dragElastic={0.15}
        dragMomentum={false}
        style={{ x }}
        onDragEnd={handleDragEnd}
        onPointerCancel={() => {
          animate(x, 0, { type: 'spring', stiffness: 500, damping: 35 });
        }}
        className="touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  );
};

export default SwipeableMessage;
