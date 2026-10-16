// pwa.js: app updates. Step 7 adds the service worker that makes the app
// installable and work offline; for now this holds the "Refresh app" button.

// Caches we keep even on a forced refresh: the AI model is large, and
// downloading it again over cellular is slow.
const KEEP_CACHES = ['transformers-cache'];

// Throw away the saved copy of the app and load the newest one.
// The player's progress and photos (in IndexedDB) are NOT touched.
export async function forceRefresh() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => !KEEP_CACHES.includes(name)).map((name) => caches.delete(name)));
  }
  location.reload();
}
