// A diagnostic of the deployed mood-4 weights and the app's context rules.
// Written pairs preserve their intended meaning. This is a small audit of
// selected errors, separate from the training corpus and the regular benchmark.
import {ORDER} from '../../app/own-model.mjs';
import {readContext} from '../../app/context.mjs';
import {loadServerModel, serverPrediction} from '../../mood-server/infer.mjs';

// Language, date, annotated leading mood, holiday, exact weather kinds, clean and noisy text.
const pairs = [
  ['ru','2026-10-31','festive','halloween',['rain'],
    'На Хэллоуин весь вечер танцевали и громко пели. За окном шёл дождь.',
    'На хэлуин весь вечер танцевали и громко пели. За акном шол дошть.'],
  ['ru','2026-01-01','warmth','newyear',['snow'],
    'Новый год встречали дома. Мама укрыла меня пледом и обняла. За окном падал снег.',
    'Новый год встречали дома мама укрил меня пледом и обняла. За окном падали снег.'],
  ['ru','2026-05-09','joy','birthday',['sun'],
    'Сегодня мой день рождения. Я очень обрадовалась подарку. Светило солнце.',
    'Севодня мой день раждения. Я очинь обрадовалась падарку. Светило сонце.'],
  ['ru','2026-03-22','festive','nauryz',['wind'],
    'На Наурыз весь день танцевали. Громко пели и звали всех к столу. На улице дул ветер.',
    'Науриз весь день танцевали громко пела и звали всех к столу. На улице дул ветир.'],
  ['ru','2026-10-11','sadness',null,[],
    'Я весь вечер плакала и скучала по сестре. Дождя не было.',
    'Я весь вечер плакала и скучал по сестра. Дождя небыло.'],
  ['ru','2026-10-31','tension',null,['clouds'],
    'Хэллоуин мы не отмечали. Мне было страшно, я весь вечер тревожилась. Тяжёлые тучи закрыли небо.',
    'Хэллоуин мы не атмечали. Мне было страшна я весь вечер тревожилась. Тяжолые тучи закрыли небо.'],
  ['kk','2026-10-31','festive','halloween',['rain'],
    'Хэллоуин кешінде бәріміз ән айтып, биледік. Сыртта жаңбыр жауды.',
    'Хэллоуин кешінде баримиз ан айтып биледик. Сыртта жанбыр жауды.'],
  ['kk','2026-01-01','warmth','newyear',['frost'],
    'Жаңа жылды үйде қарсы алдық. Анам мені құшақтады. Далада аяз болды.',
    'Жана жылды уйде карсы алдык анам мени кушактады. Далада аяз болд.'],
  ['kk','2026-05-04','joy','birthday',['sun'],
    'Бүгін туған күнім. Сыйлықты көргенде қатты қуандым. Күн ашық болды.',
    'Бугин туган куним. Сыйлыкты коргенде катты куандым. Кун ашык болды.'],
  ['kk','2026-03-22','festive','nauryz',['wind'],
    'Наурызды тойладық. Бәріміз қатты ән айтып, би биледік. Кешке жел соқты.',
    'Наурзды тойладық баримиз катты ан айтып би биледик. Кешке жэл сокты.'],
  ['kk','2026-10-11','sadness',null,[],
    'Жалғыз отырдым, әпкемді сағынып көп жыладым. Жаңбыр жауған жоқ.',
    'Жалгыз отырдым апкемди сагынып коп жыладым. Жанбыр жауган жок.'],
  ['kk','2026-10-31','calm',null,['fog'],
    'Терезе жанында асықпай шай іштім. Өзімді тыныш сезіндім. Сыртта тұман болды.',
    'Терезе жанында асыкпай шаи иштим озимди тыныш сезиндм. Сыртта туман болд.'],
  ['en','2026-10-31','festive','halloween',['rain'],
    'At Halloween we sang and danced at a loud party. It was raining outside.',
    'At Haloween we singed and danced at a loud party. It was rainning outside.'],
  ['en','2026-01-01','warmth','newyear',['snow'],
    'We spent New Year at home. Mum hugged me and wrapped me in a blanket. Snow fell outside.',
    'We spend New Yea at home. Mum huged me and wrap me in a blanket. Snwo fell outside.'],
  ['en','2026-05-09','joy','birthday',['sun'],
    'It was my birthday. I was delighted by the gift and could not stop smiling. It was sunny.',
    'It were my birthday. I was deligted by the gift and could not stop smileing. It was sunny.'],
  ['en','2026-03-22','festive','nauryz',['wind'],
    'We celebrated Nauryz with music and dancing all afternoon. A strong wind blew outside.',
    'We celebratd Naurz with music and dancing all afternoon. A strong wind blowed outside.'],
  ['en','2026-10-11','sadness',null,[],
    'I missed my sister and cried all evening. There was no rain.',
    'I missd my sister and cryed all evening. There were no rain.'],
  ['en','2026-10-31','tension',null,['storm'],
    'We did not celebrate Halloween. I felt nervous and my hands shook. Lightning lit the room.',
    'We didnt celebrate Halloween. I feel nervus and my hands shaked. Lighnting lit the room.']
];

