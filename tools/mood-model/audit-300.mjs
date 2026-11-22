import fs from 'node:fs';
import {ORDER} from '../../app/own-model.mjs';
import {readContext} from '../../app/context.mjs';
import {moodText} from '../../mood-server/mood-text.mjs';
import {loadServerModel, serverPrediction} from '../../mood-server/infer.mjs';
import {occasions, skies} from './audit/contexts.mjs';

const rows = fs.readFileSync(new URL('./audit/moods.tsv',import.meta.url),'utf8').trim().split('\n').map(line=>line.split('\t'));
if (rows.length!==100 || rows.some(row=>row.length!==4)) throw Error('Expected 100 trilingual mood records');
const dump = process.argv.includes('--dump');
const predictions = process.argv.includes('--stdin')
  ? new Map(fs.readFileSync(0,'utf8').trim().split('\n').map(line=>{
    const {lang,index,lead}=JSON.parse(line);
    return [lang+':'+index,lead];
  }))
  : null;
if (predictions && predictions.size!==300) throw Error('Expected 300 semantic predictions');
const model = dump || predictions ? null : await loadServerModel();
const langs=['ru','kk','en'];
const keys=['mood','holiday','weather'];
const threshold=90;
let passed=true;
const diagnostics = process.argv.includes('--show');
const audit = process.argv.includes('--verify');
for (const [column,lang] of langs.entries()) {
  const counts=[0,0,0], byVariant=[[0,0,0],[0,0,0],[0,0,0]], samples=[0,0,0];
  const positives=[0,0], truePositive=[0,0];
  const confusion = new Map();
  for (const [index, row] of rows.entries()) {
    const [mood] = row;
    const holiday=occasions[(index*3+column)%occasions.length];
    const sky=skies[(index*5+column*3)%skies.length];
    const second=index%17===3 ? skies[(index+1)%9] : null;
    const variant=index%10<3?0:index%10<6?1:2;
    samples[variant]++;
    let story=row[column+1];
    if (variant===1) story=story.replace(/[,;:]\s*/gu,' ');
    if (variant===2) {
      const tokens=[...story.matchAll(/\p{L}{5,}/gu)];
      const token=tokens[(index*3+column)%tokens.length];
      if (token) {
        const text=token[0], at=1+(index+column)%(text.length-2);
        story=story.slice(0,token.index)+text.slice(0,at)+text[at+1]+text[at]+text.slice(at+2)+story.slice(token.index+text.length);
      }
    }
    // Alternate the two context sentences around the personal narrative.
    const text=[holiday[lang][variant],story,sky[lang][variant],second?.[lang][variant]].filter(Boolean).join(' ');
    const weather=[...new Set([sky.id,second?.id].filter(Boolean))].sort();
    if (dump) {
      console.log(JSON.stringify({lang,index,variant,text,focus:moodText(text),mood,holiday:holiday.id,weather,date:holiday.date}));
      continue;
    }

    let found;
    if (predictions) {
      found=predictions.get(lang+':'+index);
      if (!ORDER.includes(found)) throw Error('Missing semantic prediction for '+lang+':'+index);
    } else {
      const values=serverPrediction(model,text).values;
      found=ORDER[values.indexOf(Math.max(...values))];
    }
    const context=readContext(text,holiday.date);
    const foundWeather=context.weather.map(item=>item.kind).sort();
    const checks=[found===mood,context.occasion===holiday.id,weather.join()===foundWeather.join()];
    for (const [i,ok] of checks.entries()) if(ok) {counts[i]++;byVariant[variant][i]++;}
    if (!checks[0]) {
      const miss=mood+'→'+found;
      confusion.set(miss,(confusion.get(miss)||0)+1);
    }
    if(holiday.id){positives[0]++;if(checks[1])truePositive[0]++;}
    if(weather.length){positives[1]++;if(checks[2])truePositive[1]++;}
    if(diagnostics && checks.some(ok=>!ok)){
      const result=[found,context.occasion,foundWeather];
      const expected=[mood,holiday.id,weather];
      console.log(lang,index+1,text,JSON.stringify(Object.fromEntries(keys.flatMap((key,i)=>checks[i]?[]:[[key,[expected[i],result[i]]]]))));
    }
  }
  if (dump) continue;
  console.log(lang,JSON.stringify({mood:counts[0],holiday:counts[1],weather:counts[2],samples,byVariant,positives,truePositive,confusion:[...confusion].sort((a,b)=>b[1]-a[1])}));
  passed &&= counts.every(n=>n>=threshold);
}
if (!dump) console.log(passed?'PASS: all 9 categories reached 90/100':'BELOW TARGET: at least one category is under 90/100');
if(audit && !passed)process.exitCode=1;
