// Careful text, grammatical error, then spelling error in a relevant word. The
// contextual sentences are paired separately from the primary mood narratives.
const row = (id,date,ru,kk,en) => ({id,date,ru,kk,en});
export const occasions = [
  row('halloween','2026-10-31',['Это был Хэллоуин.','У нас был Хэллоуин отмечали.','Это был Хелуин.'],['Бұл Хэллоуин кеші еді.','Бұл Хэллоуин кеші болды едік.','Бұл Хелуин кеші еді.'],['It was Halloween.','It were Halloween.','It was Haloween.']),
  row('newyear','2026-01-01',['Это был Новый год.','Это были Новый год.','Это был Новыи гот.'],['Бұл Жаңа жыл еді.','Бұл Жаңа жыл болды едік.','Бұл Жана жл еді.'],['It was New Year.','It were New Year.','It was New Yera.']),
  row('birthday','2026-06-16',['Это был день рождения.','Это были день рождения.','Это был день раждения.'],['Бұл туған күн еді.','Бұл туған күн болды едік.','Бұл туган кун еді.'],['It was a birthday.','It were a birthday.','It was a brithday.']),
  row('nauryz','2026-03-22',['Это был Наурыз.','Тогда были Наурыз.','Это был Науриз.'],['Бұл Наурыз еді.','Бұл Наурыз болды едік.','Бұл Наурз еді.'],['It was Nauryz.','It were Nauryz.','It was Naurz.']),
  row(null,'2026-10-31',['Хэллоуин не отмечали.','Хэллоуин мы не отмечала.','Хелуин не атмечали.'],['Хэллоуинді тойламадық.','Хэллоуинді мен тойламадық.','Хелуинді тойламадык.'],['We did not celebrate Halloween.','We did not celebrates Halloween.','We didnt celebrate Haloween.']),
  row(null,'2026-01-01',['Праздников не было.','Праздников не было у нас дома были.','Праздников небыло.'],['Мереке болған жоқ.','Мереке болған жоқ едік.','Мереке болган жок.'],['There was no celebration.','There were no celebration.','There was no celbration.']),
  row(null,'2026-03-22',['В календаре был обычный выходной.','В календаре были обычный выходной.','В календаре был обычный выхадной.'],['Күнтізбеде кәдімгі демалыс күні еді.','Күнтізбеде кәдімгі демалыс күні едік.','Кунтизбеде кәдімгі демалыс куни еді.'],['The calendar showed a normal day off.','The calendar show a normal day off.','The calender showed a normal day off.']),
  row(null,'2026-05-18',['Никакого торжества не было.','Никакого торжества у нас не было были.','Никакого таржества небыло.'],['Ешқандай той болған жоқ.','Ешқандай той болған жоқ едік.','Ешкандай той болган жок.'],['There was no party.','There were no party.','There was no praty.'])
];

export const skies = [
  row('rain',null,['На улице шёл дождь.','На улице шли дождь.','На улице шёл дошть.'],['Сыртта жаңбыр жауды.','Сыртта жаңбыр жаудым.','Сыртта жанбыр жауды.'],['It was raining outside.','It were raining outside.','It was rainning outside.']),
  row('snow',null,['К вечеру выпал снег.','К вечеру выпали снег.','К вечеру выпал снг.'],['Кешке қар жауды.','Кешке қар жаудым.','Кешке кар жауды.'],['Snow fell by evening.','Snow falled by evening.','Snwo fell by evening.']),
  row('storm',null,['Вдали началась гроза.','Вдали начались гроза.','Вдали началась граза.'],['Алыста найзағай ойнады.','Алыста найзағай ойнадым.','Алыста найзагай ойнады.'],['Lightning lit the sky.','Lightning lighted the sky.','Lighnting lit the sky.']),
  row('clouds',null,['Над домом плыли облака.','Над домом плыло облака.','Над домом плыли обалка.'],['Төбемізде бұлт тұрды.','Төбемізде бұлт тұрдым.','Төбемізде булт тұрды.'],['There were clouds overhead.','There was clouds overhead.','There were clodus overhead.']),
  row('sun',null,['К обеду светило солнце.','К обеду светили солнце.','К обеду светило сонце.'],['Күн ашық болды.','Күн ашық болдық.','Кун ашык болды.'],['It was sunny by noon.','It were sunny by noon.','It was suny by noon.']),
  row('wind',null,['Со стороны реки дул ветер.','Со стороны реки дули ветер.','Со стороны реки дул ветир.'],['Өзен жақтан жел соқты.','Өзен жақтан жел соқтым.','Өзен жақтан жэл сокты.'],['A wind blew from the river.','A wind blowed from the river.','A widn blew from the river.']),
  row('fog',null,['Землю закрыл туман.','Землю закрыли туман.','Землю закрыл тумман.'],['Жерді тұман басты.','Жерді тұман басқандар.','Жерді туман басты.'],['Fog covered the ground.','Fog cover the ground.','Fogg covered the ground.']),
  row('heat',null,['На улице стояла жара.','На улице стояли жара.','На улице стояла жра.'],['Далада аптап болды.','Далада аптап болдық.','Далада апттап болды.'],['It was scorching outside.','It were scorching outside.','It was scorchng outside.']),
  row('frost',null,['Утром ударил мороз.','Утром ударили мороз.','Утром ударил мароз.'],['Таңертең аяз болды.','Таңертең аяз болдық.','Таңертең айаз болды.'],['Frost covered the windows.','Frost cover the windows.','Forst covered the windows.']),
  row(null,null,['Дождя не было.','Дождя не были.','Дождя небыло.'],['Жаңбыр жауған жоқ.','Жаңбыр жауған жоқ едік.','Жанбыр жауган жок.'],['There was no rain.','There were no rain.','There was no rian.']),
  row(null,null,['Снега не было.','Снега не были.','Снега небыло.'],['Қар жауған жоқ.','Қар жауған жоқ едік.','Кар жауган жок.'],['There was no snow.','There were no snow.','There was no snwo.']),
  row(null,null,['Прогноз обещал дождь завтра.','Прогноз обещали дождь завтра.','Прогноз абещал дошть завтра.'],['Ертең жаңбыр болуы мүмкін.','Ертең жаңбыр болуы мүмкіндер.','Ертен жанбыр болуы мумкин.'],['The forecast predicted rain tomorrow.','The forecast predict rain tomorrow.','The forcast predicted rian tomorrow.']),
  row(null,null,['На стене висели часы.','На стене висела часы.','На стене висели чисы.'],['Қабырғада сағат ілулі тұрды.','Қабырғада сағат ілулі тұрдым.','Кабыргада сагат ілулі тұрды.'],['A clock hung on the wall.','A clock hang on the wall.','A clcok hung on the wall.']),
  row(null,null,['В комнате стоял стул.','В комнате стояли стул.','В комноте стоял стул.'],['Бөлмеде орындық тұрды.','Бөлмеде орындық тұрдым.','Болмеде орындык тұрды.'],['A chair stood in the room.','A chair stand in the room.','A chiar stood in the room.'])
];
