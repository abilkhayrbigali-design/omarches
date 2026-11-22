// Reading a story: the language model behind the diary's own server (the local one,
// or the small public one of the hosted copy) when the author allows it, otherwise
// the dictionary that never leaves the device.
import {cleanFeelings, localReading, localTitle} from './feelings.mjs';

export async function readingStatus() {
  try {
    const response = await fetch('/api/reading/status', {cache: 'no-store', signal: AbortSignal.timeout(4000)});
    if (response.ok) {
      const info = await response.json();
      return {available: Boolean(info.available), model: String(info.model ?? ''), server: true, hosted: Boolean(info.hosted)};
    }
  } catch { /* A static copy of the diary has no server. */ }
  return {available: false, model: '', server: false, hosted: false};
}

export async function readStory(story, useModel) {
  if (!useModel) return localReading(story);
  try {
    const response = await fetch('/api/reading', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({story}), signal: AbortSignal.timeout(45000)
    });
    if (response.ok) {
      const data = await response.json();
      const title = String(data.title ?? '').trim();
      const count = title.split(/\s+/).filter(Boolean).length;
      return {
        feelings: cleanFeelings(data.feelings),
        title: count >= 2 && count <= 8 && title.length <= 90 ? title : localTitle(story),
        reason: String(data.reason ?? '').slice(0, 240), model: String(data.model ?? ''), source: 'ai'
      };
    }
  } catch { /* Offline or timed out: the dictionary answers instead. */ }
  return {...localReading(story), fallback: true};
}
