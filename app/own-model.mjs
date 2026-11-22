// The diary's own reader: a small model that runs on the device and turns the text
// of an entry into the eight numbers, without any outside service.
//
// It is a linear model with a sigmoid per feeling over hashed text features (words,
// five-letter stems, letter n-grams inside words, neighbouring word pairs) plus scores
// from the built-in dictionary and the multilingual lexicon, both across the whole
// entry and in individual clauses. tools/mood-model/train.mjs trains the reader; its
// quantized weights and lexicon live in ./model/.
//
// Contract with reading.mjs: ownReading(story) resolves to
//   {feelings: {joy, sadness, calm, tension, festive, quiet, warmth, solitude},  // each 0…1
//    title, reason, source: 'own', model: '<name and version>'}
// or to null when the model cannot be used; the dictionary answers then.
import {language, storyLanguage, t} from './i18n.mjs';
import {cleanFeelings, feelingName, localFeelings, localTitle} from './feelings.mjs';
import {storyMoments} from './story-scene.mjs';

// Output order of the weights: the four opposite pairs, as in the corpus.
export const ORDER = ['joy', 'sadness', 'calm', 'tension', 'festive', 'quiet', 'warmth', 'solitude'];
export const BITS = 16;
const SIZE = 1 << BITS;
export const MODEL_FILE = 'mood-3';

// Russian and English negate the words after them, Kazakh the word before «емес»/«жоқ».
const NEGATE_NEXT = new Set(['не', 'ни', 'без', 'нет', 'not', 'no', 'never', 'didn', 'don', 'wasn', 'isn', 'couldn', 'nothing']);
const NEGATE_PREV = new Set(['емес', 'жоқ']);
const BOOST = new Set(['очень', 'так', 'такой', 'такая', 'такое', 'самый', 'самая', 'невероятно', 'ужасно', 'безумно',
  'слишком', 'совсем', 'жутко', 'дико', 'офигенно', 'өте', 'тым', 'very', 'so', 'really', 'super', 'too']);
const BREAK = /^[.!?,;:—–…()]$/u;
const CLAUSE_BREAK = /[.!?;:—–…()]/u;
const TURN = new Set(['но', 'зато', 'однако', 'хотя', 'but', 'yet', 'however', 'although', 'though', 'бірақ', 'алайда', 'дегенмен']);
const POST_NEGATION = /^(?:болма(?:ды|ған|йды|п)|емес(?:пін|піз|сің|сіз|ті|тей)?|жоқ(?:пын|пыз|сың|сыз)?)$/u;
const CONTRACTION = /n't$/u;
const NOT_ONLY = new Set(['только', 'лишь', 'only', 'just']);
const RUSSIAN_ABSENCE = new Set(['было', 'были', 'случилось', 'получилось', 'оказалось']);

export function tokens(story, version = 2) {
  const text = String(story ?? '').replaceAll('ё', 'е').replaceAll('Ё', 'Е');
  const list = [];
  const pattern = version >= 3 ? /\p{L}+(?:[-'’]\p{L}+)*|[.!?,;:—–…()]/gu : /\p{L}+(?:-\p{L}+)*|[.!?,;:—–…()]/gu;
  for (const match of text.matchAll(pattern)) {
    const word = match[0].toLowerCase();
    list.push({word: version >= 3 ? word.replaceAll('’', "'") : word, start: match.index, end: match.index + match[0].length});
  }
  return list;
}

// FNV-1a: a cheap, stable hash that both the trainer and the browser compute identically.
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) & (SIZE - 1);
}

// The lexicon: cues for every feeling, 'stem' (the start of a word), '=word' (the whole
// word) or 'two words' (neighbours), each with an optional ':weight'. Compiled once into
// lookups by whole word, by the first three letters of a stem and by the first word of a pair.
export function compileLexicon(lists) {
  if (!lists) return null;
  const exact = new Map(), stems = new Map(), pairs = new Map();
  const put = (map, key, cue) => { if (map.has(key)) map.get(key).push(cue); else map.set(key, [cue]); };
  ORDER.forEach((id, f) => {
    for (const entry of lists[id] || []) {
      const [raw, weight] = String(entry).toLowerCase().replaceAll('ё', 'е').split(':');
      const w = Number(weight) || 1;
      if (raw.includes(' ')) { const [first, second] = raw.split(' '); put(pairs, first, {f, w, second}); }
      else if (raw.startsWith('=')) put(exact, raw.slice(1), {f, w});
      else if (raw.length >= 3) put(stems, raw.slice(0, 3), {f, w, text: raw});
    }
  });
  return {exact, stems, pairs};
}

