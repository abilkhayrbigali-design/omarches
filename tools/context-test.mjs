// Checks what readContext() finds in entries: holidays, weather, negations, idioms.
// Run: node tools/context-test.mjs
import {readContext, contextRules, contextSVG, contextPageHTML} from '../app/context.mjs';

// [text, date, occasion or null, weather kinds that must be found, kinds that must not]
const cases = [
  // Holidays named in Russian, Kazakh and English
  ['Вечером праздновали Хэллоуин, вырезали тыквы и смотрели ужастики.', '2026-10-31', 'halloween', [], []],
  ['На хеллоуин мы с сестрой нарядились ведьмами.', '2026-10-30', 'halloween', [], []],
  ['Halloween party at the office, everyone came in costumes.', '2026-10-31', 'halloween', [], []],
  ['Дети ходили по соседям: сладость или гадость!', '2026-10-31', 'halloween', [], []],
  ['Встречали Новый год у бабушки, под бой курантов загадали желания.', '2026-12-31', 'newyear', [], []],
  ['Нарядили ёлку, резали оливье и ждали Деда Мороза.', '2026-12-30', 'newyear', [], ['frost']],
  ['С Новым годом! Салют гремел до трёх ночи.', '2027-01-01', 'newyear', [], []],
  ['Жаңа жыл құтты болсын, бәріміз бірге отырдық.', '2026-12-31', 'newyear', [], []],
  ['We stayed up for New Year with friends and a lot of snow outside.', '2026-12-31', 'newyear', ['snow'], []],
  ['Сегодня мой день рождения, друзья принесли торт со свечами.', '2026-05-04', 'birthday', [], []],
  ['Отмечали днюху Сани в баре.', '2026-07-10', 'birthday', [], []],
  ['Анаңның туған күні болды, барлығымыз жиналдық.', '2026-02-11', 'birthday', [], []],
  ['Happy birthday to me, blew out the candles in one go.', '2026-08-01', 'birthday', [], []],
  ['Именинник задул свечи, и все закричали.', '2026-03-02', 'birthday', [], []],
  ['Отмечали Наурыз: варили наурыз-көже, качались на алтыбақане.', '2026-03-21', 'nauryz', [], []],
  ['Наурыз мейрамы құтты болсын! Дастархан жайдық.', '2026-03-22', 'nauryz', [], []],
  ['We celebrated Nauryz with the whole family and ate baursaks.', '2026-03-21', 'nauryz', [], []],
  ['В праздник равноденствия накрыли дастархан, пили көже.', '2026-03-21', 'nauryz', [], []],
  ['Дед Мороз пришёл к детям в садик.', '2026-12-25', 'newyear', [], ['frost']],
  // Holidays that are not there
  ['Сварила суп из тыквы и легла спать пораньше.', '2026-10-31', null, [], []],
  ['Хэллоуин мы в этом году не праздновали, просто гуляли.', '2026-10-31', null, [], []],
  ['С нового года начну бегать по утрам.', '2026-12-20', null, [], []],
  ['Обычный вечер, все разошлись по домам.', '2026-12-31', null, [], []],
  ['Тихо отпраздновали вдвоём.', '2026-12-31', null, [], []],
  ['Купила маме торт просто так.', '2026-06-01', null, [], []],
  ['5 наурыз күні жұмысқа бардым.', '2026-03-05', null, [], []],
  ['Без ёлки, без гостей, Новый год не праздновали.', '2026-12-31', null, [], []],
  // Weather
  ['За окном тихо шёл дождь.', '', null, ['rain'], ['storm']],
  ['Попали под ливень по дороге домой.', '', null, ['rain'], []],
  ['С утра моросил мелкий дождик.', '', null, ['rain'], []],
  ['Дождя не было, зато дул сильный ветер.', '', null, ['wind'], ['rain']],
  ['Гуляли без зонта, дождь так и не пошёл.', '', null, [], ['rain']],
  ['Обещали дождь, но весь день было солнечно.', '', null, ['sun'], ['rain']],
  ['Ночью выпал первый снег, всё стало белым.', '', null, ['snow'], []],
  ['Метель не утихала весь вечер.', '', null, ['snow'], []],
  ['Зима без снега какая-то грустная.', '', null, [], ['snow']],
  ['Небо было пасмурное, тяжёлые тучи висели над городом.', '', null, ['clouds'], ['sun']],
  ['Ни облачка, только яркое солнце.', '', null, ['sun'], ['clouds']],
  ['Горное озеро встретило нас ветром, потом тонкий туман накрыл воду.', '', null, ['wind', 'fog'], []],
  ['Ночью началась гроза, гремел гром и сверкали молнии.', '', null, ['storm'], []],
  ['Жара под сорок, асфальт плавился.', '', null, ['heat'], []],
  ['Мороз минус двадцать, на окнах иней.', '', null, ['frost'], []],
  ['It was raining all day and the wind was strong.', '', null, ['rain', 'wind'], []],
  ['A foggy morning, then sunny and warm.', '', null, ['fog', 'sun'], []],
  ['No rain today, just grey sky.', '', null, ['clouds'], ['rain']],
  ['Күні бойы жаңбыр жауды.', '', null, ['rain'], []],
  ['Таудан қатты жел соқты, қар жауды.', '', null, ['wind', 'snow'], []],
  // Idioms and words that only look like weather
  ['Новость свалилась как снег на голову.', '', null, [], ['snow']],
  ['В голове туман после экзамена, буря эмоций.', '', null, [], ['fog', 'storm']],
  ['Зал взорвался громом аплодисментов, я громко смеялась.', '', null, [], ['storm']],
  ['Наконец дождались ответа из университета.', '', null, [], ['rain']],
  ['Надела белоснежную рубашку и солнцезащитные очки.', '', null, [], ['snow', 'sun']],
  ['Сохранила фотографии в облако.', '', null, [], ['clouds']],
  ['Угроза срыва сроков висела над нами весь день.', '', null, [], ['storm']],
  ['Ночь в офисе перед сдачей проекта.', '2026-11-15', null, [], ['rain', 'sun', 'clouds']],
  ['Купила новую ветровку и посмотрела в окно.', '', null, [], ['wind']],
  ['Ел мороженое и смотрел в window.', '', null, [], ['frost', 'wind']]
];
const amounts = [
  ['Ливень стеной.', 'rain', a => a >= .9], ['Слегка моросило.', 'rain', a => a <= .4],
  ['Густой туман над рекой.', 'fog', a => a >= .9], ['Лёгкая дымка над полем.', 'fog', a => a <= .4],
  ['Был ветерок с моря.', 'wind', a => a <= .4]
];

