import {extraExamples} from './example-days.mjs';
import {ayaulymDay} from './ayaulym-day.mjs';
import {readContext} from './context.mjs';
import {language, t} from './i18n.mjs';
import {feelingLabel} from './feelings.mjs';
import {storyExcerpt} from './atmosphere.mjs';
import {musicRights} from './music-rights.mjs';

// Six invented days. Their readings were produced once by the same language
// model that reads new entries (gpt-5.6-terra) and are stored here, the way a
// saved day keeps its reading, so the examples open without a key.
const reading = (title, [joy, sadness, calm, tension, festive, quiet, warmth, solitude], reason) =>
  ({title, reason, source:'ai', model:'gpt-5.6-terra', feelings:{joy, sadness, calm, tension, festive, quiet, warmth, solitude}});

const originalDemos = [
  ['maple','2026-11-19','Осенью мы встретились в парке после работы. На скамейке под клёном золотые листья прилипали к рукавам, и в ладонях грелось какао. Мы долго говорили, пока не погас последний тёплый луч.','Шорох и какао',[68,.24,-.2],['maple','park','bench'],'baya','Бая',
    reading('Какао под осенним клёном',[.72,.12,.84,.03,.08,.76,.90,.04],'Встреча в парке после работы, тёплое какао и долгий разговор на закате создают тихую, близкую атмосферу.')],
  ['office','2026-11-15','Ночь в офисе перед сдачей проекта. Ноутбук светил в лицо, по стеклу ползла синяя полоска неона. До дедлайна оставалось пять минут. Мы смотрели, как полоска загрузки идёт дальше.','Последняя сборка',[144,.90,0],['office'],'eugene','Евгений',
    reading('Неон на офисном стекле',[.08,.06,.05,.94,.09,.62,.28,.38],'Ночь в офисе, свет ноутбука и пять минут до дедлайна создают почти предельное напряжение в тихом ожидании загрузки.')],
  ['train','2026-11-12','Впервые ехала этим поездом. За окном показался рассвет, и край гор на секунду стал розовым. Стакан дрожал на столике, дорога только начиналась, и всё было впереди.','Первый свет',[100,.52,.52],['train'],'kseniya','Ксения',
    reading('Розовый рассвет в поезде',[.62,.05,.67,.12,.08,.71,.18,.48],'Рассвет, розовые горы за окном и дрожащий стакан в начале дороги создают тихое ожидание нового.')],
  ['rain','2026-11-08','За окном тихо шёл дождь. Я оставила открытую книгу на подоконнике и слушала капли. В комнате становилось серо, а тишина казалась почти осязаемой.','На стекле',[66,.30,-.65],['rain'],'xenia','Ксения II',
    reading('Открытая книга под дождём',[.05,.22,.78,.03,.01,.94,.32,.62],'Тихий дождь за окном, открытая книга на подоконнике, сереющая комната и слушание капель создают очень спокойную, уединённую тишину.')],
  ['lake','2026-11-04','Горное озеро встретило нас ветром. С тропы был виден весь берег, пока тонкий туман не накрыл воду. Мы остановились, чтобы вдохнуть холодный воздух.','Над водой',[82,.38,-.08],['lake'],'aidar','Айдар',
    reading('Туман над горным озером',[.32,.06,.68,.12,.03,.82,.28,.71],'Ветер, холодный воздух, туман над водой и остановка на тропе создают тихое, спокойное ощущение простора.')],
  ['cake','2026-11-01','Друзья выключили свет на кухне, и остались только свечи на торте. Кто-то громко пел мимо нот, мы смеялись и танцевали до полуночи. На фото от движения остались золотые полосы.','До полуночи',[132,.88,.65],['cake'],'baya','Бая',
    reading('Свечи на кухонном торте',[.93,.01,.18,.05,.95,.03,.80,.01],'Свечи на торте, друзья, громкое пение, смех и танцы до полуночи создают шумную тёплую праздничную атмосферу.')]
].map(([id,date,story,track,[bpm,energy,tone],frames,narrationVoice,narrationVoiceName,dayReading])=>({
  id,date,story, demo:true, reading:dayReading, photoSources:frames.map(name=>`./media/${name}.webp`),
  music:{kind:'local', origin:'library', styleId:id, rights:musicRights, track, source:`./media/${id}.mp3`, analysis:{bpm, energy, tone, confidence:1}},
  narrationVoice,narrationVoiceName,narrationModel:'Silero TTS v5_6_ru',
  narration:`./media/${id}-voice.mp3`, created:0
}));

export const demos = [...originalDemos, ...extraExamples, ayaulymDay];

