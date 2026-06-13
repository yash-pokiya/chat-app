const ScreenshotAlert = ({ username }) => {
  return (
    <div className="flex items-center justify-center my-3 px-4 animate-fadeIn select-none">
      <div className="flex items-center gap-2.5 bg-amber-500/5 dark:bg-amber-400/5 border border-amber-500/15 dark:border-amber-400/10 rounded-full px-4 py-1.5 shadow-[0_2px_12px_rgba(245,158,11,0.04)]">
        {/* Snapchat double-square overlapping shapes with a golden glow */}
        <div className="relative w-4 h-4 flex-shrink-0 flex items-center justify-center">
          {/* Outer glow aura */}
          <div className="absolute inset-0 rounded-full bg-amber-500/20 dark:bg-amber-400/10 blur-[3px]" />
          
          {/* Overlapping squares */}
          <div className="relative w-3.5 h-3.5">
            <div className="absolute top-0 left-0 w-2.5 h-2.5 border border-amber-400 rounded-[3px] bg-white dark:bg-gray-900 shadow-sm" />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border border-amber-500 rounded-[3px] bg-amber-100 dark:bg-amber-900/60 shadow-sm" />
          </div>
        </div>

        {/* Text */}
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium tracking-wide">
          <span className="font-bold text-gray-800 dark:text-gray-200">@{username}</span> took a screenshot!
        </p>
      </div>
    </div>
  );
};

export default ScreenshotAlert;
