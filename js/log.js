// log.js: keeps a record of every check on this phone, so organizers can
// export it as a spreadsheet (CSV) and pick thresholds from real numbers.
// The log never leaves the phone unless someone taps "Export CSV".

import { APP_VERSION, MODEL_DTYPE, DEMO_MODE } from './config.js';
import { addLogEntry, getLogEntries, clearLog } from './storage.js';

// One column per field, in this order, in the exported CSV.
const COLUMNS = [
  'time', 'appVersion', 'huntId', 'gemId', 'kind', 'attempt', 'outcome', 'reason',
  'bestScore', 'matchedRef', 'threshold', 'allScores',
  'distanceM', 'accuracyM',
  'embedMs', 'totalMs', 'modelDevice', 'modelDtype', 'demoMode', 'userAgent',
];

const round = (x, digits = 4) => (x == null ? null : Number(x.toFixed(digits)));

// Save one photo check. `result` comes from checkPhoto() in check.js.
export function recordPhotoCheck({ huntId, gemId, attempt, result }) {
  const d = result.details;
  return record({
    huntId, gemId, attempt,
    kind: 'photo',
    outcome: result.pass ? 'pass' : 'fail',
    reason: result.reason,
    bestScore: round(d.score),
    matchedRef: d.refIndex,
    threshold: d.threshold,
    allScores: d.scores.map((s) => round(s, 3)).join(' '),
    distanceM: round(d.distanceM, 1),
    accuracyM: round(d.accuracyM, 1),
    embedMs: d.embedMs,
    totalMs: d.totalMs,
    modelDevice: d.device,
  });
}

// Save one backup-question answer (right or wrong).
export function recordBackupAnswer({ huntId, gemId, correct }) {
  return record({
    huntId, gemId, kind: 'backup', outcome: correct ? 'pass' : 'fail', reason: 'backup-answer',
  });
}

async function record(fields) {
  const entry = {
    time: new Date().toISOString(),
    appVersion: APP_VERSION,
    modelDtype: MODEL_DTYPE,
    demoMode: DEMO_MODE,
    userAgent: navigator.userAgent,
    ...fields,
  };
  await addLogEntry(entry);
  return entry;
}

export async function countLogEntries() {
  return (await getLogEntries()).length;
}

export { clearLog };

// Build the CSV text: a header row, then one row per check.
export async function logAsCsv() {
  const entries = await getLogEntries();
  const rows = entries.map((entry) => COLUMNS.map((column) => csvCell(entry[column])).join(','));
  return [COLUMNS.join(','), ...rows].join('\n');
}

// Quote a cell if it contains a comma, quote, or line break (the CSV rules).
function csvCell(value) {
  if (value == null) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// Save text as a file on the phone or computer.
export function downloadFile(filename, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
