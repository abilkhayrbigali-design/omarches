// Reading a story: the language model behind the diary's own server (the local one,
// or the small public one of the hosted copy) when the author allows it, otherwise
// the diary's own model on the device, and the dictionary as the last resort.
import {cleanFeelings, localReading, localTitle} from './feelings.mjs';
import {ownReading} from './own-model.mjs';
import {language, storyLanguage} from './i18n.mjs';

export async function readingStatus() {
  const status = async path => {
    try {
      const response = await fetch(path,{cache:'no-store',signal:AbortSignal.timeout(4000)});
      return response.ok ? await response.json() : null;
    } catch { return null; }
  };
  const [info, enhanced] = await Promise.all([status('/api/reading/status'),status('/api/mood')]);
  return {
    available:Boolean(info?.available), model:String(info?.model ?? ''),
    server:Boolean(info || enhanced), hosted:Boolean(info?.hosted), enhanced:Boolean(enhanced?.available)
  };
}

// Without the outside model, the diary's own model reads on the device; the dictionary
// answers only when its weights cannot be loaded.
async function readHere(story) {
  return await ownReading(story) ?? localReading(story);
}

export async function readStory(story, mode) {
  if (!mode) return readHere(story);
  const enhanced = mode==='server';
  const reasonLanguage = language;
  const entryLanguage = storyLanguage(story);
  try {
    const response = await fetch(enhanced ? '/api/mood' : '/api/reading', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({story, reasonLanguage, language:entryLanguage}), signal: AbortSignal.timeout(enhanced ? 58000 : 45000)
    });
    if (response.ok) {
      const data = await response.json();
      const title = String(data.title ?? '').trim();
      const count = title.split(/\s+/).filter(Boolean).length;
      return {
        feelings: cleanFeelings(data.feelings),
        title: count >= 2 && count <= 8 && title.length <= 90 ? title : localTitle(story, entryLanguage),
        reason:String(data.reason ?? '').slice(0, 240), reasonLanguage, language:entryLanguage,
        evidence:enhanced ? data.evidence : undefined, model:String(data.model ?? ''),
        source:enhanced ? 'server' : 'ai'
      };
    }
  } catch { /* Offline or timed out: the reader on the device answers instead. */ }
  return {...await readHere(story), fallback: enhanced ? 'server' : 'ai'};
}
