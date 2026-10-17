// config.js: the numbers and switches that tune the hunt, all in one place.

// Shown in the footer. Bump it every time you publish, so you can tell
// at a glance whether your phone has the newest version.
export const APP_VERSION = '0.3.0';

// After this many missed photos on one gem, offer the backup question.
export const MAX_ATTEMPTS = 3;

// Photos are shrunk before they are checked or saved. The long edge is
// at most this many pixels; JPEG quality runs from 0 (worst) to 1 (best).
export const PHOTO_MAX_EDGE = 1024;
export const PHOTO_JPEG_QUALITY = 0.8;

// ---------- The photo check ----------
// An AI model on the phone turns each photo into 384 numbers (an "embedding").
// Photos of the same spot get similar numbers. If you change the model or its
// precision, re-make every gem's reference embeddings in setup mode:
// embeddings from different models can't be compared.
export const MODEL_ID = 'Xenova/dinov2-small';
export const MODEL_DTYPE = 'q8';   // 8-bit version: a 24.5 MB download (see NOTES.md)

// How similar (0 to 1) a photo must be to at least one of the gem's reference
// photos to count. PROVISIONAL until we measure it with eval.html.
// A gem in gems.json can override this with its own "threshold".
export const SIMILARITY_THRESHOLD = 0.5;

// ---------- The location check ----------
// How close (in meters) the phone must be to a gem's recorded spot, unless the
// gem in gems.json has its own "radiusMeters". PROVISIONAL until the campus test.
export const DEFAULT_RADIUS_METERS = 40;

// Switches you can turn on by adding them to the web address:
//   ?demo=1   desk demo: skip the location check, pick photos from the camera roll
//   ?debug=1  show scores and timing for every photo check
const params = new URLSearchParams(location.search);
export const DEMO_MODE = params.get('demo') === '1';
export const DEBUG_MODE = params.get('debug') === '1';
