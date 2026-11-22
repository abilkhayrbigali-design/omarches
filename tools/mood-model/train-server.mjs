// Train the server's shared neural layer on the same feature vocabulary as mood-3.
import fs from 'node:fs';
import path from 'node:path';
import {createRandom, fitNetwork} from './train-network.mjs';
import {corpus, lexicon} from './common.mjs';
import {featurize, ORDER} from '../../app/own-model.mjs';
import {storyLanguage} from '../../app/i18n.mjs';

const root = new URL('../../mood-server/', import.meta.url);
const items = corpus('train-');
const data = items.map(({text,f:y}) => ({x:featurize(text,lexicon,3),y,lang:storyLanguage(text,'ru')}));
const profiles = [
  {seed:801, epochs:35, balance:.15, rate:.035, l2:.00025},
  {seed:233, epochs:32, balance:.55, rate:.040, l2:.00035}
];
const members = [];
for (const settings of profiles) {
  const model = fitNetwork(data, settings, createRandom(settings.seed));
  let max = 0;
  for (const value of model.input) max = Math.max(max, Math.abs(value));
  const inputScale = max / 127 || 1;
  const signed = Int8Array.from(model.input, value => Math.round(value / inputScale));
  const file = 'member-' + (members.length + 1) + '.bin';
  fs.writeFileSync(new URL(file, root), signed);
  members.push({file, inputScale, bias:[...model.bias], output:[...model.output], settings});
  console.log('trained', file, settings);
}
fs.writeFileSync(new URL('mood-4.json', root), JSON.stringify({name:'ottisk-mood-4',entries:items.length,order:ORDER,members}) + '\n');
