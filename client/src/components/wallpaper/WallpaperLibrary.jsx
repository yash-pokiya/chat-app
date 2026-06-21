import React, { useState, useEffect, useRef } from 'react';
import { useWallpaperStore } from '../../store/useWallpaperStore';
import { Heart, Trash2, Edit3, MoreVertical, Upload } from 'lucide-react';

export default function WallpaperLibrary({ dmId, onSelectWallpaper }) {
  const {
    wallpapers,
    loading,
    uploading,
    uploadProgress,
    fetchWallpapers,
    uploadWallpaper,
    toggleFavorite,
    renameWallpaper,
    deleteWallpaper,
  } = useWallpaperStore();

  const fileInputRef = useRef(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [renameId, setRenameId] = useState(null);
  const [newName, setNewName] = useState('');
  const menuRef = useRef(null);

  useEffect(() => {
    fetchWallpapers();
  }, []);

  // Handle outside clicks to close the context menus
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const uploaded = await uploadWallpaper(file, dmId);
    if (uploaded) {
      onSelectWallpaper(uploaded);
    }
  };

  const handleRenameSubmit = async (id) => {
    if (!newName.trim()) return;
    await renameWallpaper(id, newName);
    setRenameId(null);
    setNewName('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          Your Saved Wallpapers
        </h4>
      </div>

      {loading && wallpapers.length === 0 ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {/* Upload Card */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="h-28 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-violet-400 dark:hover:border-violet-600 transition-all flex flex-col items-center justify-center gap-1.5 text-gray-500 dark:text-gray-400 disabled:opacity-50"
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                <span className="text-[10px] font-bold text-violet-500">{uploadProgress}%</span>
              </div>
            ) : (
              <>
                <Upload size={20} />
                <span className="text-xs font-semibold">Upload Wallpaper</span>
              </>
            )}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleUpload}
            />
          </button>

          {/* Saved Wallpapers Grid */}
          {wallpapers.map((wp) => {
            const isMenuOpen = activeMenuId === wp._id;
            const isRenaming = renameId === wp._id;

            return (
              <div
                key={wp._id}
                className="relative h-28 rounded-xl overflow-hidden border border-gray-250 dark:border-gray-800 shadow-sm group hover:scale-[1.02] hover:shadow-md transition-all select-none"
              >
                {/* Image */}
                <img
                  src={wp.thumbnailUrl}
                  alt={wp.name}
                  onClick={() => !isRenaming && onSelectWallpaper(wp)}
                  className="w-full h-full object-cover cursor-pointer"
                />

                {/* Favorite Toggle Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(wp._id);
                  }}
                  className="absolute top-1.5 left-1.5 z-10 w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                >
                  <Heart
                    size={13}
                    className={wp.isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-300'}
                  />
                </button>

                {/* Dropdown Options Button */}
                <div className="absolute top-1.5 right-1.5 z-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(isMenuOpen ? null : wp._id);
                    }}
                    className="w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                  >
                    <MoreVertical size={13} />
                  </button>

                  {/* Context Menu */}
                  {isMenuOpen && (
                    <div
                      ref={menuRef}
                      className="absolute right-0 mt-1 w-28 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-150 dark:border-gray-700 py-1 z-20 text-xs text-gray-700 dark:text-gray-200"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameId(wp._id);
                          setNewName(wp.name);
                          setActiveMenuId(null);
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-750 flex items-center gap-1.5"
                      >
                        <Edit3 size={11} className="flex-shrink-0" /> Rename
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Delete this wallpaper?')) {
                            deleteWallpaper(wp._id);
                          }
                          setActiveMenuId(null);
                        }}
                        className="w-full px-3 py-1.5 text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-1.5"
                      >
                        <Trash2 size={11} className="flex-shrink-0" /> Delete
                      </button>
                    </div>
                  )}
                </div>

                {/* Rename Mode Panel */}
                {isRenaming ? (
                  <div className="absolute inset-0 bg-black/85 flex flex-col justify-between p-2 z-10">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameSubmit(wp._id);
                        if (e.key === 'Escape') setRenameId(null);
                      }}
                      autoFocus
                      className="w-full text-xs font-semibold px-1.5 py-1 text-white bg-gray-900 border border-gray-700 rounded outline-none focus:border-violet-500"
                    />
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => setRenameId(null)}
                        className="px-2 py-0.5 rounded bg-gray-700 text-[10px] text-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleRenameSubmit(wp._id)}
                        className="px-2 py-0.5 rounded bg-violet-500 text-[10px] text-white font-semibold"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Info Overlay */
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-1.5 flex flex-col justify-end pointer-events-none">
                    <p className="text-[10px] font-medium text-white truncate text-center">
                      {wp.name}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
