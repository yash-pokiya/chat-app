import { useState, useEffect } from 'react';
import api from '../utils/api';

export const DEFAULT_QUICK_EMOJIS = ['❤️', '😂', '😮', '😢', '👍'];

const useQuickEmojis = (userId) => {
  const STORAGE_KEY = `quick_emojis_${userId}`;

  const [quickEmojis, setQuickEmojis] = useState(() => {
    // Load from localStorage first (instant, no flicker)
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_QUICK_EMOJIS;
    } catch {
      return DEFAULT_QUICK_EMOJIS;
    }
  });

  // Sync from server on mount:
  useEffect(() => {
    if (!userId) return;
    api.get('/users/quick-emojis')
      .then((res) => {
        if (res.data?.quickEmojis?.length === 5) {
          setQuickEmojis(res.data.quickEmojis);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(res.data.quickEmojis));
        }
      })
      .catch(() => {}); // silently fall back to localStorage/defaults
  }, [userId, STORAGE_KEY]);

  // Save new quick emojis:
  const saveQuickEmojis = async (emojis) => {
    if (emojis.length !== 5) return;
    setQuickEmojis(emojis);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(emojis));
    try {
      await api.put('/users/quick-emojis', { quickEmojis: emojis });
    } catch (err) {
      console.error('[QuickEmojis] Failed to save to database:', err);
    }
  };

  return { quickEmojis, saveQuickEmojis };
};

export default useQuickEmojis;
