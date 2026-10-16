// config.js: the numbers and switches that tune the hunt, all in one place.

// Shown in the footer. Bump it every time you publish, so you can tell
// at a glance whether your phone has the newest version.
export const APP_VERSION = '0.1.0';

// After this many missed photos on one gem, offer the backup question.
export const MAX_ATTEMPTS = 3;

// Photos are shrunk before they are checked or saved. The long edge is
// at most this many pixels; JPEG quality runs from 0 (worst) to 1 (best).
export const PHOTO_MAX_EDGE = 1024;
export const PHOTO_JPEG_QUALITY = 0.8;

// Switches you can turn on by adding them to the web address:
//   ?demo=1   desk demo: skip the location check, pick photos from the camera roll
//   ?debug=1  show scores and timing for every photo check
const params = new URLSearchParams(location.search);
export const DEMO_MODE = params.get('demo') === '1';
export const DEBUG_MODE = params.get('debug') === '1';
