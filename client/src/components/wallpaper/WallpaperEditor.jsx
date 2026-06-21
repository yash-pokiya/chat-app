import React from 'react';
import { useWallpaperStore } from '../../store/useWallpaperStore';
import { ArrowLeft, ArrowUp, ArrowDown, Sparkles } from 'lucide-react';
import ChatBackgroundView from '../ChatBackgroundView';

export default function WallpaperEditor({ dmId, onCancel }) {
  const {
    editorWallpaper,
    editorEffects,
    editorFeatures,
    setEditorEffects,
    setEditorFeatures,
    applyWallpaper,
  } = useWallpaperStore();

  if (!editorWallpaper) return null;

  const handleApply = async () => {
    const payload = {
      type: editorWallpaper.type || 'custom',
      presetId: editorWallpaper.type === 'preset' ? editorWallpaper.id : null,
      customUrl: editorWallpaper.type === 'custom' ? editorWallpaper.imageUrl : null,
      customCloudinaryId: editorWallpaper.type === 'custom' ? editorWallpaper.publicId : null,
      thumbnailUrl: editorWallpaper.type === 'custom' ? editorWallpaper.thumbnailUrl : null,
      effects: {
        ...editorEffects,
        parallax: editorFeatures.parallax,
        motion: editorFeatures.motion,
        scaleAnim: editorFeatures.scaleAnim,
      },
    };

    const success = await applyWallpaper(dmId, payload);
    if (success) {
      onCancel();
    }
  };

  // Map aspect ratio depending on cropMode selection
  const getAspectRatioClass = () => {
    switch (editorEffects.cropMode) {
      case '1:1': return 'aspect-square max-h-[220px]';
      case '4:5': return 'aspect-[4/5] max-h-[260px]';
      case '16:9': return 'aspect-[16/9] max-h-[160px]';
      case '9:16':
      default: return 'aspect-[9/16] max-h-[280px]';
    }
  };

  const shiftPosition = (dir) => {
    let { positionX, positionY } = editorEffects;
    if (dir === 'left') positionX = Math.max(0, positionX - 5);
    if (dir === 'right') positionX = Math.min(100, positionX + 5);
    if (dir === 'up') positionY = Math.max(0, positionY - 5);
    if (dir === 'down') positionY = Math.min(100, positionY + 5);
    setEditorEffects({ positionX, positionY });
  };

  // Mock background data for ChatBackgroundView preview
  const mockBackground = {
    type: editorWallpaper.type || 'custom',
    presetId: editorWallpaper.id,
    customUrl: editorWallpaper.imageUrl,
    effects: {
      ...editorEffects,
      parallax: editorFeatures.parallax,
      motion: editorFeatures.motion,
    },
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-1 max-h-[75vh] overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
      
      {/* Dual Device Preview Panel */}
      <div className="flex flex-col sm:flex-row lg:flex-col items-center justify-center gap-6 lg:w-[42%] flex-shrink-0 pb-6 lg:pb-0 lg:border-r border-gray-100 dark:border-gray-800 pr-0 lg:pr-6">
        
        {/* Mobile Preview Frame */}
        <div className="flex flex-col items-center flex-shrink-0">
          <div className={`relative ${getAspectRatioClass()} w-[140px] bg-gray-950 rounded-[24px] p-1.5 shadow-2xl border-4 border-gray-800 dark:border-gray-700 flex flex-col overflow-hidden transition-all duration-300`}>
            {/* Status Bar / Notch Mock */}
            <div className="absolute top-[3px] inset-x-0 h-3 flex justify-between px-3 z-20 text-[7px] font-semibold text-white/80 pointer-events-none">
              <span>9:41</span>
              <div className="w-12 h-2.5 bg-black rounded-full absolute left-1/2 -translate-x-1/2" />
              <span>100%</span>
            </div>

            {/* Wallpaper View inside Mockup */}
            <ChatBackgroundView background={mockBackground} />

            {/* Frosted header mock */}
            <div className="h-[24px] z-10 bg-white/85 dark:bg-gray-900/85 backdrop-blur-md border-b border-gray-150/40 dark:border-gray-800/40 flex items-center px-2 pt-[2px] text-[8px] font-bold text-gray-800 dark:text-gray-200">
              Preview
            </div>

            {/* Spacing container between top and bottom mock bars */}
            <div className="flex-1 z-10 p-2 min-h-0 select-none pointer-events-none" />

            {/* Input mock */}
            <div className="h-[26px] z-10 bg-white/85 dark:bg-gray-900/85 backdrop-blur-md border-t border-gray-150/40 dark:border-gray-800/40 flex items-center px-1.5 pb-0.5">
              <div className="flex-1 bg-gray-100 dark:bg-gray-850 rounded-full h-4 text-[7px] text-gray-400 flex items-center px-2">
                Type a message...
              </div>
            </div>
          </div>
          <span className="text-[10px] text-gray-400 mt-2 font-semibold uppercase tracking-wider dark:text-gray-500">
            Mobile Screen
          </span>
        </div>

        {/* Laptop Preview Frame */}
        <div className="flex flex-col items-center flex-shrink-0 w-[240px]">
          {/* Laptop Screen Bezel */}
          <div className="relative aspect-[16/10] w-full bg-gray-950 rounded-t-xl p-1.5 shadow-2xl border-4 border-b-0 border-gray-800 dark:border-gray-700 flex flex-col overflow-hidden transition-all duration-300">
            
            {/* Wallpaper View inside Mockup */}
            <ChatBackgroundView background={mockBackground} />

            {/* Laptop Header Bar (frosted with mac-style window controls) */}
            <div className="h-5 z-10 bg-white/85 dark:bg-gray-900/85 backdrop-blur-md border-b border-gray-150/40 dark:border-gray-800/40 flex items-center justify-between px-2 text-[7px] font-bold text-gray-800 dark:text-gray-200">
              {/* Window Controls */}
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              </div>
              <span className="text-[7px] text-gray-450 font-medium dark:text-gray-400">Desktop Room</span>
              <div className="w-6" /> {/* spacer */}
            </div>

            {/* Spacing container between top and bottom mock bars */}
            <div className="flex-1 z-10 p-2 min-h-0 select-none pointer-events-none" />

            {/* Laptop Input Mock */}
            <div className="h-[22px] z-10 bg-white/85 dark:bg-gray-900/85 backdrop-blur-md border-t border-gray-150/40 dark:border-gray-800/40 flex items-center px-2 pb-0.5">
              <div className="flex-1 bg-gray-100 dark:bg-gray-850 rounded h-[14px] text-[7px] text-gray-400 flex items-center px-1.5">
                Write a message...
              </div>
            </div>
          </div>

          {/* Laptop Hinge & Keyboard Base */}
          <div className="w-[108%] h-[6px] bg-gray-800 dark:bg-gray-700 rounded-b-md relative shadow-lg">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-gray-900/30 rounded-b-[1px]" />
          </div>
          <span className="text-[10px] text-gray-400 mt-2 font-semibold uppercase tracking-wider dark:text-gray-500">
            Laptop Screen
          </span>
        </div>

      </div>

      {/* Adjustments & Controls Panel */}
      <div className="flex-1 space-y-4">
        
        {/* Top heading */}
        <div className="flex items-center gap-2">
          <button 
            onClick={onCancel}
            className="p-1 rounded-lg hover:bg-gray-105 dark:hover:bg-gray-800 text-gray-500"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="font-bold text-gray-800 dark:text-gray-200 text-sm">
            Adjusting: "{editorWallpaper.name || editorWallpaper.label || 'Wallpaper'}"
          </span>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Blur Slider */}
          <div className="space-y-1 bg-gray-50 dark:bg-gray-850 p-2.5 rounded-xl border border-gray-155 dark:border-gray-800">
            <div className="flex justify-between font-semibold text-gray-700 dark:text-gray-350">
              <span>Blur Effect</span>
              <span className="text-violet-500">{editorEffects.blur || 0}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={0.1}
              value={editorEffects.blur || 0}
              onChange={(e) => setEditorEffects({ blur: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
            />
          </div>

          {/* Dimming Slider */}
          <div className="space-y-1 bg-gray-50 dark:bg-gray-850 p-2.5 rounded-xl border border-gray-155 dark:border-gray-800">
            <div className="flex justify-between font-semibold text-gray-700 dark:text-gray-350">
              <span>Dimming (Darkness)</span>
              <span className="text-violet-500">{editorEffects.dimming || 0}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={80}
              value={editorEffects.dimming || 0}
              onChange={(e) => setEditorEffects({ dimming: parseInt(e.target.value, 10) })}
              className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
            />
          </div>

          {/* Brightness Slider */}
          <div className="space-y-1 bg-gray-50 dark:bg-gray-850 p-2.5 rounded-xl border border-gray-155 dark:border-gray-800">
            <div className="flex justify-between font-semibold text-gray-700 dark:text-gray-355">
              <span>Brightness</span>
              <span className="text-violet-500">{editorEffects.brightness ?? 100}%</span>
            </div>
            <input
              type="range"
              min={50}
              max={150}
              value={editorEffects.brightness ?? 100}
              onChange={(e) => setEditorEffects({ brightness: parseInt(e.target.value, 10) })}
              className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
            />
          </div>

          {/* Contrast Slider */}
          <div className="space-y-1 bg-gray-50 dark:bg-gray-850 p-2.5 rounded-xl border border-gray-155 dark:border-gray-800">
            <div className="flex justify-between font-semibold text-gray-700 dark:text-gray-355">
              <span>Contrast</span>
              <span className="text-violet-500">{editorEffects.contrast ?? 100}%</span>
            </div>
            <input
              type="range"
              min={50}
              max={150}
              value={editorEffects.contrast ?? 100}
              onChange={(e) => setEditorEffects({ contrast: parseInt(e.target.value, 10) })}
              className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
            />
          </div>

          {/* Zoom Slider */}
          <div className="space-y-1 bg-gray-50 dark:bg-gray-850 p-2.5 rounded-xl border border-gray-155 dark:border-gray-800">
            <div className="flex justify-between font-semibold text-gray-700 dark:text-gray-350">
              <span>Zoom Scale</span>
              <span className="text-violet-500">{editorEffects.zoom || 1}x</span>
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={editorEffects.zoom || 1}
              onChange={(e) => setEditorEffects({ zoom: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
            />
          </div>

          {/* Crop Modes */}
          <div className="space-y-1 bg-gray-50 dark:bg-gray-850 p-2.5 rounded-xl border border-gray-155 dark:border-gray-800 flex flex-col justify-between">
            <span className="font-semibold text-gray-700 dark:text-gray-300 block mb-1">
              Crop Ratio
            </span>
            <div className="flex gap-1.5 flex-wrap">
              {['free', '1:1', '4:5', '16:9'].map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setEditorEffects({ cropMode: ratio })}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${
                    editorEffects.cropMode === ratio
                      ? 'bg-violet-500 text-white shadow-sm'
                      : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-750 text-gray-600 dark:text-gray-350 hover:bg-gray-105'
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Position D-Pad Controls */}
        <div className="bg-gray-50 dark:bg-gray-850 p-3 rounded-xl border border-gray-155 dark:border-gray-800 flex items-center justify-between gap-4">
          <div className="text-xs">
            <span className="font-semibold text-gray-700 dark:text-gray-350 block">
              Image Positioning
            </span>
            <span className="text-[10px] text-gray-400">
              Center: X={editorEffects.positionX}%, Y={editorEffects.positionY}%
            </span>
          </div>
          
          {/* Navigation D-Pad */}
          <div className="flex flex-col items-center flex-shrink-0">
            <button 
              onClick={() => shiftPosition('up')}
              className="w-7 h-7 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-750 rounded-full flex items-center justify-center hover:bg-gray-100"
            >
              <ArrowUp size={12} className="text-gray-600 dark:text-gray-350" />
            </button>
            <div className="flex gap-3 my-0.5">
              <button 
                onClick={() => shiftPosition('left')}
                className="w-7 h-7 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-750 rounded-full flex items-center justify-center hover:bg-gray-100"
              >
                <ArrowLeft size={12} className="text-gray-600 dark:text-gray-350" />
              </button>
              <div className="w-7 h-7 flex items-center justify-center text-[10px] font-bold text-gray-400">
                XY
              </div>
              <button 
                onClick={() => shiftPosition('right')}
                className="w-7 h-7 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-750 rounded-full flex items-center justify-center hover:bg-gray-100"
              >
                <ArrowLeft size={12} className="text-gray-600 dark:text-gray-350 rotate-180" />
              </button>
            </div>
            <button 
              onClick={() => shiftPosition('down')}
              className="w-7 h-7 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-750 rounded-full flex items-center justify-center hover:bg-gray-100"
            >
              <ArrowDown size={12} className="text-gray-600 dark:text-gray-350" />
            </button>
          </div>
        </div>

        {/* Premium Features Checklist */}
        <div className="bg-violet-50/50 dark:bg-violet-950/10 p-3 rounded-xl border border-violet-100 dark:border-violet-900/30 text-xs">
          <span className="font-semibold text-violet-700 dark:text-violet-400 flex items-center gap-1.5 mb-2">
            <Sparkles size={14} className="fill-violet-300 text-violet-500" /> Premium Motion Features
          </span>
          <div className="grid grid-cols-2 gap-3 font-medium text-gray-600 dark:text-gray-300">
            <label className="flex items-center gap-2 cursor-pointer hover:text-violet-600 select-none">
              <input
                type="checkbox"
                checked={editorFeatures.parallax}
                onChange={(e) => setEditorFeatures({ parallax: e.target.checked })}
                className="w-4 h-4 rounded text-violet-600 focus:ring-violet-400 border-gray-300 dark:border-gray-750"
              />
              Hover Parallax (Desktop)
            </label>
            <label className="flex items-center gap-2 cursor-pointer hover:text-violet-600 select-none">
              <input
                type="checkbox"
                checked={editorFeatures.motion}
                onChange={(e) => setEditorFeatures({ motion: e.target.checked })}
                className="w-4 h-4 rounded text-violet-600 focus:ring-violet-400 border-gray-300 dark:border-gray-750"
              />
              Gyroscope Motion (Mobile)
            </label>
          </div>
        </div>

        {/* Apply & Action Buttons */}
        <div className="flex gap-2.5 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-semibold transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="flex-[2] py-2 bg-gradient-to-r from-violet-600 to-cyan-500 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-lg shadow-violet-100 dark:shadow-none transition-all"
          >
            Apply Wallpaper
          </button>
        </div>

      </div>

    </div>
  );
}
