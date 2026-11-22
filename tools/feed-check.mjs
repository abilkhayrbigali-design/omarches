// The feed check: thirteen archetype days side by side, at scene size and at card
// size, drawn by the diary's own modules. It answers the jury's test (do different
// days look like one diary, and is each day still its own?) before and after a
// change to the mapping.
//
//   node tools/feed-check.mjs OUT_DIR [label]
//
// Needs the diary running (OTTISK_URL, default http://127.0.0.1:8772), Chromium
// (CHROMIUM) and playwright-core (PLAYWRIGHT_CORE). Writes OUT_DIR/label-scenes.png,
// OUT_DIR/label-cards.png and OUT_DIR/label-tokens.json.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const [out = '.', label = 'sheet'] = process.argv.slice(2);
const site = process.env.OTTISK_URL || 'http://127.0.0.1:8772';
const core = process.env.PLAYWRIGHT_CORE
  ? await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href)
  : await import('playwright-core');

// [joy, sadness, calm, tension, festive, quiet, warmth, solitude], a photo, and a song that fits.
const SYNTHETIC = [
  ['grief', 'Горе', 'Прощание на старой скамейке', 'bench', [.02, .92, .2, .25, 0, .7, .35, .55], {bpm: 62, energy: .2, tone: -.6}],
  ['anger', 'Злость', 'Ссора у входа в парк', 'park', [.03, .3, .02, .95, .35, .05, .05, .3], {bpm: 150, energy: .9, tone: -.3}],
  ['alone', 'Уединение в радость', 'Один весь день в парке', 'park', [.45, .1, .8, .05, .02, .7, .15, .85], {bpm: 76, energy: .3, tone: .2}],
  ['loud', 'Громкая радость', 'Все кричали и прыгали', 'park', [.95, 0, .1, .1, .9, 0, .6, .05], {bpm: 128, energy: .9, tone: .7}],
  ['anxious', 'Тревожное ожидание', 'Поезд перед собеседованием', 'train', [.35, .2, .05, .75, .2, .55, .2, .4], {bpm: 110, energy: .6, tone: -.2}],
  ['bitter', 'Светлая грусть', 'Последний вечер у бабушки', 'bench', [.6, .6, .4, .1, .1, .5, .7, .3], {bpm: 84, energy: .4, tone: -.3}],
  ['flat', 'Обычный день', 'Работа, магазин, дом', 'park', [.2, .15, .3, .2, .1, .3, .2, .15], {bpm: 96, energy: .5, tone: 0}]
];

const harness = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><link rel="stylesheet" href="./style.css">
<style>
  body{margin:0;padding:24px;background:#111;color:#ddd;font:13px/1.4 var(--sans)}
  .sheet{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:26px 22px}
  .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px 16px}
  .label{display:flex;justify-content:space-between;gap:10px;margin:6px 0 0;color:#aaa;font-size:12px}
  .label b{color:#fff;font-weight:600}
  .memory{min-height:430px}
  .site{display:flex;align-items:center;gap:10px;padding:8px 10px;margin-top:6px;border-radius:4px}
  .site .primary{min-height:32px;padding:.3rem .8rem;font-size:.8rem}
  .site span{font:1.2rem var(--serif)}
</style></head><body><div id="root"></div>
<script type="module">
  import {demos} from './demos.mjs';
  import {makeImprint, photoStats} from './atmosphere.mjs';
  import {siteTokens, IDS} from './feelings.mjs';
  import {sceneHTML, sceneStyle, stampSVG, themeVars, treatment} from './scene.mjs';
  const synthetic = ${JSON.stringify(SYNTHETIC)};
  const order = ['joy','sadness','calm','tension','festive','quiet','warmth','solitude'];
  const days = [];
  for (const demo of demos) {
    const photoData = await Promise.all(demo.photoSources.map(photoStats));
    days.push({...demo, name: demo.id, photoData, imprint: makeImprint(demo.story, photoData, demo.music.analysis, demo.reading)});
  }
  for (const [id, name, title, photo, vector, audio] of synthetic) {
    const source = './media/' + photo + '.webp';
    const photoData = [await photoStats(source)];
    const reading = {title, feelings: Object.fromEntries(order.map((key, index) => [key, vector[index]]))};
    days.push({id, name, date: '2026-11-20', story: title + '.', photoSources: [source], photoData,
      imprint: makeImprint(title + '.', photoData, audio, reading)});
  }
  const fmt = f => IDS.map(id => id.slice(0, 3) + ' ' + f[id].toFixed(2)).join(' · ');
  const siteStrip = day => {
    const vars = themeVars(siteTokens(day.imprint.feelings, {hue: day.imprint.hue}));
    const style = Object.entries(vars).map(([k, v]) => k + ':' + v).join(';');
    return '<div class="site" style="' + style + ';background:var(--paper);color:var(--text)"><span>' + day.imprint.moodName +
      '</span><button class="primary" style="margin-left:auto">Воспроизвести</button></div>';
  };
  const scenes = days.map(day => '<div>' + sceneHTML(day, day.photoSources, day.name) +
    '<p class="label"><b>' + day.name + '</b><span>' + fmt(day.imprint.feelings) + '</span></p>' + siteStrip(day) + '</div>').join('');
  // The card exactly as the archive draws it (app/main.mjs, renderArchive).
  const cards = days.map(day => { const treat = treatment(day.imprint, 'c-' + day.id, .36); return '<a class="day-card"><div class="thumb"' + treat.attr +
    ' style="' + sceneStyle(day.imprint) + treat.style + '">' + treat.svg + '<div class="frames"><img class="frame visible" src="' + day.photoSources[0] +
    '" alt=""></div><div class="wash"></div><div class="leak"></div><div class="grain"></div><span class="mood-label">' +
    stampSVG(day.imprint.feelings, {title: day.imprint.moodName}) + day.imprint.moodName + '</span></div><div class="card-caption"><time>' +
    day.name + '</time><h3>' + day.imprint.title + '</h3></div></a>'; }).join('');
  document.querySelector('#root').innerHTML = '<div class="sheet" id="scenes">' + scenes + '</div>' +
    '<div class="cards" id="cards" style="margin-top:40px">' + cards + '</div>';
  window.tokens = days.map(day => ({name: day.name, ...day.imprint, text: undefined, pictured: undefined, excerpt: undefined}));
  window.ready = true;
</script></body></html>`;

const browser = await core.chromium.launch({executablePath: process.env.CHROMIUM || '/usr/bin/chromium', headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 900}, locale: 'ru-RU'});
const problems = [];
page.on('pageerror', error => problems.push(String(error)));
await page.route(site + '/__feed-check.html', route => route.fulfill({contentType: 'text/html; charset=utf-8', body: harness}));
await page.goto(site + '/__feed-check.html');
await page.waitForFunction(() => window.ready, null, {timeout: 30000});
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
await page.waitForTimeout(900);
fs.mkdirSync(out, {recursive: true});
const height = await page.evaluate(() => document.documentElement.scrollHeight);
await page.setViewportSize({width: 1440, height});
await page.waitForTimeout(500);
await page.locator('#scenes').screenshot({path: path.join(out, `${label}-scenes.png`)});
await page.locator('#cards').screenshot({path: path.join(out, `${label}-cards.png`)});
fs.writeFileSync(path.join(out, `${label}-tokens.json`), JSON.stringify(await page.evaluate(() => window.tokens), null, 1));
await browser.close();
console.log(problems.length ? 'Ошибки на странице:\n' + problems.join('\n') : `Готово: ${out}/${label}-*`);
process.exit(problems.length ? 1 : 0);
