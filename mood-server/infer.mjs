import {readFile} from 'node:fs/promises';
import {compileLexicon, featurize, ORDER, predict, readingEvidence} from '../app/own-model.mjs';
import {cleanFeelings, localTitle} from '../app/feelings.mjs';
import {storyLanguage} from '../app/i18n.mjs';
import {HIDDEN, networkForward, networkWeights} from './network.mjs';

export const serverModelName = 'ottisk-mood-4';
let ready;
const json = async url => JSON.parse(await readFile(url, 'utf8'));

export function loadServerModel() {
  ready ??= (async () => {
    const [meta, baseline, bytes, first, second] = await Promise.all([
      json(new URL('./mood-4.json', import.meta.url)),
      json(new URL('../app/model/mood-3.json', import.meta.url)),
      readFile(new URL('../app/model/mood-3.bin', import.meta.url)),
      readFile(new URL('./member-1.bin', import.meta.url)),
      readFile(new URL('./member-2.bin', import.meta.url))
    ]);
    if (meta.name !== serverModelName || meta.members.length !== 2 || [first, second].some(input=>input.length!==networkWeights)) {
      throw new Error('Invalid mood model weights');
    }
    const lexicon = compileLexicon(baseline.lexicon);
    return {
      baseline:{...baseline,sparse:new Int8Array(bytes),lexicon}, lexicon,
      neural:[first,second].map((input,index)=>({...meta.members[index],input:new Int8Array(input)}))
    };
  })();
  return ready;
}

export function serverPrediction(model, story, attribution = false) {
  const features = featurize(story,model.lexicon,3);
  const {out,parts} = predict(model.baseline,features,attribution);
  const hidden = new Float32Array(HIDDEN);
  const [first,second] = model.neural.map(member=>networkForward(member,features,hidden,new Float32Array(ORDER.length)));
  const values = out.map((value,index)=>.7*value + .1*first[index] + .2*second[index]);
  return {values, evidence:attribution ? readingEvidence(story,features,parts,values) : undefined};
}

export async function readOnServer(story, fallback = 'ru') {
  const model = await loadServerModel();
  const {values,evidence} = serverPrediction(model,story,true);
  const language = storyLanguage(story,fallback);
  return {
    model:serverModelName, language, evidence,
    title:localTitle(story,language),
    feelings:cleanFeelings(Object.fromEntries(ORDER.map((id,index)=>[id,values[index]])))
  };
}
