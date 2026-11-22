// Shared by train.mjs and evaluate.mjs: the corpus, the trainer and the scores.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {BITS, ORDER, compileLexicon, featurize, sigmoid} from '../../app/own-model.mjs';
import {storyLanguage} from '../../app/i18n.mjs';

export const here = path.dirname(fileURLToPath(import.meta.url));
export const modelDir = path.resolve(here, '../../app/model');
export const SIZE = 1 << BITS;
const F = ORDER.length;

// The lexicon is kept as one file per language in ./lexicon and merged here: every cue once per feeling.
export function lexiconLists() {
  const dir = path.join(here, 'lexicon');
  const lists = Object.fromEntries(ORDER.map(id => [id, []]));
  if (!fs.existsSync(dir)) return lists;
  for (const name of fs.readdirSync(dir).filter(name => name.endsWith('.json')).sort()) {
    const file = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    for (const id of ORDER) for (const cue of file[id] || []) {
      const clean = String(cue).toLowerCase().replaceAll('ё', 'е').trim();
      // A plain stem shorter than four letters matches too much; such cues must be exact or a pair.
      const text = clean.split(':')[0];
      if (!text || (!text.startsWith('=') && !text.includes(' ') && text.length < 4)) continue;
      if (!lists[id].some(known => known.split(':')[0] === text)) lists[id].push(clean);
    }
  }
  return lists;
}
export const lexicon = compileLexicon(lexiconLists());

export function corpus(prefix) {
  const dir = path.join(here, 'corpus');
  return fs.readdirSync(dir).filter(name => name.startsWith(prefix) && name.endsWith('.jsonl')).sort()
    .flatMap(name => fs.readFileSync(path.join(dir, name), 'utf8').split('\n').filter(line => line.trim())
      // The letter after the prefix is the topic the file belongs to (train-a1 … train-a4 are one topic).
      .map(line => ({...JSON.parse(line), topic: name.slice(prefix.length, prefix.length + 1)})));
}

// Soft-label logistic regression per feeling, AdaGrad, L2 on the weights a step touches.
// useDictionary=false trains the text features alone, to see what the dictionary adds.
export function train(items, {epochs = 40, rate = .3, l2 = 1e-4, useDictionary = true, seed = 7, featureVersion = 2, balance = 0} = {}) {
  const counts = {};
  const langs = items.map(item => {
    const lang = storyLanguage(item.text, 'ru');
    counts[lang] = (counts[lang] || 0) + 1;
    return lang;
  });
  const languageCount = Object.keys(counts).length;
  const data = items.map((item, index) => ({
    x: featurize(item.text, lexicon, featureVersion),
    y: item.f,
    weight: (items.length / (languageCount * counts[langs[index]])) ** balance
  }));
  const denseSize = data[0].x.dense.length;
  const sparse = new Float32Array(SIZE * F), sparseG = new Float32Array(SIZE * F).fill(1e-6);
  const dense = ORDER.map(() => new Float64Array(denseSize)), denseG = ORDER.map(() => new Float64Array(denseSize).fill(1e-6));
  let state = seed;
  const random = () => (state = (Math.imul(state, 1103515245) + 12345) >>> 0) / 2 ** 32;
  const order = data.map((_, i) => i);
  for (let epoch = 0; epoch < epochs; epoch++) {
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    for (const n of order) {
      const {x, y, weight} = data[n];
      const xd = useDictionary ? x.dense : x.dense.map((v, k) => k < 2 * F ? 0 : v);
      for (let f = 0; f < F; f++) {
        let z = 0;
        for (let k = 0; k < x.index.length; k++) z += sparse[x.index[k] * F + f] * x.value[k];
        for (let k = 0; k < denseSize; k++) z += dense[f][k] * xd[k];
        const error = (sigmoid(z) - y[f]) * weight;
        for (let k = 0; k < x.index.length; k++) {
          const at = x.index[k] * F + f;
          const g = error * x.value[k] + l2 * sparse[at];
          sparseG[at] += g * g;
          sparse[at] -= rate * g / Math.sqrt(sparseG[at]);
        }
        for (let k = 0; k < denseSize; k++) {
          const g = error * xd[k];
          denseG[f][k] += g * g;
          dense[f][k] -= rate * g / Math.sqrt(denseG[f][k]);
        }
      }
    }
  }
  return {sparse, scale: new Array(F).fill(1), dense: dense.map(row => [...row]), useDictionary};
}

// Eight bits per weight with one scale per feeling: a quarter of the size, same answers to two decimals.
export function quantize(model) {
  const sparse = new Int8Array(SIZE * F), scale = [];
  for (let f = 0; f < F; f++) {
    let max = 0;
    for (let i = f; i < sparse.length; i += F) max = Math.max(max, Math.abs(model.sparse[i]));
    scale.push(max / 127 || 1);
    for (let i = f; i < sparse.length; i += F) sparse[i] = Math.round(model.sparse[i] / scale[f]);
  }
  return {...model, sparse, scale};
}

// Mean absolute error per feeling and overall; whether the leading feeling and the two
// leading feelings (as a set) agree with the labels.
export function score(items, guess) {
  const error = new Array(F).fill(0);
  let lead = 0, pair = 0;
  const top = values => values.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 2).map(([, i]) => i);
  for (const item of items) {
    const values = guess(item.text);
    values.forEach((v, f) => { error[f] += Math.abs(v - item.f[f]); });
    const [a1, a2] = top(values), [b1, b2] = top(item.f);
    if (a1 === b1) lead++;
    if ((a1 === b1 && a2 === b2) || (a1 === b2 && a2 === b1)) pair++;
  }
  const mae = Object.fromEntries(ORDER.map((id, f) => [id, error[f] / items.length]));
  return {mae, overall: error.reduce((a, b) => a + b, 0) / F / items.length, lead: lead / items.length, pair: pair / items.length, n: items.length};
}

export function table(rows) {
  const head = ['', ...ORDER, 'MAE', 'lead', 'top-2'];
  const lines = [head.map(cell => cell.padEnd(9)).join('')];
  for (const [name, s] of rows)
    lines.push([name.padEnd(9).slice(0, 9), ...ORDER.map(id => s.mae[id].toFixed(3)), s.overall.toFixed(3),
      (s.lead * 100).toFixed(0) + '%', (s.pair * 100).toFixed(0) + '%'].map(cell => String(cell).padEnd(9)).join(''));
  return lines.join('\n');
}
