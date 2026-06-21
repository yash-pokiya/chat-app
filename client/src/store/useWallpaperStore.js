import { create } from 'zustand';
import api from '../utils/api';
import toast from 'react-hot-toast';

let effectsDebounceTimeout = null;

export const useWallpaperStore = create((set, get) => ({
  wallpapers: [],
  loading: false,
  uploading: false,
  uploadProgress: 0,
  activeBackground: null,
  
  // Editor state
  editorWallpaper: null, // preset or custom wallpaper being edited
  editorEffects: {
    blur: 0,
    dimming: 0,
    brightness: 100,
    contrast: 100,
    zoom: 1,
    positionX: 50,
    positionY: 50,
    cropMode: 'free',
  },
  editorFeatures: {
    parallax: false,
    motion: false,
    scaleAnim: true,
  },

  // Actions
  fetchWallpapers: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get('/wallpapers');
      if (data.success) {
        set({ wallpapers: data.wallpapers });
      }
    } catch (err) {
      console.error('Failed to load wallpaper library:', err);
    } finally {
      set({ loading: false });
    }
  },

  uploadWallpaper: async (file, dmId) => {
    set({ uploading: true, uploadProgress: 0 });
    const formData = new FormData();
    formData.append('image', file);

    try {
      const { data } = await api.post('/wallpapers/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            set({ uploadProgress: Math.round((progressEvent.loaded / progressEvent.total) * 100) });
          }
        },
      });

      if (data.success) {
        // If it was already in library (duplicate upload protection)
        if (data.isDuplicate) {
          toast.success('Image already in library!');
        } else {
          toast.success('Wallpaper uploaded!');
        }
        
        // Refresh wallpapers list
        await get().fetchWallpapers();
        
        set({ uploading: false, uploadProgress: 0 });
        return data.wallpaper;
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
      set({ uploading: false, uploadProgress: 0 });
    }
    return null;
  },

  renameWallpaper: async (id, name) => {
    try {
      const { data } = await api.put(`/wallpapers/${id}/rename`, { name });
      if (data.success) {
        set((state) => ({
          wallpapers: state.wallpapers.map((w) => (w._id === id ? data.wallpaper : w)),
        }));
        toast.success('Wallpaper renamed');
      }
    } catch (err) {
      toast.error('Rename failed');
    }
  },

  toggleFavorite: async (id) => {
    try {
      const { data } = await api.put(`/wallpapers/${id}/favorite`);
      if (data.success) {
        set((state) => ({
          wallpapers: state.wallpapers.map((w) => (w._id === id ? data.wallpaper : w)),
        }));
        // Re-sort wallpapers
        const sorted = [...get().wallpapers].sort((a, b) => {
          if (a._id === id) return b.isFavorite ? 1 : -1;
          if (b._id === id) return a.isFavorite ? -1 : 1;
          return 0;
        });
        set({ wallpapers: sorted });
      }
    } catch (err) {
      console.error(err);
    }
  },

  deleteWallpaper: async (id) => {
    try {
      const { data } = await api.delete(`/wallpapers/${id}`);
      if (data.success) {
        set((state) => ({
          wallpapers: state.wallpapers.filter((w) => w._id !== id),
        }));
        toast.success('Wallpaper deleted from library');
      }
    } catch (err) {
      toast.error('Failed to delete wallpaper');
    }
  },

  // Apply a selected wallpaper preset/custom to current chat
  applyWallpaper: async (dmId, payload) => {
    try {
      const { data } = await api.put(`/dm/${dmId}/background`, payload);
      if (data.success) {
        set({ activeBackground: data.background });
        toast.success('Wallpaper applied for both of you');
        return data.background;
      }
    } catch (err) {
      toast.error('Failed to apply wallpaper');
    }
    return null;
  },

  // Update effects dynamically (with debounce for backend synchronizations)
  setEditorEffects: (effects) => {
    set((state) => ({
      editorEffects: { ...state.editorEffects, ...effects },
    }));
  },

  setEditorFeatures: (features) => {
    set((state) => ({
      editorFeatures: { ...state.editorFeatures, ...features },
    }));
  },

  syncEffectsToBackend: (dmId, effects) => {
    // 1. Update store state instantly for local client responsiveness
    set((state) => {
      if (state.activeBackground) {
        return {
          activeBackground: {
            ...state.activeBackground,
            effects: {
              ...state.activeBackground.effects,
              ...effects,
            },
          },
        };
      }
      return {};
    });

    // 2. Debounce HTTP PUT request to backend to avoid request floods
    if (effectsDebounceTimeout) {
      clearTimeout(effectsDebounceTimeout);
    }

    effectsDebounceTimeout = setTimeout(async () => {
      try {
        await api.put(`/dm/${dmId}/background/effects`, { effects });
      } catch (err) {
        console.error('[Wallpaper Store] Failed to sync effects to backend:', err);
      }
    }, 250);
  },

  setEditorWallpaper: (wallpaper) => {
    if (wallpaper) {
      const effects = wallpaper.effects || {
        blur: 0,
        dimming: 0,
        brightness: 100,
        contrast: 100,
        zoom: 1,
        positionX: 50,
        positionY: 50,
        cropMode: 'free',
      };
      set({
        editorWallpaper: wallpaper,
        editorEffects: effects,
        editorFeatures: {
          parallax: effects.parallax ?? false,
          motion: effects.motion ?? false,
          scaleAnim: effects.scaleAnim ?? true,
        },
      });
    } else {
      set({ editorWallpaper: null });
    }
  },

  setActiveBackground: (bg) => {
    set({ activeBackground: bg });
  },
}));
