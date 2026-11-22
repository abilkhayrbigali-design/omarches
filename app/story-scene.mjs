import {IDS, PAIRS, cleanFeelings, localFeelings, ranking} from './feelings.mjs';

const words = text => text.toLowerCase().match(/\p{L}+(?:[-'’]\p{L}+)*/gu) ?? [];
const normalize = text => text.trim().replace(/\s+/gu, ' ');

// A quote is always cut from the entry. Recall and sensory cues rank above a
// sentence that only describes the author's general mood.
const MEMORY = /(?:на память|запомн|сохранил|положил|спрятал|оставил|помню|for keeps|as a keepsake|kept |tucked|remember|есімде|естелік|сақта|қалдыр)/iu;
const SENSORY = /(?:пахл|запах|аромат|хруст|шорох|стук|звен|шепот|шёпот|глоток|обжиг|привкус|на ощупь|дрожал|шурш|мерц|smell|scent|crunch|rustl|whisper|rattl|flicker|taste|иіс|сыбдыр|дәм|діріл|жыпылық)/iu;
const CONCRETE = /(?:пальц|ладон|рукав|карман|пуговиц|кружк|стакан|чашк|ключ|билет|письмо|шарф|полоск|пятно|sleeve|pocket|button|cup|mug|ticket|letter|scarf|stripe|қалта|түйме|кесе|билет|хат|шарф)/iu;

export function storyExcerpt(story) {
  const sentences = story.trim().split(/(?<=[.!?…])\s+|\n+/u).map(normalize).filter(Boolean);
  const score = sentence => {
    const length = sentence.length;
    return (MEMORY.test(sentence) ? 5 : 0) + (SENSORY.test(sentence) ? 3 : 0)
      + (CONCRETE.test(sentence) ? 2 : 0) - Math.abs(length - 83) / 100
      - (length > 152 ? 2 : 0);
  };
  const best = sentences.reduce((a, b) => score(b) > score(a) ? b : a, sentences[0] ?? '');
  if (best.length <= 152) return best;
  const cue = [MEMORY, SENSORY, CONCRETE].map(pattern => best.search(pattern)).find(index => index >= 0) ?? 0;
  const start = Math.min(Math.max(0, cue - 34), best.length - 150);
  const end = start + 150;
  let quote = best.slice(start, end);
  if (start && best[start - 1] !== ' ') quote = quote.replace(/^\S+ /u, '');
  if (end < best.length && best[end] !== ' ') quote = quote.replace(/ \S*$/u, '');
  return (start ? '…' : '') + quote.trim().replace(/[,;:—–]+$/u, '') + (end < best.length ? '…' : '');
}

// A later time or an explicit sequence indicates when a change happened. A bare
// "but" is insufficient: someone can feel both things at the same time.
const LATER = /(?<![\p{L}\p{N}])(?:(?:а |но )?(?:потом|затем|позже|спустя|после этого|к вечеру|под вечер|вечером|ночью|в конце дня|в конце концов|наконец)|(?:and |but )?(?:then|later|afterwards|in the evening|by evening|at the end of the day|eventually|finally)|(?:ал )?(?:сосын|содан кейін|кейінірек|кейін|кешке қарай|кешке|ақырында))(?![\p{L}\p{N}])/giu;

export function storyMoments(story, measure = localFeelings) {
  const text = story.trim();
  const candidates = [...text.matchAll(LATER)]
    .filter(match => match.index >= 8 && text.length - match.index >= 12)
    .sort((a, b) => Math.abs(a.index / text.length - .5) - Math.abs(b.index / text.length - .5))
    .slice(0, 4);
  let best = null;
  for (const match of candidates) {
    const parts = [text.slice(0, match.index).trim(), text.slice(match.index + match[0].length).trim()];
    if (parts.some(part => words(part).length < 2)) continue;
    const phases = parts.map(part => cleanFeelings(measure(part)));
    const [first, last] = phases;
    const a = ranking(first).lead, b = ranking(last).lead;
    if (!a || !b || a === b || first[a] < .32 || last[b] < .32) continue;
    if (first[a] - last[a] < .14 || last[b] - first[b] < .14) continue;
    const distance = Math.max(...PAIRS.map(({a, b}) => Math.abs((first[a] - first[b]) - (last[a] - last[b]))));
    const spread = IDS.reduce((sum, id) => sum + Math.abs(first[id] - last[id]), 0);
    if (distance < .30 || spread < .75) continue;
    if (!best || best.spread < spread) best = {phases, spread};
  }
  return best?.phases;
}
