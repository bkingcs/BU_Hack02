// check.js: decides whether a photo counts as finding a gem. Two checks run
// at the same time:
//
//   Image:    the photo's embedding must be similar enough to at least one of
//             the gem's reference embeddings (made in setup mode).
//   Location: the phone must not be clearly somewhere else (see locationVerdict).
//
// Test switches in the web address:
//   ?demo=1      skip the location check (desk demos)
//   ?stub=fail   make every photo miss (to try out the backup question)

import { embedImage, bestMatch, modelInfo } from './embeddings.js';
import { currentReading, distanceMeters, describeLocationError } from './location.js';
import { SIMILARITY_THRESHOLD, DEFAULT_RADIUS_METERS, DEMO_MODE } from './config.js';

const forceFail = new URLSearchParams(location.search).get('stub') === 'fail';

// What the player sees for each kind of miss.
const MESSAGES = {
  'image-mismatch': 'That doesn’t look like the spot. Try another angle, or check the clue again.',
  'too-far': 'Your phone says you’re not at this spot yet. Get closer and try again.',
  'forced-fail': 'Test mode (?stub=fail): every photo misses.',
};

// What the phone's location says about this gem. Returns one of:
//   'inside'       the reading is within the gem's radius
//   'uncertain'    the reading is outside the radius, but GPS error could explain it
//   'outside'      even the most generous reading (distance minus accuracy)
//                  is beyond the radius: the player is clearly somewhere else
//   'unavailable'  no reading (permission denied, no signal, timed out)
//   'skipped'      demo mode
// Only 'outside' fails a photo. In every other case the image check decides,
// because wrongly rejecting a player is worse than wrongly accepting one.
export function locationVerdict(distanceM, accuracyM, radiusM) {
  if (distanceM <= radiusM) return 'inside';
  if (distanceM - accuracyM <= radiusM) return 'uncertain';
  return 'outside';
}

// Returns { pass, reason, message, details }.
//   reason:  a short code saved in the log ('image-match', 'too-far', ...)
//   message: what to tell the player
//   details: the numbers behind the decision, for the log and debug panel
export async function checkPhoto(gem, photo) {
  const started = performance.now();
  const radiusM = gem.radiusMeters ?? DEFAULT_RADIUS_METERS;

  // Run the image model and the location lookup at the same time.
  const [image, position] = await Promise.all([
    timed(() => embedImage(photo.blob)),
    DEMO_MODE ? { reading: null, error: null } : currentReading(),
  ]);

  const details = {
    threshold: gem.threshold ?? SIMILARITY_THRESHOLD,
    embedMs: image.ms,
    device: modelInfo.device,
    score: null, refIndex: null, scores: [],
    radiusM, distanceM: null, accuracyM: null, locationStatus: 'skipped', locationError: '',
  };

  // ---- Image ----
  const references = (gem.references ?? []).map((reference) => reference.embedding);
  let imagePass = true;   // a gem without reference photos can't be checked, so any photo counts
  if (references.length > 0) {
    const match = bestMatch(image.value, references);
    details.score = match.score;
    details.refIndex = match.index;
    details.scores = match.scores;
    imagePass = match.score >= details.threshold;
  }

  // ---- Location ----
  if (!DEMO_MODE) {
    if (position.reading) {
      details.distanceM = distanceMeters(position.reading, gem);
      details.accuracyM = position.reading.accuracyM;
      details.locationStatus = locationVerdict(details.distanceM, details.accuracyM, radiusM);
    } else {
      details.locationStatus = 'unavailable';
      details.locationError = describeLocationError(position.error);
    }
  }

  // ---- Decision ----
  let reason;
  if (forceFail) reason = 'forced-fail';
  else if (details.locationStatus === 'outside') reason = 'too-far';
  else if (!imagePass) reason = 'image-mismatch';
  else reason = references.length > 0 ? 'image-match' : 'no-references';

  details.totalMs = Math.round(performance.now() - started);
  const pass = reason === 'image-match' || reason === 'no-references';
  return { pass, reason, message: MESSAGES[reason] ?? '', details };
}

// Run a slow step and measure how long it took.
async function timed(step) {
  const started = performance.now();
  const value = await step();
  return { value, ms: Math.round(performance.now() - started) };
}
