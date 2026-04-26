import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type LoopMode = 'off' | 'one' | 'all';

export interface MediaItem {
  id: string;
  url: string;
  platform: 'youtube' | 'spotify';
  type: string;
  embed_url: string;
  added_at: string;
  favorite?: boolean;
  title?: string;
  thumbnail?: string;
}

type PlayerSource = 'library' | 'search' | 'external';

interface MediaPlayerContextValue {
  library: MediaItem[];
  queue: MediaItem[];
  activeMedia: MediaItem | null;
  isPlaying: boolean;
  positionSeconds: number;
  volume: number;
  loop: LoopMode;
  source: PlayerSource;
  addToLibrary: (item: MediaItem) => void;
  removeMedia: (id: string) => void;
  toggleFavorite: (id: string) => void;
  playMedia: (item: MediaItem, source?: PlayerSource) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setPositionSeconds: (positionSeconds: number) => void;
  setVolume: (volume: number) => void;
  setLoop: (loop: LoopMode) => void;
  playNext: () => void;
  playPrevious: () => void;
  clearActiveMedia: () => void;
}

const LIBRARY_KEY = 'gqth_media_library';
const PLAYER_KEY = 'gqth_global_media_player';

const MediaPlayerContext = createContext<MediaPlayerContextValue | null>(null);

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function migrateLoop(raw: unknown): LoopMode {
  if (raw === true) return 'all';
  if (raw === false || raw == null) return 'off';
  if (raw === 'off' || raw === 'one' || raw === 'all') return raw;
  return 'off';
}

export function MediaPlayerProvider({ children }: { children: React.ReactNode }) {
  const [library, setLibrary] = useState<MediaItem[]>(() => loadJson<MediaItem[]>(LIBRARY_KEY, []));
  const [activeMedia, setActiveMedia] = useState<MediaItem | null>(() => loadJson<{ activeMedia: MediaItem | null }>(PLAYER_KEY, { activeMedia: null }).activeMedia);
  const [isPlaying, setIsPlaying] = useState(() => loadJson(PLAYER_KEY, { isPlaying: false }).isPlaying ?? false);
  const [positionSeconds, setPositionSeconds] = useState(() => loadJson(PLAYER_KEY, { positionSeconds: 0 }).positionSeconds ?? 0);
  const [volume, setVolumeState] = useState(() => loadJson(PLAYER_KEY, { volume: 80 }).volume ?? 80);
  const [loop, setLoop] = useState<LoopMode>(() => migrateLoop(loadJson<{ loop: unknown }>(PLAYER_KEY, { loop: 'off' }).loop));
  const [source, setSource] = useState<PlayerSource>(() => loadJson(PLAYER_KEY, { source: 'library' as PlayerSource }).source ?? 'library');

  const queue = useMemo(() => {
    const favorites = library.filter(item => item.favorite);
    const regular = library.filter(item => !item.favorite);
    return [...favorites, ...regular];
  }, [library]);

  useEffect(() => {
    saveJson(LIBRARY_KEY, library);
  }, [library]);

  useEffect(() => {
    saveJson(PLAYER_KEY, {
      activeMedia,
      isPlaying,
      positionSeconds,
      volume,
      queue: queue.map(item => item.id),
      loop,
      source,
    });
  }, [activeMedia, isPlaying, positionSeconds, volume, queue, loop, source]);

  useEffect(() => {
    if (!isPlaying || !activeMedia) return;
    const timer = window.setInterval(() => {
      setPositionSeconds(current => current + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isPlaying, activeMedia]);

  const addToLibrary = (item: MediaItem) => {
    setLibrary(prev => prev.some(existing => existing.embed_url === item.embed_url) ? prev : [item, ...prev]);
  };

  const playMedia = (item: MediaItem, nextSource: PlayerSource = 'library') => {
    setLibrary(prev => prev.some(existing => existing.embed_url === item.embed_url) ? prev : [item, ...prev]);
    setActiveMedia(current => {
      if (current?.id !== item.id) setPositionSeconds(0);
      return item;
    });
    setSource(nextSource);
    setIsPlaying(true);
  };

  const removeMedia = (id: string) => {
    setLibrary(prev => prev.filter(item => item.id !== id));
    setActiveMedia(current => current?.id === id ? null : current);
  };

  const toggleFavorite = (id: string) => {
    setLibrary(prev => prev.map(item => item.id === id ? { ...item, favorite: !item.favorite } : item));
  };

  const playNext = () => {
    if (!activeMedia || queue.length === 0) return;
    if (loop === 'one') {
      setPositionSeconds(0);
      setIsPlaying(true);
      return;
    }
    const currentIndex = queue.findIndex(item => item.id === activeMedia.id);
    const nextIndex = currentIndex + 1;
    if (nextIndex < queue.length) {
      playMedia(queue[nextIndex]);
    } else if (loop === 'all') {
      playMedia(queue[0]);
    } else {
      setIsPlaying(false);
    }
  };

  const playPrevious = () => {
    if (!activeMedia || queue.length === 0) return;
    if (positionSeconds > 5) {
      setPositionSeconds(0);
      return;
    }
    const currentIndex = queue.findIndex(item => item.id === activeMedia.id);
    if (currentIndex > 0) {
      playMedia(queue[currentIndex - 1]);
    } else if (loop === 'all') {
      playMedia(queue[queue.length - 1]);
    } else {
      setPositionSeconds(0);
    }
  };

  const setVolume = (nextVolume: number) => {
    setVolumeState(Math.max(0, Math.min(100, nextVolume)));
  };

  const clearActiveMedia = () => {
    setIsPlaying(false);
    setPositionSeconds(0);
    setActiveMedia(null);
  };

  const value: MediaPlayerContextValue = {
    library,
    queue,
    activeMedia,
    isPlaying,
    positionSeconds,
    volume,
    loop,
    source,
    addToLibrary,
    removeMedia,
    toggleFavorite,
    playMedia,
    setIsPlaying,
    setPositionSeconds,
    setVolume,
    setLoop,
    playNext,
    playPrevious,
    clearActiveMedia,
  };

  return <MediaPlayerContext.Provider value={value}>{children}</MediaPlayerContext.Provider>;
}

export function useMediaPlayer() {
  const value = useContext(MediaPlayerContext);
  if (!value) throw new Error('useMediaPlayer must be used inside MediaPlayerProvider');
  return value;
}
