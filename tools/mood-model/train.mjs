// Trains the diary's own mood model and writes its weights to app/model/.
//
//   node tools/mood-model/train.mjs          # 5-fold check on the training part, then the final fit
//
// Only the train-*.jsonl files are read here; test-*.jsonl stays unseen until evaluate.mjs.
import fs from 'node:fs';
import path from 'node:path';
import {ORDER, BITS, featurize, predict} from '../../app/own-model.mjs';
import {corpus, modelDir, quantize, score, table, train} from './common.mjs';

// Chosen by the cross-validation below over epochs 30-100, rate .3-1, l2 0-1e-3: MAE moved
// by less than 0.006 across the grid; the stronger penalty agreed best on the leading feelings.
export const SETTINGS = {epochs: 30, rate: .3, l2: 1e-3};
const items = corpus('train-');
console.log(`training entries: ${items.length}`);

// Cross-validation: a fair look at the settings without touching the test set.
if (!process.argv.includes('--fast')) {
  const folds = 5;
  for (const settings of [SETTINGS, {...SETTINGS, useDictionary: false}]) {
    const guesses = new Array(items.length);
    for (let k = 0; k < folds; k++) {
      const model = train(items.filter((_, i) => i % folds !== k), settings);
      items.forEach((item, i) => { if (i % folds === k) guesses[i] = predict(model, featurize(item.text)).out; });
    }
    const index = new Map(items.map((item, i) => [item.text, i]));
    console.log(`\ncross-validation, ${settings.useDictionary === false ? 'text features only' : 'text + dictionary'}`);
    console.log(table([['model', score(items, text => guesses[index.get(text)])]]));
  }
}

const model = quantize(train(items, SETTINGS));
fs.mkdirSync(modelDir, {recursive: true});
fs.writeFileSync(path.join(modelDir, 'mood-1.bin'), Buffer.from(model.sparse.buffer));
fs.writeFileSync(path.join(modelDir, 'mood-1.json'), JSON.stringify({
  name: 'ottisk-mood-1', bits: BITS, order: ORDER, scale: model.scale,
  dense: model.dense.map(row => row.map(v => Math.round(v * 1e5) / 1e5)),
  trained: {entries: items.length, ...SETTINGS}
}) + '\n');
console.log(`\nwrote ${modelDir}/mood-1.bin and mood-1.json`);