let failed = 0, passed = 0;
const fail = (text, why, got) => { failed++; console.log(`✗ ${text}\n  ${why}\n  ${JSON.stringify(got)}`); };
for (const [text, date, occasion, must, mustNot] of cases) {
  const got = readContext(text, date || undefined);
  const kinds = got.weather.map(item => item.kind);
  if (got.occasion !== occasion) fail(text, `праздник: ждали ${occasion}, получили ${got.occasion}`, got);
  else if (must.some(kind => !kinds.includes(kind))) fail(text, `не нашлось: ${must.filter(kind => !kinds.includes(kind))}`, got);
  else if (mustNot.some(kind => kinds.includes(kind))) fail(text, `лишнее: ${mustNot.filter(kind => kinds.includes(kind))}`, got);
  else passed++;
}
for (const [text, kind, ok] of amounts) {
  const item = readContext(text).weather.find(w => w.kind === kind);
  if (!item || !ok(item.amount)) fail(text, `сила ${kind}`, item); else passed++;
}
// Drawing never throws, and draws nothing for a day that names nothing.
const imprint = {feelings: {festive: .7, quiet: .2}, place: 'air'};
if (contextSVG(readContext('Обычный день.'), imprint, 'a') !== '') fail('Обычный день.', 'нарисовано лишнее', '');
for (const [text] of cases) {
  const c = readContext(text);
  for (const size of [1, .36]) contextSVG(c, imprint, text, size);
  contextSVG(c, {...imprint, place: 'grid'}, text);
  contextRules(c);
  contextPageHTML(c, imprint);
}
console.log(`${passed} из ${passed + failed} проверок прошли`);
process.exit(failed ? 1 : 0);
