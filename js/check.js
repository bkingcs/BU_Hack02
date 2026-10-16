// check.js: decides whether a photo counts as finding a gem.
//
// Image check: the photo's embedding must be similar enough to at least one
// of the gem's reference embeddings (made in setup mode).
// Step 4 adds the location check here.
//
// Test switch: add ?stub=fail to the web address to make every photo miss,
// which is handy for trying out the backup question.

import { embedImage, bestMatch, modelInfo } from './embeddings.js';
import { SIMILARITY_THRESHOLD } from './config.js';

const forceFail = new URLSearchParams(location.search).get('stub') === 'fail';

// What the player sees for each kind of miss.
const MESSAGES = {
  'image-mismatch': 'That doesn’t look like the spot. Try another angle, or check the clue again.',
  'forced-fail': 'Test mode (?stub=fail): every photo misses.',
};

// Returns { pass, reason, message, details }.
//   reason:  a short code saved in the log ('image-match', 'image-mismatch', ...)
//   message: what to tell the player
//   details: the numbers behind the decision, for the log and debug panel
export async function checkPhoto(gem, photo) {
  const started = performance.now();
  const embedding = await embedImage(photo.blob);
  const embedMs = Math.round(performance.now() - started);

  const threshold = gem.threshold ?? SIMILARITY_THRESHOLD;
  const references = (gem.references ?? []).map((reference) => reference.embedding);
  const details = {
    threshold, embedMs, device: modelInfo.device, score: null, refIndex: null, scores: [],
  };

  let pass;
  let reason;
  if (references.length === 0) {
    // A gem without reference photos can't be checked, so any photo counts.
    pass = true;
    reason = 'no-references';
  } else {
    const match = bestMatch(embedding, references);
    details.score = match.score;
    details.refIndex = match.index;
    details.scores = match.scores;
    pass = match.score >= threshold;
    reason = pass ? 'image-match' : 'image-mismatch';
  }

  if (forceFail) {
    pass = false;
    reason = 'forced-fail';
  }

  details.totalMs = Math.round(performance.now() - started);
  return { pass, reason, message: MESSAGES[reason] ?? '', details };
}
