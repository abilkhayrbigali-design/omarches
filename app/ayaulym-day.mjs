const media = './media/ayaulym-halloween/';
const trackPage = 'https://www.jamendo.com/track/1074133';
const licenseUrl = 'https://creativecommons.org/licenses/by/3.0/';

export const ayaulymDay = {
  id:'ayaulym-halloween', date:'2026-10-31', demo:true, participantExample:true, created:0,
  story:"31 октября. Суббота. Хэллоуин в этом году накрыл и мой университет, и Mega Silkway. Я решила не оставаться в стороне и прийти в костюме чумного доктора. Было очень непривычно ходить в костюме, а еще необычнее было видеть других людей в костюмах разных персонажей. С некоторыми я даже сфоткалась, возможно там в них вы сможете узнать знакомых героев.\nПосле университета праздник продолжился в Mega Silkway, где в честь самого жуткого дня в году устроили концерт и тематический спектакль. В целом этот день прошел очень весело, ведь это день когда можно нарядиться в кого угодно, пообщаться с фанатами разных вселенных и просто почувствовать себя среди своих.",
  translations:{
    en:[
      'Ayaulym’s Halloween at Mega Silkway',
      'October 31. Saturday. Halloween took over both my university and Mega Silkway this year. I decided to join in and come dressed as a plague doctor. Walking around in costume felt strange, and seeing everyone else dressed as different characters felt even stranger. I even got photos with some of them. You might recognize a few familiar faces.\nAfter university the celebrations continued at Mega Silkway, with a concert and a themed play for the spookiest day of the year. I had so much fun. It’s a day when you can dress as anyone you like, talk to fans from all sorts of fictional worlds and just feel like you belong.'
    ],
    kk:[
      'Аяулымның Mega Silkway-дегі Хэллоуині',
      '31 қазан. Сенбі. Биыл Хэллоуин менің университетімде де, Mega Silkway-де де тойланды. Мен де шетте қалмай, оба дәрігерінің киімін киіп баруды шештім. Костюммен жүру біртүрлі екен, ал өзге адамдарды сан түрлі кейіпкердің бейнесінде көру одан да қызық болды. Кейбірімен тіпті суретке түстім. Арасынан өздеріңе таныс кейіпкерлерді көріп қаларсыңдар.\nУниверситеттен кейін мереке Mega Silkway-де жалғасты. Жылдың ең қорқынышты күніне арнап концерт пен тақырыптық қойылым ұйымдастырылыпты. Күнім өте көңілді өтті. Осындай күні қалаған кейіпкеріңе айналып, түрлі әлемдердің жанкүйерлерімен әңгімелесіп, өз ортаңда жүргендей сезінесің.'
    ]
  },
  photoSources: ['01','02','03','04','05','06'].map(frame => media + frame + '.webp'),
  reading:{
    title:'Хэллоуин Аяулым в Mega Silkway', source:'example', model:'ottisk-mood-3',
    // Computed from the original Russian entry using the same local text reader.
    feelings:{joy:.60, festive:.60, tension:.08, solitude:.09, sadness:.02, quiet:.01, calm:.14, warmth:.12}
  },
  music:{
    kind:'remote', origin:'catalog', track:'skeleton dance', artist:'Blik',
    provider:'Jamendo', catalogId:'82f65b1b-8ef0-481a-b176-0d0dea4f0b81',
    source:'https://prod-1.storage.jamendo.com/?trackid=1074133&format=mp32',
    url:trackPage, sourceUrl:trackPage, creatorUrl:'https://www.jamendo.com/artist/352114/Blik',
    license:'CC BY 3.0', licenseUrl,
    rights:{label:'CC BY 3.0', description:'“skeleton dance” — Blik (Jamendo), CC BY 3.0.'},
    // The application's audio analyser read the publisher's recording.
    analysis:{bpm:null, energy:.39444444444444443, tone:-.66, mode:'minor', key:'ми', confidence:0, heard:true}
  },
  narrationVoice:'baya', narrationVoiceName:'Бая', narrationModel:'Silero TTS v5_6_ru',
  narration:media + 'narration.mp3'
};
