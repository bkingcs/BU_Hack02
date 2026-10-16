// check.js: decides whether a photo counts as finding a gem.
//
// STEP 1 PLACEHOLDER. Every photo passes, so the rest of the app can be
// built and tested. Add ?stub=fail to the web address to make every photo
// fail instead, which lets you test the backup question.
// Step 3 replaces this with the image-similarity check; step 4 adds location.

const forceFail = new URLSearchParams(location.search).get('stub') === 'fail';

// Returns { pass: true/false, message: text to show the player }.
export async function checkPhoto(gem, photo) {
  // Pause briefly so the "Checking…" screen is visible, like the real check will be.
  await new Promise((resolve) => setTimeout(resolve, 600));
  if (forceFail) {
    return { pass: false, message: 'Test mode (?stub=fail): every photo misses.' };
  }
  return { pass: true, message: '' };
}
