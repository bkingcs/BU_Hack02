// setup.js: the organizer page. For each gem, add reference photos; the page
// turns each one into an embedding (the same way the player app does) and
// exports a new gems.json to commit to the repo.
//
// Only embeddings and tiny thumbnails go into gems.json, never the full photos.
// Step 5 adds editing names and clues, GPS recording and spacing warnings.

import { APP_VERSION, MODEL_ID, MODEL_DTYPE } from './config.js';
import { loadHunt } from './gems.js';
import { downscalePhoto } from './photo.js';
import { embedImage, cosineSimilarity, loadModel, onModelProgress } from './embeddings.js';
import { downloadFile } from './log.js';
import { collectReadings, describeLocationError } from './location.js';

const $ = (id) => document.getElementById(id);
const DRAFT_KEY = 'hidden-gems-setup-draft';
const THUMBNAIL_EDGE = 160;   // pixels; about 5 KB each

let hunt;   // the hunt being edited (same shape as gems.json)

// ---------- Saving work in progress on this device ----------

function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(hunt));
  } catch (error) {
    alert(`Couldn't save your work on this device: ${error.message}`);
  }
}

function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY));
  } catch {
    return null;
  }
}

// ---------- Reference photos ----------

async function addReferences(gem, files, statusLine) {
  // Finish loading the model before opening any photos. A full-size phone
  // photo takes 50-200 MB of memory while it's being shrunk, and an iPhone
  // can run out if that happens while the model is still starting.
  statusLine.textContent = 'Waiting for the model…';
  await loadModel();

  let done = 0;
  for (const file of files) {
    statusLine.textContent = `Processing photo ${done + 1} of ${files.length}…`;
    // Shrink exactly like the player app does, so the numbers are comparable.
    const photo = await downscalePhoto(file);
    const embedding = await embedImage(photo.blob);
    // Make the thumbnail from the already-small copy, so each full-size
    // photo is opened only once.
    const thumbnail = await downscalePhoto(photo.blob, THUMBNAIL_EDGE, 0.6);
    gem.references.push({
      // 4 decimal places is plenty, and keeps gems.json small.
      embedding: Array.from(embedding, (x) => Number(x.toFixed(4))),
      thumbnail: await blobToDataUrl(thumbnail.blob),
    });
    done += 1;
  }
  saveDraft();
  render();
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// ---------- Recording a gem's location ----------

const GPS_SECONDS = 15;

// Stand at the gem and average the readings for a few seconds. A single GPS
// reading can be off by 10+ meters; an average of many is steadier.
async function recordLocation(gem, statusLine) {
  statusLine.textContent = `Reading GPS. Stand still for ${GPS_SECONDS} seconds…`;
  const { readings, error } = await collectReadings(GPS_SECONDS * 1000, (sofar) => {
    const best = Math.min(...sofar.map((r) => r.accuracyM));
    statusLine.textContent = `Reading GPS… ${sofar.length} readings, best ±${Math.round(best)} m`;
  });
  if (readings.length === 0) {
    statusLine.textContent = `No location: ${describeLocationError(error)}. Is location allowed for this site?`;
    return;
  }
  // Trust precise readings more: each one counts by 1 / accuracy².
  const weights = readings.map((r) => 1 / r.accuracyM ** 2);
  const total = weights.reduce((sum, w) => sum + w, 0);
  const average = (key) => readings.reduce((sum, r, i) => sum + r[key] * weights[i], 0) / total;
  const accuracies = readings.map((r) => r.accuracyM).sort((a, b) => a - b);

  gem.lat = Number(average('lat').toFixed(6));   // 6 decimals is about 10 cm
  gem.lng = Number(average('lng').toFixed(6));
  gem.locationAccuracyM = Math.round(accuracies[Math.floor(accuracies.length / 2)]);   // the median
  gem.locationReadings = readings.length;
  saveDraft();
  render();
}

function describeLocation(gem) {
  if (gem.locationAccuracyM == null) return 'Location: not recorded yet.';
  return `Location: ${gem.lat}, ${gem.lng} (typical accuracy ±${gem.locationAccuracyM} m, ${gem.locationReadings} readings)`;
}

// How alike are a gem's reference photos? If they barely match each other,
// players' photos won't match them well either.
function describeReferences(references) {
  const count = references.length;
  if (count === 0) return 'No reference photos yet. Add 3 to 5.';
  let text = `${count} reference photo${count === 1 ? '' : 's'}.`;
  if (count < 3) text += ' Add at least 3, from different angles.';
  if (count > 5) text += ' More than 5 rarely helps.';
  if (count >= 2) {
    const scores = [];
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        scores.push(cosineSimilarity(references[i].embedding, references[j].embedding));
      }
    }
    text += ` They match each other at ${Math.min(...scores).toFixed(2)} to ${Math.max(...scores).toFixed(2)}.`;
  }
  return text;
}