// Eight lexicon scores for an entry, and for each of them the tokens that gave it.
function lexiconScores(list, negated, lexicon) {
  const sums = new Array(ORDER.length).fill(0);
  const owners = ORDER.map(() => []);
  if (!lexicon) return {scores: sums, owners};
  list.forEach((token, i) => {
    const word = token.word;
    if (BREAK.test(word)) return;
    // One word is one piece of evidence per feeling: the strongest cue it matches.
    const best = new Array(ORDER.length).fill(0);
    for (const cue of lexicon.exact.get(word) || []) best[cue.f] = Math.max(best[cue.f], cue.w);
    for (const cue of lexicon.stems.get(word.slice(0, 3)) || []) if (word.startsWith(cue.text)) best[cue.f] = Math.max(best[cue.f], cue.w);
    const next = list[i + 1];
    if (next && !BREAK.test(next.word)) for (const cue of lexicon.pairs.get(word) || []) if (next.word.startsWith(cue.second)) best[cue.f] = Math.max(best[cue.f], cue.w);
    const boost = i > 0 && BOOST.has(list[i - 1].word) ? 1.4 : 1;
    best.forEach((weight, f) => {
      if (!weight) return;
      // «Не страшно» is evidence of the opposite feeling, at a lower weight.
      const at = negated[i] ? f ^ 1 : f, amount = weight * boost * (negated[i] ? .6 : 1);
      sums[at] += amount;
      owners[at].push([i, amount]);
    });
  });
  return {scores: sums.map(sum => 1 - Math.exp(-sum / 2.5)), owners: owners.map((hits, f) => hits.map(([i, amount]) => [i, amount / sums[f]]))};
}

// Returns the sparse vector (L2-normalised so long entries do not shout) and, for every
// feature, the token it came from, which is what the reason sentence is built from.
export function featurize(story, lexicon = null, version = 2) {
  const list = tokens(story, version);
  const raw = new Map();
  const add = (key, value, owner) => {
    const index = hash(key);
    const slot = raw.get(index);
    if (slot) { slot.value += value; slot.owners.push(owner); } else raw.set(index, {value, owners: [owner]});
  };
  const negated = new Array(list.length).fill(false);
  const negators = new Map();
  list.forEach((token, i) => {
    const next = list[i + 1]?.word;
    const modern = version >= 3;
    const forward = NEGATE_NEXT.has(token.word) || (modern && CONTRACTION.test(token.word));
    if (forward && !(modern && NOT_ONLY.has(next))) {
      const limit = version >= 3 ? 4 : 2;
      for (let j = i + 1; j <= i + limit && j < list.length; j++) {
        if (BREAK.test(list[j].word) || (version >= 3 && TURN.has(list[j].word))) break;
        negated[j] = true;
        if (modern) negators.set(j, [i, i]);
      }
    }
    if (NEGATE_PREV.has(token.word) || (modern && (POST_NEGATION.test(token.word)
        || (token.word === 'не' && RUSSIAN_ABSENCE.has(next))))) {
      for (let j = i - 1; j >= Math.max(0, i - (version >= 3 ? 3 : 1)); j--) {
        if (BREAK.test(list[j].word) || (version >= 3 && TURN.has(list[j].word))) break;
        negated[j] = true;
        if (modern) negators.set(j, [i, token.word === 'не' ? i + 1 : i]);
      }
    }
  });
  let previous = null;
  list.forEach((token, i) => {
    const word = token.word;
    if (BREAK.test(word)) { if (word === '!' || word === '?' || word === '…') add('p:' + word, .5, i); previous = null; return; }
    const strength = previous && BOOST.has(previous.word) ? 1.5 : 1;
    const mark = negated[i] ? '!' : '';
    add(mark + 'w:' + word, strength, i);
    if (word.length > 5) add(mark + 's:' + word.slice(0, 5), strength, i);
    // Letter n-grams carry the meaning of endings and of words never seen in training.
    const padded = '<' + word + '>';
    for (const n of [3, 4]) for (let k = 0; k + n <= padded.length; k++) add(mark + 'c:' + padded.slice(k, k + n), .4 * strength, i);
    if (previous) add('b:' + previous.word + ' ' + word, .7, i);
    previous = token;
  });
  let norm = 0;
  for (const slot of raw.values()) { slot.value = Math.log1p(slot.value); norm += slot.value * slot.value; }
  norm = Math.sqrt(norm) || 1;
  const index = [], value = [], owners = [];
  for (const [key, slot] of raw) { index.push(key); value.push(slot.value / norm); owners.push(slot.owners); }
  // Dense inputs: the dictionary's eight scores, the lexicon's eight and the length of the entry.
  const dictionary = localFeelings(story);
  const lex = lexiconScores(list, negated, lexicon);
  const words = list.filter(token => !BREAK.test(token.word)).length;
  const dense = [...ORDER.map(id => dictionary[id]), ...lex.scores, Math.min(1, Math.log1p(words) / 5), 1];
  const denseOwners = new Map(lex.owners.map((hits, f) => [ORDER.length + f, hits]));
  if (version >= 3) {
    const clauses = [];
    let start = 0;
    list.forEach(({word}, i) => {
      if (!CLAUSE_BREAK.test(word) && !TURN.has(word)) return;
      if (i > start) clauses.push([start, i]);
      start = i + 1;
    });
    if (start < list.length) clauses.push([start, list.length]);
    const peak = ORDER.map(() => ({score: 0, hits: []}));
    for (const [a, b] of clauses) {
      const local = lexiconScores(list.slice(a, b), negated.slice(a, b), lexicon);
      local.scores.forEach((score, f) => {
        if (score > peak[f].score) peak[f] = {score, hits: local.owners[f].map(([i, share]) => [i + a, share])};
      });
    }
    peak.forEach(({score, hits}) => {
      denseOwners.set(dense.length, hits);
      dense.push(score);
    });
    const lang = storyLanguage(story, 'ru');
    dense.push(Number(lang === 'kk'), Number(lang === 'en'), Math.min(1, clauses.length / 5));
  }
  return {index, value, owners, dense, list, denseOwners, negators};
}

