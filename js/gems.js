// gems.js: loads the hunt (the list of gems) from gems.json.

export async function loadHunt(url = 'gems.json') {
  // 'no-cache' asks the server whether the file changed, so a newly
  // published gems.json shows up right away instead of a stale copy.
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`Could not load ${url} (HTTP ${response.status}).`);
  }
  const hunt = await response.json();
  if (!Array.isArray(hunt.gems) || hunt.gems.length === 0) {
    throw new Error(`${url} has no gems in it.`);
  }
  return hunt;
}
