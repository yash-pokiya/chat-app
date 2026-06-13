import { useState } from 'react';
import { Eye } from 'lucide-react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

export default function BlurredMedia({ src, type = 'image', alt = 'Media' }) {
  const [revealed, setReveal] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <div className="relative rounded-2xl overflow-hidden cursor-pointer max-w-[220px]">
      <div
        onClick={() => {
          if (!revealed) {
            setReveal(true);
          } else {
            setLightboxOpen(true);
          }
        }}
      >
        <img
          src={src}
          alt={alt}
          className={`w-full max-h-60 object-cover transition-all duration-500 ${
            revealed ? 'blur-0 scale-100' : 'blur-xl scale-110'
          }`}
          onError={(e) => { e.target.src = '/placeholder.png'; }}
        />

        {!revealed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20">
            <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center mb-1.5 shadow-md">
              <Eye size={18} className="text-gray-700" />
            </div>
            <p className="text-white text-xs font-semibold drop-shadow">Tap to reveal</p>
          </div>
        )}
      </div>

      {revealed && lightboxOpen && (
        <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          slides={[{ src }]}
        />
      )}
    </div>
  );
}
