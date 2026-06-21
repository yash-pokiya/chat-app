import { Download, X } from 'lucide-react'

const ImageLightbox = ({ src, onClose, onSave }) => (
  <div className="fixed inset-0 bg-black/90 z-[200] flex
                  items-center justify-center"
       onClick={onClose}>
    <button onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10
                       rounded-full bg-white/10 text-white
                       flex items-center justify-center">
      <X size={20} />
    </button>
    <img src={src} onClick={(e) => e.stopPropagation()}
         className="max-w-[90vw] max-h-[80vh] rounded-2xl
                    object-contain" />
    <button
      onClick={(e) => { e.stopPropagation(); onSave(e) }}
      className="absolute bottom-8 left-1/2 -translate-x-1/2
                 bg-white text-gray-800 px-5 py-2.5 rounded-full
                 font-medium text-sm flex items-center gap-2
                 shadow-lg hover:bg-gray-50"
    >
      <Download size={16} /> Save to device
    </button>
  </div>
)

export default ImageLightbox
