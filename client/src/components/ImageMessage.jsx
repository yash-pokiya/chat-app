import { useState, useRef } from 'react'
import { Download, Check } from 'lucide-react'

const ImageMessage = ({ src, onOpenLightbox }) => {
  const [state, setState] = useState('locked') // locked | downloading | downloaded
  const [progress, setProgress] = useState(0)
  const [localUrl, setLocalUrl] = useState(null)
  const xhrRef = useRef(null)

  const handleDownload = async () => {
    if (state !== 'locked') return
    setState('downloading')

    try {
      const xhr = new XMLHttpRequest()
      xhrRef.current = xhr
      xhr.responseType = 'blob'
      xhr.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100))
        }
      }
      xhr.onload = () => {
        if (xhr.status === 200) {
          const blobUrl = URL.createObjectURL(xhr.response)
          setLocalUrl(blobUrl)
          setState('downloaded')
        } else {
          setState('locked')
        }
      }
      xhr.onerror = () => setState('locked')
      xhr.open('GET', src)
      xhr.send()
    } catch {
      setState('locked')
    }
  }

  const handleSaveToDevice = (e) => {
    e.stopPropagation()
    const a = document.createElement('a')
    a.href = localUrl || src
    a.download = `image_${Date.now()}.jpg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div
      onClick={state === 'downloaded'
        ? () => onOpenLightbox?.(localUrl, handleSaveToDevice)
        : handleDownload}
      className="relative rounded-2xl overflow-hidden w-52 max-w-full
                 cursor-pointer group"
    >
      <img src={src}
           className={`w-full object-cover transition-all duration-500
             ${state === 'downloaded' ? 'blur-0' : 'blur-lg scale-105'}`}
      />

      {state === 'downloaded' && (
        <>
          <img src={localUrl}
               className="absolute inset-0 w-full h-full object-cover" />
          <button
            onClick={handleSaveToDevice}
            className="absolute top-2 right-2 w-8 h-8 rounded-full
                       bg-black/40 backdrop-blur-sm flex items-center
                       justify-center text-white opacity-0
                       group-hover:opacity-100 transition-opacity"
          >
            <Download size={14} />
          </button>
        </>
      )}

      {state === 'locked' && (
        <div className="absolute inset-0 flex flex-col items-center
                        justify-center gap-2 bg-black/25">
          <div className="w-11 h-11 bg-white rounded-full
                          flex items-center justify-center shadow-lg
                          group-hover:scale-110 transition-transform">
            <Download size={18} className="text-violet-500" />
          </div>
          <p className="text-white text-xs font-medium drop-shadow">
            Tap to download
          </p>
        </div>
      )}

      {state === 'downloading' && (
        <div className="absolute inset-0 flex items-center
                        justify-center bg-black/35">
          <div className="relative w-12 h-12">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none"
                stroke="rgba(255,255,255,0.3)" strokeWidth="4" />
              <circle cx="24" cy="24" r="20" fill="none"
                stroke="white" strokeWidth="4" strokeLinecap="round"
                strokeDasharray={125.6}
                strokeDashoffset={125.6 - (progress / 100) * 125.6}
                className="transition-all duration-150" />
            </svg>
            <span className="absolute inset-0 flex items-center
                             justify-center text-white text-xs font-bold">
              {progress}%
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default ImageMessage
