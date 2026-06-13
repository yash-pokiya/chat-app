import { useRef, useState } from 'react';
import { ReactSketchCanvas } from 'react-sketch-canvas';
import { X } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const COLORS = ['#1A1A2E', '#6C63FF', '#EF4444', '#10B981', '#F59E0B', '#FFFFFF'];

export default function DrawingCanvas({ onSend, onClose, dmId, roomCode }) {
  const canvasRef = useRef(null);
  const [color, setColor] = useState('#1A1A2E');
  const [size, setSize] = useState(4);
  const [erasing, setErasing] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      const dataUrl = await canvasRef.current.exportImage('png');
      // Convert dataUrl to Blob
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      const formData = new FormData();
      formData.append('image', blob, 'sketch.png');
      if (dmId) formData.append('dmId', dmId);
      if (roomCode) formData.append('roomCode', roomCode);

      const { data } = await api.post('/chat/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (data.success) {
        onSend(data.url, data.cloudinaryId);
        onClose();
      } else {
        toast.error('Failed to send sketch.');
      }
    } catch (err) {
      toast.error('Failed to send sketch.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-[9998] flex flex-col">
      {/* Top bar */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <button onClick={onClose} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 transition-colors">
          <X size={18} /> Cancel
        </button>
        <p className="font-bold text-sm text-gray-900">✏️ Draw & Send</p>
        <button
          onClick={handleSend}
          disabled={sending}
          className="bg-gradient-to-r from-violet-500 to-cyan-400 text-white text-sm px-4 py-1.5 rounded-full font-medium shadow-md hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {sending ? 'Sending...' : 'Send ↑'}
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden">
        <ReactSketchCanvas
          ref={canvasRef}
          style={{ flex: 1, border: 'none', width: '100%', height: '100%' }}
          strokeColor={erasing ? '#FFFFFF' : color}
          strokeWidth={size}
          eraserWidth={size * 3}
          canvasColor="#FFFFFF"
          withTimestamp={false}
        />
      </div>

      {/* Bottom toolbar */}
      <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-white flex-shrink-0 gap-4">
        {/* Color swatches */}
        <div className="flex gap-2 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { setColor(c); setErasing(false); }}
              style={{ backgroundColor: c }}
              className={`w-7 h-7 rounded-full border-2 transition-transform ${
                color === c && !erasing ? 'border-violet-500 scale-125' : 'border-gray-300'
              }`}
            />
          ))}
        </div>

        {/* Size slider */}
        <input
          type="range" min={2} max={20} value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="w-20 accent-violet-500"
        />

        {/* Eraser + undo + clear */}
        <div className="flex gap-2">
          <button
            onClick={() => setErasing(!erasing)}
            className={`p-2 rounded-xl text-sm transition-colors ${erasing ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-600'}`}
          >
            🧹
          </button>
          <button
            onClick={() => canvasRef.current?.undo()}
            className="p-2 rounded-xl bg-gray-100 text-gray-600 text-sm"
          >
            ↩️
          </button>
          <button
            onClick={() => canvasRef.current?.clearCanvas()}
            className="p-2 rounded-xl bg-gray-100 text-gray-600 text-sm"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}
