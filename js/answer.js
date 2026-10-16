// answer.js: checks a player's answer to a gem's backup question.
//
// gems.json never contains the answer itself, only a SHA-256 "fingerprint"
// (hash) of it. We hash what the player typed the same way and compare
// fingerprints. This is NOT real security: anyone can read gems.json and
// try guesses, and short answers are easy to guess. It just keeps answers
// from being readable at a glance. Anything a web page can check, a
// determined player can also see.

// Turn an answer into a standard form, so "Bertrand Library!" and
// "  bertrand library " count as the same answer.
// Setup mode uses this same function when it hashes the organizer's answer,
// so both sides always agree.
// Digits vs words ("1846" vs "eighteen forty six") are NOT matched here:
// list both answers in setup mode and both hashes go into gems.json.
export function normalizeAnswer(text) {
  return text
    .normalize('NFKD')                  // split accented letters: "é" becomes "e" + an accent mark
    .replace(/[̀-ͯ]/g, '')    // ...then drop the accent marks: "café" = "cafe"
    .toLowerCase()
    .replace(/&/g, ' and ')             // "Fran & Joe" = "fran and joe"
    .replace(/['‘’`]/g, '')             // apostrophes vanish: "O'Leary" = "oleary"
    .replace(/(\d),(?=\d)/g, '$1')      // thousands commas vanish: "1,846" = "1846"
    .replace(/[^\p{L}\p{N}]+/gu, ' ')   // any other punctuation or run of spaces becomes one space:
                                        // "bell-tower" = "bell  tower" = "bell tower"
    .trim()
    .replace(/^(the|a|an) /, '');       // a leading "the", "a" or "an" is optional: "The Quad" = "quad"
}

// SHA-256 of the normalized answer, as a 64-character hex string.
export async function hashAnswer(text) {
  if (!crypto.subtle) {
    // crypto.subtle only exists on secure (https or localhost) pages.
    throw new Error('Checking answers needs a secure (https) page.');
  }
  const bytes = new TextEncoder().encode(normalizeAnswer(text));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// A gem can accept several answers (e.g. "1846" and "eighteen forty six").
export async function isCorrectAnswer(guess, acceptedHashes) {
  return acceptedHashes.includes(await hashAnswer(guess));
}
