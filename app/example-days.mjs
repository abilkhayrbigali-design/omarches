import {musicRights} from './music-rights.mjs';

const tracks = {
  maple: {track:'Шорох и какао', bpm:68, energy:.24, tone:-.2},
  office: {track:'Последняя сборка', bpm:144, energy:.90, tone:0},
  train: {track:'Первый свет', bpm:100, energy:.52, tone:.52},
  rain: {track:'На стекле', bpm:66, energy:.30, tone:-.65},
  lake: {track:'Над водой', bpm:82, energy:.38, tone:-.08},
  cake: {track:'До полуночи', bpm:132, energy:.88, tone:.65}
};

const examples = [
  {
    id:'snowfall', date:'2026-11-18', image:'snowfall', track:'rain',
    feelings:{quiet:.99, calm:.32, solitude:.19, joy:.13},
    ru:['Снег над тёмными крышами','За окном начался снегопад. К вечеру снежинки закрыли крыши, и улица будто приглушила все свои звуки. Я выключила лампу и долго смотрела в окно.'],
    kk:['Қара шатырлар үстіндегі қар','Терезе сыртында қар қалың жауа бастады. Кешке шатырлар ағарып, көше дыбыстары бәсеңдеді. Шамды сөндіріп, терезеге ұзақ қарадым.'],
    en:['Snow over dark rooftops','Snow began falling outside. By evening it had covered the rooftops, and the whole street seemed to grow quiet. I turned off the lamp and watched from the window.']
  },
  {
    id:'halloween', date:'2026-10-31', image:'halloween', track:'cake',
    feelings:{festive:.99, joy:.51, tension:.27, warmth:.35},
    ru:['Тыквы на подоконнике','На Хэллоуин вырезали тыквы и расставили свечи. Потом пришли друзья в костюмах, и мы со смехом пугали друг друга в тёмном коридоре.'],
    kk:['Терезе алдындағы асқабақтар','Хэллоуинде асқабақ ойып, ішіне шам қойдық. Достарымыз костюммен келді. Қараңғы дәлізде бір-бірімізді қорқытып, күлдік.'],
    en:['Pumpkins on the windowsill','For Halloween we carved pumpkins and lit the candles. Friends came by in costume, and we laughed as we tried to scare each other in the dark hallway.']
  },
  {
    id:'nauryz', date:'2026-03-22', image:'nauryz', track:'train',
    feelings:{joy:.97, festive:.55, warmth:.53, calm:.23},
    ru:['Наурыз на весеннем лугу','Наурыз отметили на лугу. У юрты накрыли дастархан, разлили наурыз-көже, а дети наперегонки бежали к алтыбакану. Весь день хотелось улыбаться.'],
    kk:['Көктемгі алаңдағы Наурыз','Наурызды алаңда тойладық. Киіз үйдің қасына дастархан жайып, наурыз көже құйдық. Балалар алтыбақанға жарыса жүгірді. Күні бойы күлімдегім келді.'],
    en:['Nauryz in the spring meadow','We celebrated Nauryz in the meadow. By the yurt we set out a dastarkhan and poured Nauryz kozhe as the children raced to the altybakan swing. I wanted to smile all day.']
  },
  {
    id:'new-year', date:'2026-01-01', image:'new-year', track:'maple',
    feelings:{warmth:.98, joy:.48, festive:.44, calm:.48},
    ru:['Мандарины у новогодней ёлки','В Новый год дома пахло мандаринами. Мы расселись рядом с ёлкой, размотали гирлянду и дождались полуночи в тёплых носках.'],
    kk:['Шырша жанындағы мандариндер','Жаңа жылда үйден мандариннің иісі шықты. Шыршаға тізбелі шам тағып, жылы шұлық киіп, түн ортасын бірге күттік.'],
    en:['Tangerines by the New Year tree','On New Year’s Day the house smelled of tangerines. We sat by the tree, untangled the lights and waited for midnight in warm socks.']
  },
  {
    id:'heat', date:'2026-07-18', image:'heat', track:'maple',
    feelings:{calm:.94, warmth:.53, quiet:.53, joy:.39},
    ru:['Лёд в июльскую жару','В июльскую жару светлый двор выгорел почти добела. Я поставила стакан со льдом в тень и слушала, как лёд тихо трещал. Торопиться было некуда.'],
    kk:['Шілде аптабындағы мұз','Шілденің аптабында аула аппақ болып көрінді. Мұз салынған стақанды көлеңкеге қойып, оның баяу шытырлағанын тыңдадым. Асығатын жер болмады.'],
    en:['Ice in the July heat','During the July heatwave the bright courtyard looked almost white. I set a glass of ice in the shade and listened to it crackle. There was nowhere to hurry.']
  },
  {
    id:'thunderstorm', date:'2026-08-09', image:'thunderstorm', track:'office',
    feelings:{tension:.99, solitude:.47, sadness:.25, quiet:.17},
    ru:['Молния над мокрыми крышами','Ночью началась гроза. Молния высветила мокрые крыши, а от грома дрогнуло стекло. Я вздрагивала и считала секунды до следующего раската.'],
    kk:['Дымқыл шатырлар үстіндегі найзағай','Түнде найзағай ойнады. Жарқыл дымқыл шатырларды жарық қылды, күн күркірегенде әйнек дірілдеді. Келесі күркірегенге дейін секунд санап отырдым.'],
    en:['Lightning over wet rooftops','A thunderstorm broke at night. Lightning lit up the wet rooftops, and the window shook with thunder. I flinched and counted the seconds to the next rumble.']
  },
  {
    id:'overcast', date:'2026-10-24', image:'overcast', track:'lake',
    feelings:{solitude:.99, quiet:.54, calm:.42, sadness:.19},
    ru:['Облака над пустой остановкой','С утра было пасмурно. Облака слоями тянулись над остановкой. Вокруг стояла тишина, а я впервые за день осталась наедине с собой.'],
    kk:['Бос аялдама үстіндегі бұлттар','Таңертең аспанды бұлт басты. Бұлттар аялдама үстімен қабат-қабат қалқыды. Айнала тып-тыныш, мен күні бойы алғаш рет өзіммен оңаша қалдым.'],
    en:['Clouds over the empty stop','The sky was overcast from morning. Layers of cloud hung over the stop. It was still all around, and for the first time that day I was alone with my thoughts.']
  },
  {
    id:'frost', date:'2026-11-17', image:'frost', track:'lake',
    feelings:{calm:.90, quiet:.50, solitude:.41},
    ru:['Первый иней на стекле','Утром ударил мороз. Иней оставил на стекле тонкие узоры. Я села рядом с горячим чаем и смотрела, как становятся видны первые прохожие.'],
    kk:['Әйнектегі алғашқы қырау','Таңертең аяз түсті. Әйнекке қырау жұқа өрнек салды. Ыстық шайымды алып, көшедегі алғашқы жолаушыларға қарадым.'],
    en:['First frost on the window','It was freezing in the morning. Frost left delicate patterns on the glass. I sat down with hot tea to watch the first people pass outside.']
  },
  {
    id:'leaves-in-the-wind', date:'2026-10-09', image:'bench', track:'lake',
    feelings:{joy:.61, warmth:.49, quiet:.35, calm:.47},
    ru:['Кленовый лист в какао','Сильный ветер закрутил сухие листья под скамейкой. Я поставила кружку на угол билета, чтобы он не улетел. Один кленовый лист всё-таки приземлился прямо в какао.'],
    kk:['Какаоға түскен үйеңкі жапырағы','Қатты жел орындықтың астындағы қураған жапырақтарды үйіріп әкетті. Билетім ұшып кетпесін деп бір бұрышын кесемен бастырып қойдым. Бір үйеңкі жапырағы бәрібір какаоның ішіне түсіп кетті.'],
    en:['A maple leaf in my cocoa','A strong wind swirled dry leaves beneath the bench. I set my mug on a corner of my ticket to keep it from blowing away. One maple leaf still landed right in my cocoa.']
  },
  {
    id:'farewell', date:'2026-10-15', image:'farewell', track:'rain',
    feelings:{sadness:.98, solitude:.48, quiet:.38, warmth:.34},
    ru:['Чашка на пустой веранде','На пустой веранде осталась её чашка. Я долго сидела на ступеньках и всё ждала, что она позовёт меня по имени. Было грустно, и я скучала по ней.'],
    kk:['Бос верандадағы кесе','Бос верандада оның кесесі қалды. Баспалдақта ұзақ отырып, атымды атап шақыратындай күттім. Көңілім түсіп, оны қатты сағындым.'],
    en:['A cup on the empty porch','Her cup was still on the empty porch. I sat on the steps for a long time, waiting to hear her call my name. I felt sad and missed her.']
  },
  {
    id:'sunshine', date:'2026-09-13', image:'park', track:'train',
    feelings:{joy:.99, calm:.51, warmth:.39, festive:.19},
    ru:['Солнце на скамейке в парке','Утром вышло солнце. Я отошла от привычного маршрута, устроилась на тёплой скамейке и доела мороженое, улыбаясь прохожим.'],
    kk:['Саябақ орындығындағы күн шуағы','Таңертең күн ашық болды. Үйреншікті жолдан бұрылып, жылы орындыққа отырдым. Балмұздақ жеп, өтіп бара жатқан адамдарға күлімдедім.'],
    en:['Sun on a park bench','The sun came out in the morning. I took a detour, sat on a warm bench to finish my ice cream and smiled at people as they passed.']
  }
];

export const extraExamples = examples.map(({id,date,image,track,feelings,ru,kk,en}) => {
  const {track:trackName, bpm, energy, tone} = tracks[track];
  return {
    id, date, demo:true, story:ru[1], created:0,
    translations:{kk, en},
    reading:{title:ru[0], source:'example', feelings},
    photoSources:[`./media/${image}.webp`],
    music:{kind:'local', origin:'library', rights:musicRights, styleId:track, track:trackName,
      source:`./media/${track}.mp3`, analysis:{bpm, energy, tone, confidence:1}}
  };
});