export const sigmoid = z => 1 / (1 + Math.exp(-z));

// weights: {sparse: Float32Array|Int8Array of SIZE * 8, scale: [8], dense: [[...]]}
export function predict(model, features, attribution = false) {
  const out = [];
  const parts = attribution ? ORDER.map(() => new Map()) : null;
  for (let f = 0; f < ORDER.length; f++) {
    let z = 0;
    const scale = model.scale[f];
    for (let k = 0; k < features.index.length; k++) {
      const contribution = model.sparse[features.index[k] * ORDER.length + f] * scale * features.value[k];
      z += contribution;
      // A hashed slot shared by several tokens splits its weight between them.
      if (parts) for (const owner of features.owners[k]) parts[f].set(owner, (parts[f].get(owner) || 0) + contribution / features.owners[k].length);
    }
    const dense = model.dense[f];
    for (let k = 0; k < features.dense.length; k++) z += dense[k] * features.dense[k];
    // What the lexicon added is credited to the words that matched it.
    if (parts) features.denseOwners.forEach((hits, k) => {
      const contribution = dense[k] * features.dense[k];
      for (const [owner, share] of hits) parts[f].set(owner, (parts[f].get(owner) || 0) + contribution * share);
    });
    out.push(sigmoid(z));
  }
  return {out, parts};
}

// ---------------------------------------------------------------------------
// In the browser: the weights are fetched once, on the first entry that needs them.
let loading = null;
async function loadModel(name) {
  const base = new URL('./model/', import.meta.url);
  const [meta, buffer] = await Promise.all([
    fetch(new URL(name + '.json', base)).then(response => { if (!response.ok) throw new Error('model meta'); return response.json(); }),
    fetch(new URL(name + '.bin', base)).then(response => { if (!response.ok) throw new Error('model weights'); return response.arrayBuffer(); })
  ]);
  const sparse = new Int8Array(buffer);
  const denseSize = featurize('', null, meta.featureVersion).dense.length;
  if (meta.bits !== BITS || sparse.length !== SIZE * ORDER.length || meta.order?.join() !== ORDER.join()
      || meta.scale?.length !== ORDER.length || !meta.scale.every(value => Number.isFinite(value) && value > 0)
      || meta.dense?.length !== ORDER.length || !meta.dense.every(row => row?.length === denseSize && row.every(Number.isFinite))) {
    throw new Error('model shape');
  }
  return {...meta, sparse, lexicon: compileLexicon(meta.lexicon)};
}

