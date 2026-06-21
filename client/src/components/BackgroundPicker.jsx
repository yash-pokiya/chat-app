import React, { useState, useEffect } from 'react';
import { Palette, X, Image, Grid } from 'lucide-react';
import { BACKGROUND_PRESETS } from '../constants/chatBackgrounds';
import WallpaperLibrary from './wallpaper/WallpaperLibrary';
import WallpaperEditor from './wallpaper/WallpaperEditor';
import { useWallpaperStore } from '../store/useWallpaperStore';

export default function BackgroundPicker({ dmId, currentBackground, onClose, onUpdate }) {
  const [tab, setTab] = useState('presets'); // 'presets' | 'library' | 'editor'
  
  const {
    editorWallpaper,
    setEditorWallpaper,
    setActiveBackground,
    fetchWallpapers,
    applyWallpaper,
  } = useWallpaperStore();

  useEffect(() => {
    if (currentBackground) {
      setActiveBackground(currentBackground);
    }
    fetchWallpapers();
  }, [currentBackground]);

  const isDarkMode = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');

  const handleSelectPreset = async (preset) => {
    const payload = {
      type: 'preset',
      presetId: preset.id,
      customUrl: null,
      customCloudinaryId: null,
      thumbnailUrl: null,
      effects: {
        blur: 0,
        dimming: 0,
        brightness: 100,
        contrast: 100,
        zoom: 1,
        positionX: 50,
        positionY: 50,
        cropMode: 'free',
        parallax: false,
        motion: false,
        scaleAnim: true,
      },
    };
    const success = await applyWallpaper(dmId, payload);
    if (success) {
      onClose();
    }
  };

  const handleSelectCustom = (wp) => {
    const isActive = currentBackground?.type === 'custom' && 
      (currentBackground?.customUrl === wp.imageUrl || currentBackground?.customCloudinaryId === wp.publicId);
    setEditorWallpaper({
      ...wp,
      type: 'custom',
      effects: isActive ? currentBackground.effects : wp.effects,
    });
    setTab('editor');
  };

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-end justify-center select-none">
      {/* Backdrop tap to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer content */}
      <div className="relative bg-white dark:bg-gray-900 w-full max-w-2xl rounded-t-3xl p-5 sm:p-6 shadow-2xl max-h-[85vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))] border-t border-gray-100 dark:border-gray-800 transition-all duration-300">
        
        {/* Header Row */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Palette size={19} className="text-violet-500" />
            <h3 className="font-bold text-[16px] text-gray-900 dark:text-gray-100">
              {tab === 'editor' ? 'Adjust Wallpaper' : 'Chat Wallpaper'}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tab Controls (only shown when not in Editor mode) */}
        {tab !== 'editor' && (
          <div className="flex gap-2 border-b border-gray-100 dark:border-gray-800 pb-3 mb-4 flex-shrink-0">
            <button
              onClick={() => setTab('presets')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                tab === 'presets'
                  ? 'bg-violet-500 text-white shadow-md shadow-violet-100 dark:shadow-none'
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-605 dark:text-gray-400 hover:bg-gray-100'
              }`}
            >
              <Grid size={14} /> Preset Themes
            </button>
            <button
              onClick={() => setTab('library')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                tab === 'library'
                  ? 'bg-violet-500 text-white shadow-md shadow-violet-100 dark:shadow-none'
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-605 dark:text-gray-400 hover:bg-gray-100'
              }`}
            >
              <Image size={14} /> My Wallpapers
            </button>
          </div>
        )}

        {/* Tab Content mount */}
        <div className="min-h-0">
          {tab === 'presets' && (
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Select a preset theme to adjust effects
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {BACKGROUND_PRESETS.map((preset) => {
                  const presetStyle = isDarkMode ? preset.darkStyle : preset.style;
                  const isActive = currentBackground?.type === 'preset' && currentBackground?.presetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset)}
                      style={presetStyle}
                      className={`relative h-20 rounded-xl border-2 flex items-center justify-center transition-all overflow-hidden hover:scale-[1.02] active:scale-[0.98] ${
                        isActive
                          ? 'border-violet-500 ring-2 ring-violet-200 dark:ring-violet-900/40 shadow-sm'
                          : 'border-gray-200 dark:border-gray-800 hover:border-violet-300'
                      }`}
                    >
                      <span className="text-[10px] font-bold text-gray-800 dark:text-gray-200 bg-white/90 dark:bg-gray-800/90 px-2 py-0.5 rounded-full shadow-sm">
                        {preset.label}
                      </span>
                      {isActive && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-violet-500 rounded-full flex items-center justify-center text-white text-[9px] font-bold">
                          ✓
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'library' && (
            <WallpaperLibrary 
              dmId={dmId} 
              onSelectWallpaper={handleSelectCustom} 
            />
          )}

          {tab === 'editor' && (
            <WallpaperEditor 
              dmId={dmId} 
              onCancel={() => setTab(editorWallpaper.type === 'preset' ? 'presets' : 'library')}
              onUpdate={onUpdate}
            />
          )}
        </div>

      </div>
    </div>
  );
}