// Agreement, tense or punctuation errors that leave the key words legible.
const grammarOnly = [
  'На Хэллоуин весь вечер танцевали и громко пела. За окном шли дождь.',
  'Новый год встречали дома мама укрыла меня пледом и обняли. За окном падали снег.',
  'Сегодня мой день рождения. Я очень обрадовалась подарки. Светили солнце.',
  'На Наурыз весь день танцевали громко пела и звали всех к столу. На улице дули ветер.',
  'Я весь вечер плакала и скучал по сестра. Дождя не было.',
  'Хэллоуин мы не отмечали. Мне было страшно я весь вечер тревожились. Тяжёлые тучи закрыла небо.',
  'Хэллоуин кешінде бәріміз ән айтып биледім. Сыртта жаңбыр жаудым.',
  'Жаңа жылды үйде қарсы алдым анам мені құшақтадық. Далада аяз болды.',
  'Бүгін туған күнім. Сыйлықты көргенде қатты қуандық. Күн ашық болдым.',
  'Наурызды тойладық бәріміз қатты ән айтып би биледім. Кешке жел соқтым.',
  'Жалғыз отырдық әпкемді сағынып көп жыладым. Жаңбыр жауған жоқ.',
  'Терезе жанында асықпай шай іштік өзімді тыныш сезіндім. Сыртта тұман болдым.',
  'At Halloween we singed and danced at a loud party. It were raining outside.',
  'We spend New Year at home. Mum hugged me and wrap me in a blanket. Snow falled outside.',
  'It were my birthday. I was delighted by the gift and could not stop smiling. It were sunny.',
  'We celebrates Nauryz with music and dancing all afternoon. A strong wind blowed outside.',
  'I missed my sister and cried all evening. There were no rain.',
  'We did not celebrate Halloween. I feel nervous and my hands shaked. Lightning lighted the room.'
];

const model = await loadServerModel();
const lead = values => ORDER[values.indexOf(Math.max(...values))];
const categories = ['mood', 'holiday', 'weather'];
const variants = ['clean','grammar','noisy'];
const totals = Object.fromEntries(variants.map(label=>[label,[0,0,0]]));
for (const language of ['ru', 'kk', 'en']) {
  const counts = Object.fromEntries(variants.map(label=>[label,[0,0,0]]));
  let stability = 0, drift = 0;
  for (const [index,[lang,date,mood,holiday,weather,clean,noisy]] of pairs.entries()) {
    if (lang!==language) continue;
    const guesses = [clean,grammarOnly[index],noisy].map(text=>{
      const {values} = serverPrediction(model,text);
      const context = readContext(text,date);
      const seen = context.weather.map(item=>item.kind);
      return {
        values, mood:lead(values), holiday:context.occasion, weather:seen,
        checks:[lead(values)===mood, context.occasion===holiday, seen.length===weather.length && weather.every(kind=>seen.includes(kind))]
      };
    });
    const [original, , altered] = guesses;
    if (original.mood===altered.mood) stability++;
    drift+=original.values.reduce((sum,value,i)=>sum+Math.abs(value-altered.values[i]),0)/ORDER.length;
    for (const [variant,label] of variants.entries()) guesses[variant].checks.forEach((ok,i)=>{
      counts[label][i]+=Number(ok);
      totals[label][i]+=Number(ok);
    });
    const missed = altered.checks.flatMap((ok,i)=>ok?[]:[categories[i]]);
    if (missed.length) console.log(language, JSON.stringify(noisy), 'missed', missed.join(','), JSON.stringify({expected:{mood,holiday,weather}, predicted:{mood:altered.mood,holiday:altered.holiday,weather:altered.weather}}));
  }
  console.log(language, 'mood/holiday/weather exact (clean → grammar → noisy)', ...variants.map(label=>counts[label].join('/')), 'out of 6 each; mood stayed the same with noise',stability,'/ 6; vector MAE', (drift/6).toFixed(3));
}

console.log('all:', totals, 'out of',pairs.length,'for each capability');

for (const date of ['2026-10-31','2026-01-01','2026-03-22']) {
  const neutral = readContext('Обычный день. Работала и вернулась домой.',date);
  console.log('neutral entry on',date,':',neutral.occasion,neutral.weather);
}
