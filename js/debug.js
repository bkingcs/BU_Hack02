// debug.js: the panel you get with ?debug=1 in the web address.
// It shows the numbers behind the latest check and lets you export the
// whole check log as a CSV file. Players never see it.

import { DEBUG_MODE } from './config.js';
import { modelInfo, onModelProgress } from './embeddings.js';
import { logAsCsv, downloadFile, countLogEntries, clearLog } from './log.js';

const $ = (id) => document.getElementById(id);

let lastEntry = null;   // the most recent log entry
let note = '';          // a warning to show, e.g. a model mismatch

export function initDebug() {
  if (!DEBUG_MODE) return;
  $('debug-panel').hidden = false;

  $('debug-toggle').addEventListener('click', () => {
    const body = $('debug-body');
    body.hidden = !body.hidden;
    $('debug-toggle').setAttribute('aria-expanded', String(!body.hidden));
  });
  $('debug-export').addEventListener('click', async () => {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    downloadFile(`hidden-gems-log-${stamp}.csv`, await logAsCsv());
  });
  $('debug-clear').addEventListener('click', async () => {
    if (!confirm('Delete every logged check on this phone?')) return;
    await clearLog();
    render();
  });

  onModelProgress((info) => {
    if (info.status === 'ready' || info.status === 'error') render();
  });
  render();
}

// Called after every check with the entry that was just logged.
export function showInDebug(entry) {
  lastEntry = entry;
  render();
}

export function setDebugNote(text) {
  note = text;
  render();
}

async function render() {
  if (!DEBUG_MODE) return;
  const e = lastEntry ?? {};
  const show = (value, unit = '') => (value == null || value === '' ? '—' : `${value}${unit}`);

  const rows = [
    ['Model', modelInfo.device
      ? `${modelInfo.id} ${modelInfo.dtype} on ${modelInfo.device}, loaded in ${modelInfo.loadMs} ms`
      : 'loading…'],
    ['Last check', lastEntry ? `${e.kind} · ${e.outcome.toUpperCase()} · ${e.reason}` : 'none yet'],
    ['Best score', e.bestScore == null ? '—' : `${e.bestScore}  (threshold ${e.threshold})`],
    ['Matched ref', e.matchedRef == null ? '—' : `#${e.matchedRef + 1}`],
    ['All scores', show(e.allScores)],
    ['Distance', show(e.distanceM, ' m')],
    ['GPS accuracy', show(e.accuracyM, ' m')],
    ['Timing', e.totalMs == null ? '—' : `${e.embedMs} ms model, ${e.totalMs} ms total`],
    ['Log', `${await countLogEntries()} entries on this phone`],
  ];
  if (note) rows.unshift(['Warning', note]);

  // The one-line summary on the (collapsed) panel button.
  let summary = 'no checks yet';
  if (lastEntry) {
    summary = e.outcome.toUpperCase();
    if (e.bestScore != null) summary += ` ${e.bestScore.toFixed(2)} ${e.bestScore >= e.threshold ? '≥' : '<'} ${e.threshold}`;
    else summary += ` (${e.reason})`;
    if (e.totalMs != null) summary += ` · ${(e.totalMs / 1000).toFixed(1)} s`;
  }
  $('debug-toggle').textContent = `${note ? '⚠ ' : ''}Debug: ${summary}`;

  $('debug-fields').replaceChildren(...rows.flatMap(([label, value]) => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    return [dt, dd];
  }));
}
