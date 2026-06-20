import { Check, AlertCircle } from 'lucide-react'

const UploadingBubble = ({ upload }) => (
  <div className="flex justify-end mb-2 px-3">
    <div className="relative rounded-2xl overflow-hidden w-52 shadow-sm">
      <img src={upload.preview}
           className={`w-full object-cover transition-all duration-300
             ${upload.status === 'uploading' ? 'brightness-[0.6]' : ''}`}
      />
      {upload.status === 'uploading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none"
                stroke="rgba(255,255,255,0.25)" strokeWidth="4" />
              <circle cx="32" cy="32" r="28" fill="none"
                stroke="white" strokeWidth="4" strokeLinecap="round"
                strokeDasharray={175.9}
                strokeDashoffset={175.9 - (upload.progress / 100) * 175.9}
                className="transition-all duration-200 ease-linear" />
            </svg>
            <span className="absolute inset-0 flex items-center
                             justify-center text-white text-sm font-bold">
              {upload.progress}%
            </span>
          </div>
        </div>
      )}
      {upload.status === 'uploading' && (
        <p className="absolute bottom-2 left-0 right-0 text-center
                      text-white text-xs font-medium drop-shadow">
          Uploading...
        </p>
      )}
      {upload.status === 'done' && (
        <div className="absolute inset-0 flex items-center
                        justify-center bg-black/10">
          <div className="w-9 h-9 bg-white rounded-full
                          flex items-center justify-center shadow-lg">
            <Check size={18} className="text-green-500" />
          </div>
        </div>
      )}
      {upload.status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center
                        justify-center bg-black/50 gap-1">
          <AlertCircle size={22} className="text-white" />
          <p className="text-white text-xs">Upload failed</p>
        </div>
      )}
    </div>
  </div>
)

export default UploadingBubble
