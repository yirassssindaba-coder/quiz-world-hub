const STORAGE_KEY = 'gqth_news_bookmarks';

export interface SavedItem {
  id: string;
  type: 'article' | 'job';
  saved_at: string;
  title: string;
  summary: string;
  source: string;
  source_url: string;
  published_date: string;
  category: string;
  tags: string[];
  is_urgent: boolean;
  is_job: boolean;
  image_url?: string;
}

function generateId(url: string): string {
  return btoa(url).replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
}

export function getBookmarks(): SavedItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedItem[];
  } catch {
    return [];
  }
}

export function isBookmarked(url: string): boolean {
  const id = generateId(url);
  return getBookmarks().some(b => b.id === id);
}

export function addBookmark(item: Omit<SavedItem, 'id' | 'saved_at'>): void {
  const bookmarks = getBookmarks();
  const id = generateId(item.source_url);
  if (bookmarks.some(b => b.id === id)) return;
  const newItem: SavedItem = { ...item, id, saved_at: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([newItem, ...bookmarks]));
}

export function removeBookmark(url: string): void {
  const id = generateId(url);
  const bookmarks = getBookmarks().filter(b => b.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
}

export function toggleBookmark(item: Omit<SavedItem, 'id' | 'saved_at'>): boolean {
  if (isBookmarked(item.source_url)) {
    removeBookmark(item.source_url);
    return false;
  } else {
    addBookmark(item);
    return true;
  }
}
