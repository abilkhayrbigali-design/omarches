// Checks that motion follows the mood the way the rules say.
// Run: node tools/motion-test.mjs
import {emptyFeelings, motionLine, motionTokens} from '../app/feelings.mjs';

const day = values => ({...emptyFeelings(), ...values});
const cake = motionTokens(day({joy: .86, festive: .9, warmth: .82, calm: .18}));
const office = motionTokens(day({tension: .94, quiet: .47, solitude: .4, festive: .27, warmth: .27}));
const maple = motionTokens(day({warmth: .9, calm: .84, joy: .5, quiet: .5, solitude: .1}));
const rain = motionTokens(day({quiet: .94, calm: .78, solitude: .62, sadness: .3, warmth: .3}));
const grief = motionTokens(day({sadness: .9, solitude: .7, quiet: .6}));

const checks = [
  ['праздничный день встаёт на место быстрее тихого', cake.settle < rain.settle],
  ['праздничный день даёт отскок', cake.bounce >= .05],
  ['напряжённый день останавливается без отскока', office.bounce === 0 && office.ratio === 1],
  ['напряжённый день быстрее спокойного', office.settle < maple.settle && office.settle <= .35],
  ['спокойный день не даёт отскока, заголовок выходит из расфокуса', maple.bounce === 0 && maple.soft >= 5 && !maple.wipe],
  ['в радостный день элементы поднимаются снизу', cake.rise > 20],
  ['в грустный день элементы опускаются сверху', grief.rise < -10],
  ['в напряжённый день элементы входят сбоку, заголовок открывает шторка', office.slide >= 20 && office.wipe && office.soft === 0],
  ['тепло приближает, уединение нет', maple.grow < .96 && rain.grow === 1],
  ['в уединённый день пауза между элементами длиннее, чем в праздничный', rain.step >= 3 * cake.step],
  ['камера приближается в тёплый день и отдаляется в уединённый', maple.camBack === 0 && rain.camBack === 1],
  ['камера поднимает кадр при радости и опускает при грусти', cake.camY < 0 && grief.camY > 0],
  ['в напряжённый день камера идёт рывками', office.camEase.startsWith('steps(') && !maple.camEase.startsWith('steps(')],
  ['тихий кадр отвечает на курсор слабее и медленнее праздничного', rain.hoverZoom < cake.hoverZoom && rain.hoverTime > cake.hoverTime],
  ['грустный день тяжелее радостного', grief.mass > 1.5 && cake.mass < 1],
  ['праздничный воздух быстрее и размашистее тихого', cake.pace > 1.4 && rain.pace < .7 && cake.sway >= 3 * rain.sway],
  ['в напряжённый день воздух дёргается, в спокойный плывёт', office.airEase.startsWith('steps(') && maple.airEase === 'ease-in-out'],
  ['объяснение называет пружину и направление', /с отскоком/.test(motionLine(day({joy: .86, festive: .9, warmth: .82}))) && /шторкой/.test(motionLine(day({tension: .94})))]
];

// Any mood gives a usable curve: starts at rest, ends at the target, within the time limits.
let seed = 7;
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
let sound = true;
for (let index = 0; index < 400; index++) {
  const m = motionTokens(Object.fromEntries(Object.keys(emptyFeelings()).map(id => [id, Math.round(random() * 100) / 100])));
  const stops = m.easing.slice(7, -1).split(',').map(Number);
  if (!(m.settle >= .16 && m.settle <= 1.3) || stops[0] !== 0 || stops.at(-1) !== 1 || stops.some(value => !Number.isFinite(value) || value > 1.2 || value < 0)
    || !(m.step >= .02 && m.step <= .16) || !(m.hoverZoom >= 1.012 && m.hoverZoom <= 1.07)) sound = false;
}
checks.push(['любые четыреста сочетаний чисел дают пригодную кривую в пределах времени', sound]);

let failed = 0;
for (const [name, ok] of checks) if (!ok) { failed++; console.log('не прошло: ' + name); }
console.log(`${checks.length - failed} из ${checks.length} проверок прошли`);
process.exit(failed ? 1 : 0);
