import { useEffect } from 'react';

export default function TimerBubble({ seconds, totalSeconds, isRunning, onPause, onCancel }) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  const circumference = 125.6; // 2 * PI * r (r=20)
  const progress = totalSeconds > 0 ? seconds / totalSeconds : 0;
  const dashOffset = circumference * (1 - progress);

  // Play chime when timer hits 0
  useEffect(() => {
    if (seconds === 0) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.8);
      } catch {}
    }
  }, [seconds]);

  return (
    <div className="flex justify-center my-2 msg-in">
      <div className="bg-white border border-gray-200 rounded-2xl px-5 py-3.5 shadow-sm flex items-center gap-4 max-w-[200px]">
        {/* Circular progress ring */}
        <svg width="52" height="52" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" fill="none" stroke="#E5E7EB" strokeWidth="3" />
          <circle
            cx="24" cy="24" r="20"
            fill="none"
            stroke={seconds === 0 ? '#EF4444' : '#6C63FF'}
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 24 24)"
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
          />
          <text x="24" y="28" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#374151">
            {mins}:{secs}
          </text>
        </svg>

        <div>
          <p className="text-xs text-gray-400 font-medium mb-1">
            {seconds === 0 ? '⏱️ Done!' : isRunning ? '⏱️ Timer' : '⏸️ Paused'}
          </p>
          {seconds > 0 && (
            <div className="flex gap-2">
              <button
                onClick={onPause}
                className="text-xs text-violet-500 font-semibold hover:text-violet-700"
              >
                {isRunning ? 'Pause' : 'Resume'}
              </button>
              <button
                onClick={onCancel}
                className="text-xs text-red-400 hover:text-red-600"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
