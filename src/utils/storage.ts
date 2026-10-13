import { AppState, UserProfile } from '../types';

export const STORAGE_KEY = 'pharmacore_pro_v1';
export const PROFILE_KEY = `${STORAGE_KEY}_owner_profile`;
export const AUTH_KEY = `${STORAGE_KEY}_authenticated`;
export const ACTIVE_USER_KEY = `${STORAGE_KEY}_active_user`;
export const TEAM_USERS_KEY = `${STORAGE_KEY}_team_users`;
export const REMINDER_KEY = `${STORAGE_KEY}_reminder`;

const DB_NAME = 'PharmaCoreProStorage';
const DB_STORE = 'workspace';
const DB_KEY = 'main';

export const defaultState = (): AppState => ({
  settings: {
    name: '',
    currency: 'NGN',
    defaultMin: 0,
    reminders: false,
    expiryWarnings: true,
  },
  products: [],
  sales: [],
  activity: [],
  importedFiles: [],
  dailySales: [],
});

let storageDb: IDBDatabase | null = null;

export function openStorageDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    if (storageDb) {
      resolve(storageDb);
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    req.onsuccess = () => {
      storageDb = req.result;
      resolve(storageDb);
    };
    req.onerror = () => reject(req.error || new Error('Could not open persistent storage'));
  });
}

export function idbWrite(snapshot: AppState): Promise<void> {
  return openStorageDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put({ savedAt: Date.now(), data: snapshot }, DB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('Storage write failed'));
        tx.onabort = () => reject(tx.error || new Error('Storage write aborted'));
      })
  );
}

export function idbRead(): Promise<{ savedAt: number; data: AppState } | null> {
  return openStorageDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const req = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(DB_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error || new Error('Storage read failed'));
      })
  );
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      settings: parsed.settings || defaultState().settings,
      products: Array.isArray(parsed.products) ? parsed.products : [],
      sales: Array.isArray(parsed.sales) ? parsed.sales : [],
      activity: Array.isArray(parsed.activity) ? parsed.activity : [],
      importedFiles: Array.isArray(parsed.importedFiles) ? parsed.importedFiles : [],
      dailySales: Array.isArray(parsed.dailySales) ? parsed.dailySales : [],
    };
  } catch (e) {
    console.warn('Failed to parse state from localStorage', e);
    return defaultState();
  }
}

export function saveState(state: AppState): void {
  try {
    const raw = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, raw);
  } catch (e) {
    console.warn('localStorage save failed', e);
  }
  idbWrite(state).catch((e) => console.warn('IndexedDB write skipped or failed', e));
}

export function simpleLocalHash(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export function passwordHash(value: string): string {
  return simpleLocalHash(`PharmaCore-local-only:${value}`);
}

export function getOwnerProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getTeamUsers(): UserProfile[] {
  try {
    const raw = localStorage.getItem(TEAM_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTeamUsers(users: UserProfile[]): void {
  localStorage.setItem(TEAM_USERS_KEY, JSON.stringify(users));
}
