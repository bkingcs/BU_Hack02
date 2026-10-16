// storage.js: saves progress and photos on the phone with IndexedDB,
// the browser's built-in database. Nothing here is ever uploaded.
//
// The database has three "stores" (think: tables):
//   progress  one record that says how far the player has gotten
//   photos    the latest photo taken at each gem, keyed by gem id
//   checkLog  one row per photo check, for tuning thresholds (used from step 3)

const DB_NAME = 'hidden-gems';
const DB_VERSION = 1;

let dbPromise = null;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    // Runs only the first time (or when DB_VERSION goes up): create the stores.
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('progress');
      db.createObjectStore('photos', { keyPath: 'gemId' });
      db.createObjectStore('checkLog', { autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// IndexedDB uses callbacks, so this small helper wraps one transaction
// in a Promise that we can `await`. `work` receives the transaction and
// may return a request whose result we want back.
async function transaction(storeNames, mode, work) {
  dbPromise ??= openDatabase();
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    const request = work(tx);
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// ---------- Progress ----------

export function newProgress(huntId) {
  return {
    huntId,             // which hunt this progress belongs to
    currentIndex: 0,    // position in the gems list of the gem being hunted
    attempts: {},       // gem id -> number of missed photos
    found: {},          // gem id -> { method: 'photo' | 'backup', time }
    startedAt: null,
    finishedAt: null,
  };
}

export async function loadProgress(huntId) {
  const saved = await transaction('progress', 'readonly',
    (tx) => tx.objectStore('progress').get('current'));
  // If the organizers published a different hunt, old progress no longer fits.
  if (!saved || saved.huntId !== huntId) {
    await clearHunt();
    return newProgress(huntId);
  }
  return saved;
}

export function saveProgress(progress) {
  return transaction('progress', 'readwrite',
    (tx) => tx.objectStore('progress').put(progress, 'current'));
}

// ---------- Photos ----------

export function savePhoto(gemId, blob) {
  return transaction('photos', 'readwrite',
    (tx) => tx.objectStore('photos').put({ gemId, blob, savedAt: Date.now() }));
}

export function getPhoto(gemId) {
  return transaction('photos', 'readonly',
    (tx) => tx.objectStore('photos').get(gemId));
}

// ---------- Starting over ----------

export function clearHunt() {
  return transaction(['progress', 'photos'], 'readwrite', (tx) => {
    tx.objectStore('progress').clear();
    tx.objectStore('photos').clear();
  });
}

// Ask the browser not to delete our data when the phone runs low on space.
// Some browsers say yes, some say no, some decide silently. Returns true if granted.
export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
