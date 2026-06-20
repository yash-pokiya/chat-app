import { useState, useRef, useEffect } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import { Download, Eye, Clock } from 'lucide-react';

// Module-level session cache for downloaded blob URLs
const imageCache = new Map();

export default function ImageMessage({ message, isSent }) {
  const src = message.content;
  const messageId = message._id;
  const expiresAt = message.expiresAt;

  // Check if already cached
  const cached = imageCache.get(messageId);
  const [state, setState] = useState(cached ? 'downloaded' : 'locked'); // locked | downloading | downloaded
  const [progress, setProgress] = useState(0);
  const [blobUrl, setBlobUrl] = useState(cached || null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [expired, setExpired] = useState(false);
  const xhrRef = useRef(null);

  // Check expiry
  useEffect(() => {
    if (!expiresAt) return;
    const check = () => {
      if (new Date(expiresAt) <= new Date()) {
        setExpired(true);
        // Clean up blob if cached
        if (imageCache.has(messageId)) {
          URL.revokeObjectURL(imageCache.get(messageId));
          imageCache.delete(messageId);
        }
      }
    };
    check();
    const timer = setInterval(check, 5000);
    return () => clearInterval(timer);
  }, [expiresAt, messageId]);

  // Expiry countdown
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    if (!expiresAt || expired) return;
    const update = () => {
      const diff = new Date(expiresAt) - new Date();
      if (diff <= 0) { setTimeLeft(''); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h > 0) setTimeLeft(`${h}h ${m}m`);
      else if (m > 0) setTimeLeft(`${m}m ${s}s`);
      else setTimeLeft(`${s}s`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, expired]);

  const handleDownload = () => {
    if (state !== 'locked') return;
    setState('downloading');
    setProgress(0);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('GET', src, true);
    xhr.responseType = 'blob';

    xhr.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        const url = URL.createObjectURL(xhr.response);
        imageCache.set(messageId, url);
        setBlobUrl(url);
        setState('downloaded');
        setProgress(100);
      } else {
        setState('locked');
      }
    };

    xhr.onerror = () => setState('locked');
    xhr.send();
  };

  const handleCancel = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setState('locked');
    setProgress(0);
  };

  if (expired) {
    return (
      <div className="relative rounded-2xl overflow-hidden max-w-[220px] bg-gray-100 border border-gray-200">
        <div className="flex flex-col items-center justify-center py-8 px-6 gap-2">
          <Clock size={24} className="text-gray-300" />
          <p className="text-xs text-gray-400 font-medium">Photo expired</p>
        </div>
      </div>
    );
  }

  // Circumference for SVG circle
  const R = 20;
  const C = 2 * Math.PI * R;

  return (
    <div className="relative rounded-2xl overflow-hidden max-w-[220px] cursor-pointer">
      {/* Image — blurred when locked/downloading, clear when downloaded */}
      <img
        src={blobUrl || src}
        alt="Photo"
        className={`w-full max-h-60 object-cover transition-all duration-500 ${
          state === 'downloaded' ? 'blur-0 scale-100' : 'blur-xl scale-110 brightness-75'
        }`}
        onClick={() => {
          if (state === 'downloaded') setLightboxOpen(true);
          else if (state === 'locked') handleDownload();
        }}
        onError={(e) => { e.target.src = '/placeholder.png'; }}
      />

      {/* Locked overlay */}
      {state === 'locked' && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/30"
          onClick={handleDownload}
        >
          <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center mb-2 shadow-lg hover:scale-110 transition-transform">
            <Download size={20} className="text-violet-600" />
          </div>
          <p className="text-white text-xs font-semibold drop-shadow">Tap to download</p>
        </div>
      )}

      {/* Downloading overlay */}
      {state === 'downloading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
          <div className="relative w-14 h-14 cursor-pointer" onClick={handleCancel}>
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r={R} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
              <circle
                cx="24" cy="24" r={R} fill="none"
                stroke="white" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C - (progress / 100) * C}
                className="transition-all duration-300"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
              {progress}%
            </span>
          </div>
          <p className="text-white text-xs font-medium drop-shadow mt-1.5">Downloading...</p>
        </div>
      )}

      {/* Expiry countdown badge */}
      {expiresAt && state === 'downloaded' && timeLeft && (
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm">
          <Clock size={10} className="text-white" />
          <span className="text-[10px] text-white font-semibold">{timeLeft}</span>
        </div>
      )}

      {/* View indicator when downloaded */}
      {state === 'downloaded' && (
        <div
          className="absolute bottom-2 right-2 w-7 h-7 bg-white/80 rounded-full flex items-center justify-center shadow-sm opacity-0 hover:opacity-100 transition-opacity"
          onClick={() => setLightboxOpen(true)}
        >
          <Eye size={14} className="text-gray-600" />
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && (
        <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          slides={[{ src: blobUrl || src }]}
        />
      )}
    </div>
  );
}
