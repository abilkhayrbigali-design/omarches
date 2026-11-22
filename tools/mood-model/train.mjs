// Trains the diary's own mood model on this computer and writes its weights to app/model/.
//
//   node tools/mood-model/train.mjs          # a check on topics the model has not seen, then the final fit
//   node tools/mood-model/train.mjs --fast   # the final fit only
//
// Only the train-*.jsonl files are read here; test-*.jsonl and check-*.jsonl stay unseen until evaluate.mjs.
import fs from 'node:fs';
import path from 'node:path';
import {ORDER, BITS, MODEL_FILE, featurize, predict} from '../../app/own-model.mjs';
import {corpus, lexicon, lexiconLists, modelDir, quantize, score, table, train} from './common.mjs';

// Selected with grouped validation on training topics. Separate test, check and contrast
// examples are only read by evaluate.mjs.
export const SETTINGS = {featureVersion: 3, epochs: 40, rate: .3, l2: .0003, balance: .3};
const items = corpus('train-');
const topics = [...new Set(items.map(item => item.topic))];
console.log(`training entries: ${items.length}, topics: ${topics.length}`);

// Leave one topic out: the model is fitted on the other topics and reads the one it has not
// seen. This is the question a diary asks of it, and it never touches the test sets.
if (!process.argv.includes('--fast')) {
  for (const settings of [SETTINGS, {...SETTINGS, useDictionary: false}]) {
    const guesses = new Map();
    for (const topic of topics) {
      const model = train(items.filter(item => item.topic !== topic), settings);
      for (const item of items) if (item.topic === topic) guesses.set(item, predict(model, featurize(item.text, lexicon, settings.featureVersion)).out);
    }
    const index = new Map(items.map(item => [item.text, item]));
    console.log(`\na topic the model has not seen, ${settings.useDictionary === false ? 'text features only' : 'text + dictionary + lexicon'}`);
    console.log(table([['model', score(items, text => guesses.get(index.get(text)))]]));
  }
}

const model = quantize(train(items, SETTINGS));
fs.mkdirSync(modelDir, {recursive: true});
fs.writeFileSync(path.join(modelDir, MODEL_FILE + '.bin'), Buffer.from(model.sparse.buffer));
fs.writeFileSync(path.join(modelDir, MODEL_FILE + '.json'), JSON.stringify({
  name: 'ottisk-' + MODEL_FILE, bits: BITS, featureVersion: SETTINGS.featureVersion, order: ORDER, scale: model.scale,
  dense: model.dense.map(row => row.map(v => Math.round(v * 1e5) / 1e5)),
  lexicon: lexiconLists(),
  trained: {entries: items.length, topics: topics.length, ...SETTINGS}
}) + '\n');
console.log(`\nwrote ${modelDir}/${MODEL_FILE}.bin and ${MODEL_FILE}.json`);
