// Compare the exact server ensemble and bundled browser reader on held-out stories.
import {featurize, predict} from '../../app/own-model.mjs';
import {languages, storyLanguage} from '../../app/i18n.mjs';
import {loadServerModel, serverPrediction} from '../../mood-server/infer.mjs';
import {corpus, score, table} from './common.mjs';

const model = await loadServerModel();
const local = story => predict(model.baseline,featurize(story,model.lexicon,3)).out;
const enhanced = story => serverPrediction(model,story).values;
const heldOut = [...corpus('test-'), ...corpus('check-')];
for (const [label, items] of [
  ['all',heldOut],
  ...languages.map(lang=>[lang,heldOut.filter(item=>storyLanguage(item.text,'ru')===lang)])
]) {
  console.log(`\n${label}: ${items.length} held-out entries\n${table([['mood-3',score(items,local)],['mood-4',score(items,enhanced)]])}`);
}