// Sample entries are translated editorially. A user's own entry is always shown as written.
const sampleCopy = {
  en: {
    maple: ['Cocoa under an autumn maple', 'We met in the park after work that autumn. On a bench under a maple, golden leaves stuck to our sleeves and cocoa warmed our hands. We talked until the last warm ray faded.', 'Rustling leaves and cocoa', 'The park, warm cocoa and a long conversation at sunset suggest a quiet, close moment.'],
    office: ['Neon on the office window', 'We were in the office late to finish the project. The laptop lit my face, and a stripe of blue neon slid across the glass. Five minutes to the deadline. We watched the progress bar inch forward.', 'The last build', 'The laptop glow, looming deadline and slow progress bar make the stillness feel tense.'],
    train: ['Pink dawn on the train', 'It was my first ride on this train. Dawn appeared outside and the mountain ridge turned pink for a second. A glass rattled on the table. The journey had just begun, and everything was ahead.', 'First light', 'Dawn, pink mountains and the rattling glass give the start of the journey a quiet sense of possibility.'],
    rain: ['An open book in the rain', 'Rain fell softly outside. I left an open book on the windowsill and listened to the drops. The room grew grey, and the silence felt almost tangible.', 'On the glass', 'The soft rain, the open book and the greying room make the scene quiet and solitary.'],
    lake: ['Mist over the mountain lake', 'Wind greeted us at the mountain lake. The whole shore was visible from the trail until a thin mist covered the water. We stopped to breathe in the cold air.', 'Above the water', 'Wind, cold air and mist over the water bring a quiet sense of space.'],
    cake: ['Candles on the kitchen cake', 'My friends turned off the kitchen light, leaving only the candles on the cake. Someone sang loudly and off-key. We laughed and danced until midnight. The movement left golden streaks in the photo.', 'Until midnight', 'Candles, laughter and dancing late into the night make this a warm celebration.']
  },
  kk: {
    maple: ['Күзгі үйеңкі түбіндегі какао', 'Күзде жұмыстан кейін саябақта кездестік. Үйеңкі түбіндегі орындықта сары жапырақтар жеңімізге жабысып, ыстық какао алақанымызды жылытты. Күннің соңғы жылы сәулесі сөнгенше әңгімелестік.', 'Жапырақ сыбдыры мен какао', 'Саябақ, ыстық какао және күн батардағы ұзақ әңгіме тыныш әрі жақын сәтті сездіреді.'],
    office: ['Кеңсе әйнегіндегі неон', 'Жобаны аяқтау үшін кеңседе түнге дейін қалдық. Ноутбуктің жарығы бетіме түсіп, көк неон жолағы әйнек бойымен жылжыды. Тапсыруға бес минут қалды. Жүктеу жолағының баяу жылжығанын бақыладық.', 'Соңғы жинақ', 'Ноутбук жарығы, таяған мерзім және баяу жүктелу тыныштықтың астарындағы шиеленісті сездіреді.'],
    train: ['Пойыз терезесіндегі қызғылт таң', 'Бұл пойызға алғаш рет міндім. Терезе сыртында таң атып, тау жотасы бір сәтке қызғылт түске боялды. Үстелдегі стақан дірілдеді. Жол енді ғана басталды, бәрі әлі алда еді.', 'Алғашқы сәуле', 'Атқан таң, қызғылт таулар мен дірілдеген стақан жаңа сапардың тыныш үмітін сездіреді.'],
    rain: ['Жаңбыр астындағы ашық кітап', 'Терезе сыртында жаңбыр баяу жауып тұрды. Ашық кітапты терезе алдына қалдырып, тамшыларды тыңдадым. Бөлме күңгірт тартып, тыныштықты қолмен ұстауға болатындай сезілді.', 'Әйнектегі тамшылар', 'Баяу жаңбыр, ашық кітап пен күңгірт бөлме оңаша тыныштықты сездіреді.'],
    lake: ['Тау көлінің үстіндегі тұман', 'Тау көлі бізді желмен қарсы алды. Жіңішке тұман суды жапқанша, соқпақтан бүкіл жағалау көрінді. Салқын ауаны жұту үшін тоқтадық.', 'Су үстінде', 'Жел, салқын ауа және су үстіндегі тұман тыныш кеңістікті сездіреді.'],
    cake: ['Асүйдегі торттың шамдары', 'Достарым асүйдің жарығын өшірді, торттағы шамдар ғана қалды. Біреу әнді қатты әрі жалған нотамен айтты. Түн ортасына дейін күліп, биледік. Қимылдан фотода алтын түсті жолақтар қалды.', 'Түн ортасына дейін', 'Торттағы шам, күлкі мен түнге дейінгі би жылы мереке әсерін береді.']
  }
};

export function localizedDay(day) {
  const moodName = feelingLabel(day.imprint.feelings);
  const sample = day.demo && (sampleCopy[language]?.[day.id] ?? day.translations?.[language]);
  if (!sample) return {
    ...day,
    music: day.music.origin === 'generated'
      ? {...day.music, track: day.music.track.split(' · ').map((part, index) => index ? part : t(part)).join(' · ')}
      : day.music,
    imprint: {...day.imprint, moodName}
  };
  const [title, story, track, reason] = sample;
  const trackName = track ?? sampleCopy[language]?.[day.music.styleId]?.[2] ?? day.music.track;
  const context = {...day.imprint.context, evidence: readContext(story, day.date).evidence};
  return {
    ...day, story, music: {...day.music, track:trackName},
    reading: {...day.reading, title, reason, reasonLanguage: language},
    imprint: {...day.imprint, title, excerpt: storyExcerpt(story), context, moodName}
  };
}
