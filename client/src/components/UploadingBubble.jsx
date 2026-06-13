import React from 'react';

export default function UploadingBubble({ upload }) {
  return (
    <div className="flex justify-end mb-2 px-3 animate-slide-up">
      <div className="relative rounded-2xl overflow-hidden w-52 shadow-sm border border-violet-100 dark:border-gray-800">
        {/* Image preview (blurred during upload) */}
        <img
          src={upload.preview}
          className={`w-full object-cover transition-all ${
            upload.status === 'uploading' ? 'blur-sm brightness-75' : 'blur-0'
          }`}
          alt="Uploading preview"
        />

        {/* Progress overlay */}
        {upload.status === 'uploading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/20">
            {/* Circular progress spinner */}
            <div className="relative w-12 h-12">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="4"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="white"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={125.6}
                  strokeDashoffset={125.6 - (upload.progress / 100) * 125.6}
                  className="transition-all duration-300"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
                {upload.progress}%
              </span>
            </div>

            <p className="text-white text-xs font-medium drop-shadow-md">
              Uploading...
            </p>
          </div>
        )}

        {/* Error state */}
        {upload.status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 gap-1">
            <span className="text-2xl">⚠️</span>
            <p className="text-white text-xs text-center px-2">
              Upload failed
            </p>
          </div>
        )}

        {/* Success checkmark flash */}
        {upload.status === 'done' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg animate-bounce">
              <span className="text-green-500 text-xl font-bold">✓</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
