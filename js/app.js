// app.js: the player's side of Hidden Gems.
//
// How it works:
//   1. Load the hunt from gems.json and the player's saved progress.
//   2. Show one screen at a time (the <section>s in index.html).
//   3. Each photo is shrunk, checked, and saved. Pass = next clue.
//      Too many misses = a backup question appears.
//   4. After the last gem, show the album.
// Progress is saved after every change, so refreshing never loses the hunt.

import {
  APP_VERSION, MAX_ATTEMPTS, DEMO_MODE, DEBUG_MODE, MODEL_ID, MODEL_DTYPE,
} from './config.js';
import { loadHunt } from './gems.js';
import {
  newProgress, loadProgress, saveProgress, savePhoto, getPhoto, clearHunt, requestPersistentStorage,
} from './storage.js';
import { downscalePhoto } from './photo.js';
import { checkPhoto } from './check.js';
import { isCorrectAnswer } from './answer.js';
import { loadModel, onModelProgress } from './embeddings.js';
import { recordPhotoCheck, recordBackupAnswer } from './log.js';
import { initDebug, showInDebug, setDebugNote } from './debug.js';

const $ = (id) => document.getElementById(id);

let hunt;       // the hunt from gems.json: { huntId, title, gems: [...] }
let progress;   // how far this player has gotten (see newProgress in storage.js)
let onResultButton = () => {};   // what the button on the result screen does

// ---------- Showing screens ----------

const SCREENS = ['start', 'clue', 'checking', 'result', 'album', 'error'];

function showScreen(name) {
  for (const screen of SCREENS) {
    $(`screen-${screen}`).hidden = screen !== name;
  }
  const foundCount = Object.keys(progress?.found ?? {}).length;
  $('found-count').textContent = progress?.startedAt ? `${foundCount} / ${hunt.gems.length}` : '';
  window.scrollTo(0, 0);
}

// Pick the right screen for wherever the player is in the hunt.
function showCurrentScreen() {
  if (!progress.startedAt) {
    showScreen('start');
  } else if (progress.currentIndex >= hunt.gems.length) {
    showAlbum();
  } else {
    showClue();
  }
}

function currentGem() {
  return hunt.gems[progress.currentIndex];
}

// Photos are stored as Blobs. To show one in an <img>, the browser gives it a
// temporary URL. We release old URLs so they don't pile up in memory.
let photoUrls = [];
function showPhoto(img, blob) {
  if (!blob) {
    img.hidden = true;
    return;
  }
  const url = URL.createObjectURL(blob);
  photoUrls.push(url);
  img.src = url;
  img.hidden = false;
}
function releasePhotos() {
  photoUrls.forEach((url) => URL.revokeObjectURL(url));
  photoUrls = [];
}

// ---------- The clue screen ----------

function showClue() {
  releasePhotos();
  const gem = currentGem();
  const tries = progress.attempts[gem.id] ?? 0;

  $('gem-count').textContent = `Gem ${progress.currentIndex + 1} of ${hunt.gems.length}`;
  $('clue-text').textContent = gem.clue;
  $('attempts-text').textContent = tries > 0 ? `Photos tried here: ${tries}` : '';

  const offerBackup = tries >= MAX_ATTEMPTS;
  $('backup-box').hidden = !offerBackup;
  $('backup-question').textContent = offerBackup ? gem.backupQuestion : '';
  $('backup-feedback').textContent = '';
  $('photo-label').textContent = offerBackup ? 'Try another photo' : photoButtonText();

  showScreen('clue');
}

function photoButtonText() {
  return DEMO_MODE ? 'Choose a photo' : 'Take a photo';
}

// ---------- Taking and checking a photo ----------

async function handlePhoto(event) {
  const file = event.target.files[0];
  event.target.value = '';      // lets the player pick the same photo again later
  if (!file) return;            // the player closed the camera without a photo

  const gem = currentGem();
  try {
    releasePhotos();
    const photo = await downscalePhoto(file);
    showPhoto($('checking-photo'), photo.blob);
    showScreen('checking');

    const result = await checkPhoto(gem, photo);
    const attempt = (progress.attempts[gem.id] ?? 0) + 1;
    showInDebug(await recordPhotoCheck({ huntId: hunt.huntId, gemId: gem.id, attempt, result }));
    // Keep the newest photo for this gem, pass or fail, so the album has a
    // picture even if the player ends up answering the backup question.
    await savePhoto(gem.id, photo.blob);

    if (result.pass) {
      await markFound(gem, 'photo');
      showFound(photo.blob, `You found ${gem.name}.`);
    } else {
      progress.attempts[gem.id] = (progress.attempts[gem.id] ?? 0) + 1;
      await saveProgress(progress);
      showMiss(gem, photo.blob, result.message);
    }
  } catch (error) {
    // A broken photo is not the player's fault, so it doesn't count as a miss.
    console.error(error);
    showResult({
      title: 'That photo didn’t work',
      message: 'Something went wrong checking the photo. Please try again.'
        + (DEBUG_MODE ? ` (${error.message})` : ''),
      buttonText: 'Back to the clue',
      onButton: showClue,
    });
  }
}

async function markFound(gem, method) {
  progress.found[gem.id] = { method, time: Date.now() };
  progress.currentIndex += 1;
  if (progress.currentIndex >= hunt.gems.length) {
    progress.finishedAt = Date.now();
  }
  await saveProgress(progress);
}