// Small words carry weight inside the model but explain nothing to the reader.
const STOP = new Set(('после перед под над при для без через про как так что чтобы где куда когда пока потом тоже также ' +
  'это этот эта эти тот там тут его её ее их мой моя мне меня нас нам вас они она оно был была было были будет есть ' +
  'уже еще ещё только даже очень весь вся все всё сам сама себя свой своя или зато хоть бы ли же вот нет даже между ' +
  'мен сен біз бір бұл сол және бен мен үшін деп еді the and was were with for that this then just have had but not').split(' '));

// The words that pushed the two leading feelings up the most, merged into short phrases
// when they stand next to each other in the entry.
export function readingEvidence(story, features, parts, values) {
  const leading = ORDER.map((id, f) => ({id, f, value: values[f]})).sort((a, b) => b.value - a.value).slice(0, 2);
  const weight = new Map();
  for (const {f, value} of leading) for (const [owner, contribution] of parts[f]) weight.set(owner, (weight.get(owner) || 0) + contribution * value);
  const best = [...weight].filter(([owner, score]) => score > 0 && features.list[owner].word.length > 2 && !STOP.has(features.list[owner].word))
    .sort((a, b) => b[1] - a[1]).slice(0, 4).map(([owner]) => {
      const [start, end] = features.negators.get(owner) ?? [owner, owner];
      return {from: Math.min(owner, start), to: Math.max(owner, end)};
    }).sort((a, b) => a.from - b.from);
  const phrases = [];
  for (const phrase of best) {
    const last = phrases.at(-1);
    if (last && phrase.from - last.to <= 2
        && !features.list.slice(last.to + 1, phrase.from + 1).some(token => BREAK.test(token.word) || TURN.has(token.word))) {
      last.to = Math.max(last.to, phrase.to);
    } else phrases.push(phrase);
  }
  const text = String(story);
  const quotes = phrases.slice(0, 3).map(({from, to}) =>
    text.slice(features.list[from].start, features.list[to].end).replace(/\s+/g, ' ').toLowerCase());
  return {quotes, feelings: leading.map(({id}) => id)};
}

export function readingReason({quotes, feelings}) {
  const join = items => items.length < 2 ? (items[0] ?? '') : items.slice(0, -1).join(', ') + t(' и ') + items.at(-1);
  const labels = join(feelings.map(id => language === 'ru' && id === 'quiet' ? 'тишину' : feelingName(id).toLowerCase()));
  const quoted = quotes.map(text => language === 'en' ? '“' + text + '”' : '«' + text + '»');
  if (!quoted.length) return t`Слова записи почти не дали опоры, поэтому оценка ближе к ровному дню: ${labels}.`;
  const reason = t`Больше всего весили ${join(quoted)}: из них модель вывела ${labels}.`;
  if (reason.length <= 160) return reason;
  const shorter = t`Больше всего весило ${quoted[0]}: из этого модель вывела ${labels}.`;
  return shorter.length <= 160 ? shorter : t`Модель вывела ${labels} по словам этой записи.`;
}

export const explain = (story, features, parts, values) => readingReason(readingEvidence(story, features, parts, values));

export async function ownReading(story) {
  if (!String(story ?? '').trim()) return null;
  try {
    loading ??= loadModel(MODEL_FILE).catch(() => loadModel('mood-2'));
    const model = await loading;
    const features = featurize(story, model.lexicon, model.featureVersion);
    const {out, parts} = predict(model, features, true);
    const evidence = readingEvidence(story, features, parts, out);
    const lang = storyLanguage(story);
    const mood = values => Object.fromEntries(ORDER.map((id, index) => [id, values[index]]));
    const moments = storyMoments(story, part => mood(predict(model, featurize(part, model.lexicon, model.featureVersion)).out))
      ?? storyMoments(story);
    return {
      feelings: cleanFeelings(mood(out)), moments,
      title: localTitle(story, lang), reason: readingReason(evidence), evidence, language: lang, source: 'own', model: model.name
    };
  } catch {
    // A missing or broken weights file must not be retried on every entry.
    loading = Promise.reject(new Error('model unavailable'));
    loading.catch(() => {});
    return null;
  }
}