// ---------- Drawing the page ----------

function render() {
  const template = $('gem-card-template');
  const cards = hunt.gems.map((gem) => {
    const card = template.content.firstElementChild.cloneNode(true);
    gem.references ??= [];
    card.querySelector('.gem-name').textContent = `${gem.id}: ${gem.name}`;
    card.querySelector('.gem-clue').textContent = gem.clue;

    const locationLine = card.querySelector('.gem-location');
    locationLine.textContent = describeLocation(gem);
    const locationButton = card.querySelector('.location-btn');
    locationButton.addEventListener('click', async () => {
      locationButton.disabled = true;
      await recordLocation(gem, locationLine);
      locationButton.disabled = false;
    });
    const statusLine = card.querySelector('.ref-stats');
    statusLine.textContent = describeReferences(gem.references);

    const list = card.querySelector('.ref-list');
    gem.references.forEach((reference, index) => {
      const item = document.createElement('li');
      const img = document.createElement('img');
      img.src = reference.thumbnail;
      img.alt = `Reference photo ${index + 1}`;
      const remove = document.createElement('button');
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => {
        gem.references.splice(index, 1);
        saveDraft();
        render();
      });
      item.append(img, remove);
      list.append(item);
    });

    card.querySelector('.ref-input').addEventListener('change', async (event) => {
      const files = [...event.target.files];
      event.target.value = '';
      if (files.length === 0) return;
      try {
        await addReferences(gem, files, statusLine);
      } catch (error) {
        console.error(error);
        statusLine.textContent = error.friendlyMessage ?? `Something went wrong: ${error.message}`;
        if (error.friendlyMessage) $('setup-reload-btn').hidden = false;
      }
    });
    return card;
  });
  $('gem-list').replaceChildren(...cards);
}

// ---------- Export ----------

function exportGems() {
  const output = {
    ...hunt,
    // Record which model made these embeddings; the player app checks it.
    model: { id: MODEL_ID, dtype: MODEL_DTYPE, embedding: 'cls' },
    exportedAt: new Date().toISOString(),
  };
  // Pretty-print, but keep each list of numbers on one line so the file stays readable.
  const text = JSON.stringify(output, null, 2)
    .replace(/\[\s+(-?\d[\d.eE+-]*(?:,\s+-?\d[\d.eE+-]*)*)\s+\]/g, (_, numbers) => `[${numbers.replace(/\s+/g, '')}]`);
  downloadFile('gems.json', `${text}\n`, 'application/json');
}

async function reloadFromServer() {
  if (!confirm('Throw away the reference photos added on this device and reload gems.json?')) return;
  localStorage.removeItem(DRAFT_KEY);
  hunt = await loadHunt();
  render();
}

// ---------- Start ----------

async function main() {
  $('app-version').textContent = `Version ${APP_VERSION}`;
  $('export-btn').addEventListener('click', exportGems);
  $('reload-btn').addEventListener('click', reloadFromServer);

  onModelProgress((info) => {
    if (info.status === 'progress_total') {
      $('setup-model-status').textContent = `Loading the model: ${Math.round(info.progress)}%`;
    } else if (info.status === 'ready') {
      $('setup-model-status').textContent = `Model ready (${MODEL_ID} ${MODEL_DTYPE} on ${info.device}).`;
    } else if (info.status === 'error') {
      // Plain words first, then the technical message for us.
      $('setup-model-status').textContent = `${info.error.friendlyMessage} (${info.error.message})`;
      $('setup-reload-btn').hidden = false;
    }
  });
  // Your reference photos are saved on this device, so reloading loses nothing.
  $('setup-reload-btn').addEventListener('click', () => location.reload());

  hunt = loadDraft() ?? (await loadHunt());
  render();
  loadModel().catch((error) => console.error(error));
}

main();
