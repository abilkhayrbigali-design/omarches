// Emit training only. The audit directory and held-out corpus are never read here.
import fs from 'node:fs';
import {ORDER} from '../../app/own-model.mjs';
import {storyLanguage} from '../../app/i18n.mjs';
import {moodText} from '../../mood-server/mood-text.mjs';
import {corpus} from './common.mjs';

for (const item of corpus('train-')) {
  const order = [...item.f].sort((a,b)=>b-a);
  console.log(JSON.stringify({
    text:moodText(item.text), label:ORDER[item.f.indexOf(order[0])],
    group:'original', gap:order[0]-order[1], lang:storyLanguage(item.text,'ru')
  }));
}
for (const file of ['phrases.tsv','situations.tsv']) {
  for (const line of fs.readFileSync(new URL('./primary/'+file,import.meta.url),'utf8').trim().split('\n')) {
    const [label,...texts] = line.split('\t');
    texts.forEach((text,i)=>console.log(JSON.stringify({text,label,group:'focused',gap:.9,lang:['ru','kk','en'][i]})));
  }
}
