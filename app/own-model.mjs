// The diary's own reader: a small model that runs on the device and turns the text
// of an entry into the eight numbers, without any outside service.
//
// It is a linear model with a sigmoid per feeling over hashed text features (words,
// five-letter stems, letter n-grams inside words, neighbouring word pairs) plus the
// eight scores of the dictionary as extra inputs. Trained by tools/mood-model/train.mjs
// on a corpus of labelled entries; the weights live in ./model/.
//
// Contract with reading.mjs: ownReading(story) resolves to
//   {feelings: {joy, sadness, calm, tension, festive, quiet, warmth, solitude},  // each 0…1
//    title, reason, source: 'own', model: '<name and version>'}
// or to null when the model cannot be used; the dictionary answers then.
import {cleanFeelings, feelingName, localFeelings, localTitle} from './feelings.mjs';

// Output order of the weights: the four opposite pairs, as in the corpus.
export const ORDER = ['joy', 'sadness', 'calm', 'tension', 'festive', 'quiet', 'warmth', 'solitude'];
export const BITS = 16;
const SIZE = 1 << BITS;
const MODEL_FILE = 'mood-1';

// Russian and English negate the words after them, Kazakh the word before «емес»/«жоқ».
const NEGATE_NEXT = new Set(['не', 'ни', 'без', 'нет', 'not', 'no', 'never', 'didn', 'don', 'wasn', 'isn', 'couldn', 'nothing']);
const NEGATE_PREV = new Set(['емес', 'жоқ']);
const BOOST = new Set(['очень', 'так', 'такой', 'такая', 'такое', 'самый', 'самая', 'невероятно', 'ужасно', 'безумно',
  'слишком', 'совсем', 'жутко', 'дико', 'офигенно', 'өте', 'тым', 'very', 'so', 'really', 'super', 'too']);
const BREAK = /^[.!?,;:—–…()]$/u;

export function tokens(story) {
  const text = String(story ?? '').replaceAll('ё', 'е').replaceAll('Ё', 'Е');
  const list = [];
  for (const match of text.matchAll(/\p{L}+(?:-\p{L}+)*|[.!?,;:—–…()]/gu))
    list.push({word: match[0].toLowerCase(), start: match.index, end: match.index + match[0].length});
  return list;
}

// FNV-1a: a cheap, stable hash that both the trainer and the browser compute identically.
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) & (SIZE - 1);
}

// Returns the sparse vector (L2-normalised so long entries do not shout) and, for every
// feature, the token it came from, which is what the reason sentence is built from.
export function featurize(story) {
  const list = tokens(story);
  const raw = new Map();
  const add = (key, value, owner) => {
    const index = hash(key);
    const slot = raw.get(index);
    if (slot) { slot.value += value; slot.owners.push(owner); } else raw.set(index, {value, owners: [owner]});
  };
  // Negation reaches two words forward, never across punctuation.
  const negated = new Array(list.length).fill(false);
  list.forEach((token, i) => {
    if (NEGATE_NEXT.has(token.word)) for (let j = i + 1; j <= i + 2 && j < list.length && !BREAK.test(list[j].word); j++) negated[j] = true;
    if (NEGATE_PREV.has(token.word) && i > 0 && !BREAK.test(list[i - 1].word)) negated[i - 1] = true;
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
  // Dense inputs: the dictionary's eight scores and the length of the entry.
  const dictionary = localFeelings(story);
  const words = list.filter(token => !BREAK.test(token.word)).length;
  const dense = [...ORDER.map(id => dictionary[id]), Math.min(1, Math.log1p(words) / 5), 1];
  return {index, value, owners, dense, list};
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
    out.push(sigmoid(z));
  }
  return {out, parts};
}

// ---------------------------------------------------------------------------
// In the browser: the weights are fetched once, on the first entry that needs them.
let loading = null;
async function loadModel() {
  const base = new URL('./model/', import.meta.url);
  const [meta, buffer] = await Promise.all([
    fetch(new URL(MODEL_FILE + '.json', base)).then(response => { if (!response.ok) throw new Error('model meta'); return response.json(); }),
    fetch(new URL(MODEL_FILE + '.bin', base)).then(response => { if (!response.ok) throw new Error('model weights'); return response.arrayBuffer(); })
  ]);
  const sparse = new Int8Array(buffer);
  if (meta.bits !== BITS || sparse.length !== SIZE * ORDER.length) throw new Error('model shape');
  return {...meta, sparse};
}

const NAMES = Object.fromEntries(ORDER.map(id => [id, feelingName(id).toLowerCase()]));
// Small words carry weight inside the model but explain nothing to the reader.
const STOP = new Set(('после перед под над при для без через про как так что чтобы где куда когда пока потом тоже также ' +
  'это этот эта эти тот там тут его её ее их мой моя мне меня нас нам вас они она оно был была было были будет есть ' +
  'уже еще ещё только даже очень весь вся все всё сам сама себя свой своя или зато хоть бы ли же вот нет даже между ' +
  'мен сен біз бір бұл сол және бен мен үшін деп еді the and was were with for that this then just have had but not').split(' '));

// The words that pushed the two leading feelings up the most, merged into short phrases
// when they stand next to each other in the entry.
export function explain(story, features, parts, values) {
  const leading = ORDER.map((id, f) => ({id, f, value: values[f]})).sort((a, b) => b.value - a.value).slice(0, 2);
  const weight = new Map();
  for (const {f, value} of leading) for (const [owner, contribution] of parts[f]) weight.set(owner, (weight.get(owner) || 0) + contribution * value);
  const best = [...weight].filter(([owner, score]) => score > 0 && features.list[owner].word.length > 2 && !STOP.has(features.list[owner].word))
    .sort((a, b) => b[1] - a[1]).slice(0, 4).map(([owner]) => owner).sort((a, b) => a - b);
  const phrases = [];
  for (const owner of best) {
    const last = phrases.at(-1);
    if (last && owner - last.to <= 2 && !features.list.slice(last.to + 1, owner + 1).some(token => BREAK.test(token.word))) last.to = owner;
    else phrases.push({from: owner, to: owner});
  }
  const text = String(story);
  const quoted = phrases.slice(0, 3).map(({from, to}) => '«' + text.slice(features.list[from].start, features.list[to].end).replace(/\s+/g, ' ').toLowerCase() + '»');
  const feelings = leading.map(({id}) => NAMES[id]).join(' и ');
  if (!quoted.length) return `Слова записи почти не дали опоры, поэтому оценка ближе к ровному дню: ${feelings}.`;
  const list = quoted.length > 1 ? quoted.slice(0, -1).join(', ') + ' и ' + quoted.at(-1) : quoted[0];
  let reason = `Больше всего весили ${list}: из них модель вывела ${feelings}.`;
  if (reason.length > 160) reason = `Больше всего весило ${quoted[0]}: из этого модель вывела ${feelings}.`;
  return reason.length > 160 ? `Модель вывела ${feelings} по словам этой записи.` : reason;
}

export async function ownReading(story) {
  if (!String(story ?? '').trim()) return null;
  try {
    loading ??= loadModel();
    const model = await loading;
    const features = featurize(story);
    const {out, parts} = predict(model, features, true);
    return {
      feelings: cleanFeelings(Object.fromEntries(ORDER.map((id, f) => [id, out[f]]))),
      title: localTitle(story), reason: explain(story, features, parts, out), source: 'own', model: model.name
    };
  } catch {
    // A missing or broken weights file must not be retried on every entry.
    loading = Promise.reject(new Error('model unavailable'));
    loading.catch(() => {});
    return null;
  }
}
