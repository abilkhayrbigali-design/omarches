// Only known context terms are eligible for fuzzy repair. Ordinary diary words
// are left untouched, and offsets still refer to the author's original text.
const forms = `
хэллоуин хеллоуин наурыз наурызды новый год рождения отмечали праздновали небыло
дождь дождя дождем дождик ливень снег снега снегопад метель гроза гром молния
облака облако облачный тучи пасмурно солнце солнечно ветер ветром туман жара
жарко мороз иней снегом ветра солнышко
halloween nauryz nowruz birthday year celebrate celebrated didnt
rain raining rainy rained drizzle snow snowy snowing blizzard thunder lightning storm
cloud clouds cloudy overcast sunny sunshine sunlight wind windy fog foggy frost freezing heatwave scorching forecast
хэллоуинді жаңа жыл жылды туған күн күнім наурызды тойламадық тойладық
жаңбыр жауған жауды қар найзағай бұлт бұлттар күн ашық жел соқты тұман аптап аяз жоқ болған мүмкін ертең
`.trim().split(/\s+/u);

const fixed = new Map([
  ['дошть','дождь'],['небыло','не было'],['didnt',"didn't"],['кун','күн'],
  ['жэл','жел'],['жл','жыл'],['снг','снег'],['жра','жара'],['гот','год'],['кар','қар'],
  ['хелуин','хэллоуин'],['хэлуин','хэллоуин'],['хелуинді','хэллоуинді'],['айаз','аяз']
]);
const fuzzy = forms.filter(word=>word.length>=4);
const known = new Set([...forms,
  'train','brain','plain','grain','stain','drain','pain','main','chain','rainbow','shown','show','sown',
  'grow','glow','fold','food','fox','fist','list','lost','first','fine','wine','find','mind','kind','wing',
  'mild','gold','told','fort','ford','story','party','staff','staffing','staring','staringly',
  'рука','кран','шар','край','свет','мир','трава','ноосфера'
]);
const foldKazakh = word => word.replace(/[әғқңөүұһі]/gu, ch=>({ә:'а',ғ:'г',қ:'к',ң:'н',ө:'о',ү:'у',ұ:'у',һ:'х',і:'и'})[ch]);

function oneEdit(a,b) {
  if (a.length-b.length>1 || b.length-a.length>1) return false;
  if (a.length>b.length) [a,b]=[b,a];
  let i=0;
  while (i<a.length && a[i]===b[i]) i++;
  if (a.length!==b.length) return a.slice(i)===b.slice(i+1);
  return a.slice(i+1)===b.slice(i+1) ||
    (a[i]===b[i+1] && a[i+1]===b[i] && a.slice(i+2)===b.slice(i+2));
}

const kazakhForms = new Map(forms.filter(word=>/[әғқңөүұһі]/u.test(word)).map(word=>[foldKazakh(word),word]));
const en = s=>/^[a-z]/u.test(s);
const compatible = (a,b)=>en(a)===en(b);

export function normalizeContextText(original) {
  const lowered=original.toLowerCase().replaceAll('ё','е');
  // Keep one original span per output character so evidence can quote the unedited entry.
  const offsets=[];
  let text='', previous=0;
  const kazakh=/[әғқңөүұһі]/u.test(lowered) || /(?:\b|^)(?:bul|jane)(?:\b|$)/u.test(lowered) ||
    /(?<!\p{L})(?:болды|жауды|тойламадык|кешке|болган|болмаган|эдi|еді|болд)(?!\p{L})/u.test(lowered);
  function add(value,start,end,changed=false) {
    text+=value;
    for(let i=0;i<value.length;i++) offsets.push(changed?[start,end]:[start+i,start+i+1]);
  }
  for (const match of lowered.matchAll(/[\p{L}]+/gu)) {
    const word=match[0], index=match.index;
    add(lowered.slice(previous,index),previous,index);
    const before=lowered.slice(Math.max(0,index-12),index), after=lowered.slice(index+word.length,index+word.length+12);
    let corrected=fixed.get(word) ?? (known.has(word)?word:undefined);
    // Short, ambiguous aliases such as «гот» and «кар» require nearby context.
    if (word==='гот' && !/новы[йи]\s+$/u.test(before)) corrected=word;
    if ((word==='кар'||word==='кун'||word==='жл'||word==='жэл') && !kazakh) corrected=word;
    if (!corrected && kazakh) corrected=kazakhForms.get(word);
    if (!corrected && word.length>=4 &&
        (/^(?:д[ао]ж|сн|об[ал]|в[еэ]т|гр[ао]з|тум|м[ао]р|с[ао]н|х[еэ]л|наур|ражд|атмеч|новы|жо|ап[т]|айа|туман)/u.test(word) ||
         (/^[a-z]/u.test(word) && !/^(?:he|she|they|there|this|that|where|from|into|told|want|work|went|long|home|your|close|flow|cover)[a-z]*$/u.test(word)))) {
      const found=fuzzy.filter(candidate=>compatible(candidate,word) && oneEdit(word,candidate));
      const unique=found.length===1 ? found[0] : null;
      if (unique && (unique!=='year' || /new\s+$/u.test(before)) &&
          (unique!=='рождения' || /день\s+$/u.test(before)) &&
          (unique!=='wind' || /(?:blew|blow|gust|strong)/u.test(before+after))) corrected=unique;
    }
    corrected ??= word;
    add(corrected,index,index+word.length,corrected!==word);
    previous=index+word.length;
  }
  add(lowered.slice(previous),previous,lowered.length);
  return {text,quote:(start,end)=>original.slice(offsets[start]?.[0]??original.length,offsets[end-1]?.[1]??original.length)};
}