function showFound(blob, message) {
  const isLast = progress.currentIndex >= hunt.gems.length;
  showResult({
    blob,
    title: 'Found it!',
    message,
    buttonText: isLast ? 'See your album' : 'Next clue',
    onButton: showCurrentScreen,
  });
}

function showMiss(gem, blob, reason) {
  const tries = progress.attempts[gem.id];
  let message = reason || 'That doesn’t look like the spot. Try another angle.';
  if (tries === MAX_ATTEMPTS) {
    message += ' You can now answer a backup question instead.';
  }
  showResult({ blob, title: 'Not quite', message, buttonText: 'Back to the clue', onButton: showClue });
}

function showResult({ blob, title, message, buttonText, onButton }) {
  showPhoto($('result-photo'), blob);
  $('result-title').textContent = title;
  $('result-message').textContent = message;
  $('result-btn').textContent = buttonText;
  onResultButton = onButton;
  showScreen('result');
}

// ---------- The backup question ----------

async function handleBackupAnswer(event) {
  event.preventDefault();   // stop the form from reloading the page
  const gem = currentGem();
  const input = $('backup-answer');

  try {
    const correct = await isCorrectAnswer(input.value, gem.backupAnswerHashes);
    showInDebug(await recordBackupAnswer({ huntId: hunt.huntId, gemId: gem.id, correct }));
    if (correct) {
      input.value = '';
      await markFound(gem, 'backup');
      const saved = await getPhoto(gem.id);
      showFound(saved?.blob, `That’s right! You found ${gem.name}.`);
    } else {
      $('backup-feedback').textContent = 'Not quite. Look around and try again.';
    }
  } catch (error) {
    console.error(error);
    $('backup-feedback').textContent = error.message;
  }
}

// ---------- The album ----------

async function showAlbum() {
  releasePhotos();
  const list = $('album-list');
  list.replaceChildren();

  for (const gem of hunt.gems) {
    const saved = await getPhoto(gem.id);
    const item = document.createElement('li');

    if (saved) {
      const img = document.createElement('img');
      img.alt = `Your photo of ${gem.name}`;
      showPhoto(img, saved.blob);
      item.append(img);
    }

    const caption = document.createElement('div');
    caption.className = 'caption';
    caption.textContent = gem.name;
    if (progress.found[gem.id]?.method === 'backup') {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = 'Solved with the backup question';
      caption.append(badge);
    }
    item.append(caption);
    list.append(item);
  }
  showScreen('album');
}

// ---------- Buttons that are always there ----------

async function startHunt() {
  progress.startedAt = Date.now();
  await saveProgress(progress);
  requestPersistentStorage();   // ask once; it's fine if the browser says no
  showCurrentScreen();
}

async function startOver() {
  if (!confirm('Erase your progress and photos and start over?')) return;
  await clearHunt();
  progress = newProgress(hunt.huntId);
  releasePhotos();
  showCurrentScreen();
}

// The AI model downloads once (about 25 MB), then loads from the phone.
// Show progress only while it's downloading; say nothing once it's ready.
function showModelStatus(info) {
  let text;
  if (info.status === 'progress_total') {
    const megabytes = Math.round(info.total / 1e6);
    text = `Getting the photo checker ready (first time only): ${Math.round(info.progress)}% of ${megabytes} MB`;
  } else if (info.status === 'ready') {
    text = '';
  } else if (info.status === 'error') {
    text = 'The photo checker couldn’t load. Check your connection, then tap “Refresh app” below.';
  } else {
    return;
  }
  $('model-status').textContent = text;
  $('checking-detail').textContent = text;
}

// gems.json records which model made its reference embeddings. They must match.
function checkModelMatches() {
  const made = hunt.model;
  if (made && (made.id !== MODEL_ID || made.dtype !== MODEL_DTYPE)) {
    const warning = `gems.json was made with ${made.id} ${made.dtype}, but the app uses ${MODEL_ID} ${MODEL_DTYPE}. Scores will be wrong.`;
    console.warn(warning);
    setDebugNote(warning);
  }
}

function showError(error) {
  console.error(error);
  $('error-message').textContent = error.message;
  showScreen('error');
}

// ---------- Start the app ----------

async function main() {
  $('app-version').textContent = `Version ${APP_VERSION}`;

  if (DEMO_MODE) {
    $('demo-banner').hidden = false;
    // Without "capture", phones offer the camera roll as well as the camera.
    $('photo-input').removeAttribute('capture');
  }

  $('start-btn').addEventListener('click', startHunt);
  $('photo-input').addEventListener('change', handlePhoto);
  $('backup-form').addEventListener('submit', handleBackupAnswer);
  $('result-btn').addEventListener('click', () => onResultButton());
  $('reset-btn').addEventListener('click', startOver);
  $('error-retry-btn').addEventListener('click', () => location.reload());

  initDebug();
  onModelProgress(showModelStatus);

  try {
    hunt = await loadHunt();
    checkModelMatches();
    progress = await loadProgress(hunt.huntId);
    showCurrentScreen();
  } catch (error) {
    showError(error);
    return;
  }

  // Start loading the AI model now, so it's ready by the time the player
  // takes a photo. Errors show up in the model status line.
  loadModel().catch((error) => console.error(error));
}

main();
