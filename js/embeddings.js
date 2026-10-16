// embeddings.js: turns a photo into an "embedding" (a list of 384 numbers)
// with the DINOv2-small AI model, running right on the phone.
//
// Photos of the same place get embeddings that point in nearly the same
// direction. Cosine similarity measures that: 1 means identical, around 0
// means unrelated.

import { MODEL_ID, MODEL_DTYPE } from './config.js';

// The Transformers.js library, pinned to an exact version so an update can't
// change our scores. It's the self-contained browser build (transformers.min.js);
// the "web" build in the same folder expects a bundler and won't load directly.
export const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js';

// The library is loaded only when the model is needed (not with a normal
// `import` at the top), so if the download fails, only the photo check is
// affected: clues, the album and backup questions keep working.
async function loadLibrary() {
  const { pipeline, env } = await import(TRANSFORMERS_URL);
  // Load the model from this website (models/Xenova/dinov2-small/), never from Hugging Face.
  // The path must be RELATIVE, "models/", not "/models/" or a full URL:
  //   - "/models/" would point to bkingcs.github.io/models/, outside our repo on GitHub Pages.
  //   - Transformers.js 4.3.1 skips its "does this file exist?" check for full URLs,
  //     and then silently fails to load the image settings.
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  env.localModelPath = 'models/';
  // After the first download, Transformers.js keeps the model in the browser's
  // Cache Storage (named "transformers-cache"), so later visits work offline.
  return pipeline;
}

// Filled in once the model is running. Shown in the debug panel and saved in the log.
export const modelInfo = { id: MODEL_ID, dtype: MODEL_DTYPE, device: null, loadMs: null };

// Other parts of the app can listen for loading progress (to show a progress bar).
const progressListeners = new Set();
export function onModelProgress(listener) {
  progressListeners.add(listener);
}
function reportProgress(info) {
  progressListeners.forEach((listener) => listener(info));
}

let extractorPromise = null;

// Thrown when the model can't start. Once that happens, trying again in the
// same page never works (the AI runtime remembers the failure), so the only
// fix is reloading the page. `friendlyMessage` says that in plain words.
export class ModelLoadError extends Error {
  constructor(cause) {
    super(cause.message, { cause });
    this.name = 'ModelLoadError';
    this.friendlyMessage = /out of memory/i.test(cause.message)
      ? 'This phone ran low on memory for the photo checker. Close other browser tabs, then reload the page.'
      : 'The photo checker couldn’t start. Check your connection, then reload the page.';
  }
}

// Start loading the model. Safe to call many times: it only loads once.
export function loadModel() {
  extractorPromise ??= createExtractor(['webgpu', 'wasm']).catch((error) => {
    const loadError = new ModelLoadError(error);
    reportProgress({ status: 'error', error: loadError });
    throw loadError;
  });
  return extractorPromise;
}

// Give the model's memory back when the page goes away. iPhones allow web
// pages very little memory, and Safari may keep the previous page alive (for
// the Back button), so a page that still holds the model can stop the next
// page from loading it.
window.addEventListener('pagehide', async () => {
  const running = extractorPromise;
  extractorPromise = null;
  modelInfo.device = null;
  try {
    await (await running)?.dispose();
  } catch {
    // Nothing to free if it never loaded.
  }
});

// Try each device in order. WebGPU uses the phone's graphics chip (fast);
// WASM runs on the regular processor (works everywhere, slower).
async function createExtractor(devices) {
  const started = performance.now();
  const pipeline = await loadLibrary();
  let lastError;
  for (const device of devices) {
    if (device === 'webgpu' && !(await isWebGPUAvailable())) continue;
    try {
      const extractor = await pipeline('image-feature-extraction', MODEL_ID, {
        device,
        dtype: MODEL_DTYPE,   // always set: by default WebGPU and WASM pick different precisions
        progress_callback: reportProgress,
      });
      modelInfo.device = device;
      modelInfo.loadMs = Math.round(performance.now() - started);
      reportProgress({ status: 'ready', device });
      return extractor;
    } catch (error) {
      // Note: if the failure was running out of memory, the next option fails
      // the same way. Both use the same WebAssembly memory.
      console.warn(`The model could not start on ${device}. Trying the next option.`, error);
      lastError = error;
    }
  }
  throw lastError;
}

async function isWebGPUAvailable() {
  try {
    return Boolean(navigator.gpu && (await navigator.gpu.requestAdapter()));
  } catch {
    return false;
  }
}

// Photo (a Blob) -> normalized embedding (a Float32Array of 384 numbers).
export async function embedImage(image) {
  let extractor = await loadModel();
  let output;
  try {
    output = await extractor(image);
  } catch (error) {
    if (modelInfo.device !== 'webgpu') throw error;
    // Some phones offer WebGPU but fail when it actually runs. Switch to WASM once.
    console.warn('WebGPU failed while running the model. Switching to WASM.', error);
    extractorPromise = createExtractor(['wasm']).catch((wasmError) => {
      throw new ModelLoadError(wasmError);
    });
    extractor = await extractorPromise;
    output = await extractor(image);
  }
  // output.dims is [1, 257, 384]: 257 rows of 384 numbers. Row 0 (the "CLS"
  // token) summarizes the whole image; rows 1-256 describe 14x14-pixel patches.
  // We use row 0. (This model file has no separate "pooled" output.)
  const width = output.dims.at(-1);
  return normalize(output.data.slice(0, width));
}

// Scale to length 1, so cosine similarity is a simple dot product.
function normalize(vector) {
  const length = Math.hypot(...vector);
  return vector.map((x) => x / length);
}

// Both embeddings must be normalized. Returns a number from -1 to 1.
export function cosineSimilarity(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

// Compare a photo with every reference photo. The best match is what counts.
export function bestMatch(embedding, referenceEmbeddings) {
  const scores = referenceEmbeddings.map((reference) => cosineSimilarity(embedding, reference));
  const index = scores.indexOf(Math.max(...scores));
  return { score: scores[index], index, scores };
}
