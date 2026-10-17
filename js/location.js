// location.js: where is the phone? Uses the browser's Geolocation API, which
// combines GPS, Wi-Fi and cell towers. It needs a secure (https) page and the
// player's permission.
//
// Each reading comes with an "accuracy" in meters: the phone is 95% sure the
// true position is within that distance of the reading.

// ---------- Distance between two points on Earth ----------

const EARTH_RADIUS_METERS = 6371008.8;   // the Earth's mean radius
const toRadians = (degrees) => (degrees * Math.PI) / 180;

// The "haversine" formula: straight-line distance over the Earth's surface
// between two { lat, lng } points, in meters.
export function distanceMeters(a, b) {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

// ---------- Reading the phone's location ----------

const HIGH_ACCURACY = { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 };

let latest = null;      // newest reading: { lat, lng, accuracyM, time }
let lastError = null;   // newest problem (permission denied, no signal, ...)
let watchId = null;
const listeners = new Set();

// Let other parts of the app react to new readings (e.g. the GPS status line).
export function onLocationChange(listener) {
  listeners.add(listener);
}

function saveReading(position) {
  latest = {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracyM: position.coords.accuracy,
    time: position.timestamp,
  };
  lastError = null;
  listeners.forEach((listener) => listener({ reading: latest, error: null }));
}

function saveError(error) {
  lastError = error;
  // A brief signal problem can keep using the last reading for a few seconds,
  // but once permission is denied, an old reading must not be used.
  if (error.code === 1) latest = null;
  listeners.forEach((listener) => listener({ reading: latest, error }));
}

// Keep the location up to date while the player is hunting, so a fresh
// reading is ready the moment they take a photo. (GPS can take 5-20 seconds
// to settle after it starts.)
export function startWatching() {
  if (watchId !== null || !navigator.geolocation) return;
  watchId = navigator.geolocation.watchPosition(saveReading, saveError, HIGH_ACCURACY);
}

// Stop when not needed, to save battery.
export function stopWatching() {
  if (watchId === null) return;
  navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

// A reading to check a photo with: the latest one if it's recent enough,
// otherwise ask for a fresh one and wait up to `timeoutMs`.
// Returns { reading, error }; reading is null if the location isn't available.
export async function currentReading({ maxAgeMs = 15000, timeoutMs = 10000 } = {}) {
  if (latest && Date.now() - latest.time < maxAgeMs) return { reading: latest, error: null };
  if (!navigator.geolocation) return { reading: null, error: { code: 0, message: 'This browser has no location support.' } };
  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true, maximumAge: maxAgeMs, timeout: timeoutMs,
      });
    });
    saveReading(position);
    return { reading: latest, error: null };
  } catch (error) {
    saveError(error);
    return { reading: null, error };
  }
}

// Setup mode: collect every reading for `durationMs` while the organizer
// stands still at the gem. Calls onReading(readings) after each one.
// Resolves with { readings, error }.
export function collectReadings(durationMs, onReading) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ readings: [], error: { code: 0, message: 'This browser has no location support.' } });
      return;
    }
    const readings = [];
    let lastProblem = null;
    const id = navigator.geolocation.watchPosition(
      (position) => {
        readings.push({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: position.coords.accuracy,
        });
        onReading?.(readings);
      },
      (error) => {
        lastProblem = error;
        if (error.code === 1) finish();   // permission denied: no point waiting
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: durationMs },
    );
    const timer = setTimeout(finish, durationMs);
    function finish() {
      clearTimeout(timer);
      navigator.geolocation.clearWatch(id);
      resolve({ readings, error: readings.length ? null : lastProblem });
    }
  });
}

// Plain-words name for a location error (error.code comes from the browser).
export function describeLocationError(error) {
  if (!error) return '';
  return {
    1: 'permission denied',
    2: 'position unavailable',
    3: 'timed out',
  }[error.code] ?? error.message ?? 'unknown problem';
}
