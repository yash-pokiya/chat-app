const SystemMessage = ({ text, type }) => {
  const styles = {
    screenshot: {
      bg:   'bg-red-50 dark:bg-red-950/30',
      border: 'border-red-200 dark:border-red-900/40',
      text: 'text-red-500 dark:text-red-400',
      icon: '📸',
    },
    info: {
      bg:   'bg-gray-50 dark:bg-gray-900/50',
      border: 'border-gray-200 dark:border-gray-800',
      text: 'text-gray-400 dark:text-gray-500',
      icon: '🔒',
    },
  };

  const s = styles[type] || styles.info;

  return (
    <div className="flex items-center justify-center my-3 w-full select-none">
      <div className={`
        flex items-center gap-2 px-4 py-1.5 rounded-full
        border ${s.bg} ${s.border} shadow-sm
        max-w-xs text-center
      `}>
        <span className="text-sm">{s.icon}</span>
        <p className={`text-xs font-semibold ${s.text}`}>
          {text}
        </p>
      </div>
    </div>
  );
};

export default SystemMessage;
