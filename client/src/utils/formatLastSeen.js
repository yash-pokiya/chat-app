export const formatLastSeen = (lastSeen) => {
  if (!lastSeen) return 'Offline';

  const now = new Date();
  const seen = new Date(lastSeen);
  
  // Guard against invalid dates
  if (isNaN(seen.getTime())) return 'Offline';

  const diff = Math.floor((now - seen) / 1000); // seconds

  if (diff < 10) return 'Just now';
  if (diff < 60) return `${diff}s ago`;

  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Last seen ${hrs}h ago`;

  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Last seen yesterday';
  if (days < 7) {
    return `Last seen ${seen.toLocaleDateString('en', {
      weekday: 'long',
    })}`;
  }

  return `Last seen ${seen.toLocaleDateString('en', {
    day: 'numeric',
    month: 'short',
    year: seen.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })}`;
};
