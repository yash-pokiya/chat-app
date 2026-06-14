import useUserStore from '../store/userStore';
import { formatLastSeen } from '../utils/formatLastSeen';

export const OnlineDot = ({ userId, size = 'md', className = '', defaultOnline }) => {
  const { friendStatuses } = useUserStore();
  const status = friendStatuses[userId];
  const isOnline = status ? status.isOnline : (defaultOnline ?? false);

  const sizes = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  return (
    <span
      className={`${sizes[size]} rounded-full border-2 border-white flex-shrink-0 transition-colors duration-300 ${
        isOnline ? 'bg-emerald-400' : 'bg-gray-300 dark:bg-gray-700'
      } ${className}`}
    />
  );
};

export const StatusText = ({ userId, className = '', defaultOnline, defaultLastSeen }) => {
  const { friendStatuses } = useUserStore();
  const status = friendStatuses[userId];
  const isOnline = status ? status.isOnline : (defaultOnline ?? false);
  const lastSeen = status ? status.lastSeen : defaultLastSeen;

  return (
    <span
      className={`text-xs font-medium transition-colors duration-300 ${
        isOnline ? 'text-emerald-500' : 'text-gray-400 dark:text-gray-500'
      } ${className}`}
    >
      {isOnline ? 'Online' : formatLastSeen(lastSeen)}
    </span>
  );
};
