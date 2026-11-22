// Scores the dictionary and the trained model on the held-out entries.
//
//   node tools/mood-model/evaluate.mjs
//
// Reads the weights exactly as the browser does (8-bit file), so the numbers are the shipped model's.
import fs from 'node:fs';
import path from 'node:path';
import {ORDER, featurize, predict, explain} from '../../app/own-model.mjs';
import {localFeelings} from '../../app/feelings.mjs';
import {demos} from '../../app/demos.mjs';
import {corpus, modelDir, score, table} from './common.mjs';

const meta = JSON.parse(fs.readFileSync(path.join(modelDir, 'mood-1.json'), 'utf8'));
const model = {...meta, sparse: new Int8Array(fs.readFileSync(path.join(modelDir, 'mood-1.bin')).buffer.slice(0))};
const dictionary = text => { const f = localFeelings(text); return ORDER.map(id => f[id]); };
const own = text => predict(model, featurize(text)).out;

// The floor any reader has to clear: the same average day for every entry.
const seen = corpus('train-');
const average = ORDER.map((_, f) => seen.reduce((sum, item) => sum + item.f[f], 0) / seen.length);
const test = corpus('test-');
console.log(`held-out entries: ${test.length}\n`);
console.log(table([['average', score(test, () => average)], ['dict', score(test, dictionary)], ['model', score(test, own)]]));

// The six example days carry readings from the OpenAI reader: a second, outside reference.
const reference = demos.map(day => ({text: day.story, f: ORDER.map(id => day.reading.feelings[id])}));
console.log(`\nsix example days, against the stored OpenAI readings\n`);
console.log(table([['dict', score(reference, dictionary)], ['model', score(reference, own)]]));

const started = performance.now();
for (const item of test) { const x = featurize(item.text); const {out, parts} = predict(model, x, true); explain(item.text, x, parts, out); }
console.log(`\n${((performance.now() - started) / test.length).toFixed(2)} ms per entry with the reason`);

if (process.argv.includes('--show')) for (const item of reference.concat(test.slice(0, 8))) {
  const x = featurize(item.text);
  const {out, parts} = predict(model, x, true);
  console.log('\n' + item.text.slice(0, 120));
  console.log('label ', item.f.map(v => v.toFixed(2)).join(' '));
  console.log('model ', out.map(v => v.toFixed(2)).join(' '));
  console.log(explain(item.text, x, parts, out));
}
