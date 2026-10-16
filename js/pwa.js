// pwa.js: getting app updates onto the phone. Step 7 adds the service worker
// that makes the app installable and work offline.
//
// This file imports nothing on purpose. If an update arrives half-way (the
// phone has some new files and some old ones), the rest of the app can fail
// to start, but this file still runs, so "Refresh app" always works.

// Every file the app is made of. "Refresh app" downloads all of them again.
// (Step 7's service worker will use the same list.)
export const APP_FILES = [
  './', 'index.html', 'setup.html', 'gems.json', 'css/style.css', 'icons/gem.svg',
  'js/app.js', 'js/answer.js', 'js/check.js', 'js/config.js', 'js/debug.js',
  'js/embeddings.js', 'js/gems.js', 'js/log.js', 'js/photo.js', 'js/pwa.js',
  'js/setup.js', 'js/storage.js',
];

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
  // A normal reload can still reuse files the browser saved in the last few
  // minutes. cache: 'reload' makes it fetch each one fresh from the server.
  await Promise.allSettled(APP_FILES.map((file) => fetch(file, { cache: 'reload' })));
  location.reload();
}

// Wire up the footer button (if this page has one).
document.getElementById('refresh-btn')?.addEventListener('click', forceRefresh);

// If no screen has appeared a few seconds after loading, the app didn't start
// (usually a half-finished update). Say so, instead of showing a blank page.
window.addEventListener('load', () => {
  setTimeout(() => {
    const screens = [...document.querySelectorAll('main > section')];
    if (screens.length === 0 || screens.some((screen) => !screen.hidden)) return;
    document.getElementById('error-message').textContent =
      'The app didn’t load completely, probably because an update only half-arrived. Tap “Refresh app” below.';
    document.getElementById('screen-error').hidden = false;
  }, 4000);
});
