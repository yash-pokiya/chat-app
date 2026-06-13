import { useState, useRef } from 'react';
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react';

export default function MediaUpload({ onUpload, onClose }) {
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSend = async () => {
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file);
      onClose();
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith('image/')) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  };

  return (
    <div className="mb-2 glass rounded-xl p-3">
      {preview ? (
        <div className="flex items-center gap-3">
          <img src={preview} alt="Preview" className="w-16 h-16 object-cover rounded-lg shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-300 truncate">{file?.name}</p>
            <p className="text-xs text-gray-500">{(file?.size / 1024).toFixed(1)} KB</p>
          </div>
          <button onClick={() => { setPreview(null); setFile(null); }} className="text-gray-500 hover:text-red-400 transition-colors">
            <X size={16} />
          </button>
          <button onClick={handleSend} disabled={uploading} className="btn-primary text-sm px-4 py-2">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : 'Send'}
          </button>
        </div>
      ) : (
        <div
          className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center cursor-pointer hover:border-violet-500 transition-colors"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
        >
          <ImageIcon size={24} className="text-gray-500 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Drag & drop or <span className="text-violet-400 font-medium">browse</span></p>
          <p className="text-xs text-gray-600 mt-1">JPEG, PNG, GIF, WebP — max 5MB</p>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>
      )}
    </div>
  );
}
