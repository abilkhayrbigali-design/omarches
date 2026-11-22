// Scores the dictionary and the trained model on entries the training never saw.
//
//   node tools/mood-model/evaluate.mjs
//
// Two sets: test-*.jsonl is one topic (moving house) that is absent from the training corpus;
// check-*.jsonl is a mixed sample of ordinary diary topics written without seeing the corpus.
// Reads the weights exactly as the browser does (8-bit file), so the numbers are the shipped model's.
import fs from 'node:fs';
import path from 'node:path';
import {MODEL_FILE, ORDER, compileLexicon, featurize, predict, explain} from '../../app/own-model.mjs';
import {localFeelings} from '../../app/feelings.mjs';
import {languages, storyLanguage} from '../../app/i18n.mjs';
import {demos} from '../../app/demos.mjs';
import {corpus, here, modelDir, score, table} from './common.mjs';

function load(name) {
  const meta = JSON.parse(fs.readFileSync(path.join(modelDir, name + '.json'), 'utf8'));
  const sparse = new Int8Array(fs.readFileSync(path.join(modelDir, name + '.bin')));
  return {...meta, sparse, lexicon: compileLexicon(meta.lexicon)};
}
const model = load(MODEL_FILE);
const baseline = load('mood-2');
const dictionary = text => { const f = localFeelings(text); return ORDER.map(id => f[id]); };
const features = (reader, text) => featurize(text, reader.lexicon, reader.featureVersion);
const own = text => predict(model, features(model, text)).out;
const previous = text => predict(baseline, features(baseline, text)).out;
const comparison = items => [['mood-2', score(items, previous)], [MODEL_FILE, score(items, own)]];

// The floor any reader has to clear: the same average day for every entry.
const seen = corpus('train-');
const average = ORDER.map((_, f) => seen.reduce((sum, item) => sum + item.f[f], 0) / seen.length);
const test = corpus('test-');
console.log(`a topic absent from training (moving house): ${test.length} entries\n`);
console.log(table([['average', score(test, () => average)], ['dict', score(test, dictionary)], ...comparison(test)]));
const check = corpus('check-');
if (check.length) {
  console.log(`\nordinary diary topics, entries written apart from the corpus: ${check.length} entries\n`);
  console.log(table([['average', score(check, () => average)], ['dict', score(check, dictionary)], ...comparison(check)]));
}
for (const locale of languages) {
  const entries = [...test, ...check].filter(item => storyLanguage(item.text, 'ru') === locale);
  if (!entries.length) continue;
  console.log(`\n${locale}: ${entries.length} held-out entries (language detected from text)\n${table(comparison(entries))}`);
}

const contrast = fs.readFileSync(path.join(here, 'corpus', 'contrast.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
for (const locale of languages) {
  const pairs = contrast.filter(item => item.lang === locale);
  console.log(`\n${locale}: ${pairs.length} contrast pairs`);
  for (const [name, guess] of [['mood-2', previous], [MODEL_FILE, own]]) {
    const changes = pairs.map(({feeling, yes, no}) => {
      const index = ORDER.indexOf(feeling);
      return guess(yes)[index] - guess(no)[index];
    });
    const meanChange = changes.reduce((sum, value) => sum + value, 0) / changes.length;
    console.log(`${name}: ${changes.filter(value => value > .02).length}/${changes.length} correct by >0.02, mean margin ${meanChange.toFixed(3)}`);
  }
}

// The six example days carry readings from the OpenAI reader: a second, outside reference.
const reference = demos.filter(day=>day.reading.source==='ai').map(day => ({text: day.story, f: ORDER.map(id => day.reading.feelings[id])}));
console.log(`\nsix example days, against the stored OpenAI readings\n`);
console.log(table([['dict', score(reference, dictionary)], ...comparison(reference)]));

const started = performance.now();
for (const item of test) { const x = features(model, item.text); const {out, parts} = predict(model, x, true); explain(item.text, x, parts, out); }
console.log(`\n${((performance.now() - started) / test.length).toFixed(2)} ms per entry with the reason`);

if (process.argv.includes('--show')) for (const item of reference.concat(test.slice(0, 8))) {
  const x = features(model, item.text);
  const {out, parts} = predict(model, x, true);
  console.log('\n' + item.text.slice(0, 120));
  console.log('label ', item.f.map(v => v.toFixed(2)).join(' '));
  console.log('model ', out.map(v => v.toFixed(2)).join(' '));
  console.log(explain(item.text, x, parts, out));
}
