// Retakes the pictures and the interactive archive in submission/examples from the running diary.
//
//   node tools/capture-examples.mjs
//
// Needs the diary running (default http://localhost:8765, override with OTTISK_URL),
// Chromium (CHROMIUM, default /usr/bin/chromium) and the playwright-core package
// (PLAYWRIGHT_CORE may point at its folder). The examples gallery supplies the
// built-in days and keeps personal records out of the captures.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'submission', 'examples');
const submissionDays = ['ayaulym-halloween', 'maple', 'office', 'train', 'rain', 'lake', 'cake'];
const site = process.env.OTTISK_URL || 'http://localhost:8765';
const core = process.env.PLAYWRIGHT_CORE
  ? await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href)
  : await import('playwright-core');

const browser = await core.chromium.launch({executablePath: process.env.CHROMIUM || '/usr/bin/chromium', headless: true});
const context = await browser.newContext({viewport: {width: 1440, height: 900}, deviceScaleFactor: 1, locale: 'ru-RU', acceptDownloads: true});
const page = await context.newPage();
const problems = [];
page.on('pageerror', error => problems.push(String(error)));

const settle = async () => {
  await page.evaluate(() => document.fonts.ready);
  await page.locator('img.frame[loading="lazy"]').evaluateAll(images => images.forEach(image => { image.loading = 'eager'; }));
  await page.waitForFunction(() => [...document.querySelectorAll('img.frame')].every(image => image.complete && image.naturalWidth > 0));
  // A view enters in the character of its mood; the slowest days take over two seconds to settle.
  await page.waitForTimeout(2900);
};
// A whole page is taken in a viewport as tall as the page, so the fixed background layers cover all of it.
const whole = async name => {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({width: 1440, height});
  await page.waitForTimeout(700);
  await page.screenshot({path: path.join(target, name), type: 'jpeg', quality: 86});
  await page.setViewportSize({width: 1440, height: 900});
  await page.waitForTimeout(200);
};

await page.goto(site + '/#examples');
await page.waitForSelector('#examples-grid .day-card');
await page.locator('#examples-grid .day-card').evaluateAll((cards, ids) => {
  for (const card of cards) {
    if (!ids.includes(card.hash.slice('#day/'.length))) card.remove();
  }
}, submissionDays);
if (await page.locator('#examples-grid .day-card').count() !== submissionDays.length) {
  throw new Error('В галерее отсутствует один из дней для сдачи.');
}
await settle();
const titles = await page.$$eval('#examples-grid .day-card', cards => cards.map(card => `${card.querySelector('h3').textContent} — ${card.querySelector('.mood-label').textContent.trim()}`));
await page.locator('#examples-grid').screenshot({path: path.join(target, 'archive.jpg'), type: 'jpeg', quality: 88});
await whole('site-archive.jpg');

for (const id of submissionDays) {
  await page.goto(`${site}/#day/${id}`);
  await page.waitForSelector('.memory');
  await settle();
  await page.locator('.memory').screenshot({path: path.join(target, `${id}.jpg`), type: 'jpeg', quality: 88});
  if (id === 'office' || id === 'cake') await whole(`site-day-${id}.jpg`);
}

await page.goto(site + '/#examples');
const [download] = await Promise.all([page.waitForEvent('download'), page.evaluate(async ids => {
  const {demos,localizedDay} = await import('./demos.mjs');
  const {photoStats,makeImprint} = await import('./atmosphere.mjs');
  const {downloadArchive} = await import('./export.mjs');
  const selected = await Promise.all(ids.map(async id => {
    const day = demos.find(sample => sample.id === id);
    const photoData = await Promise.all(day.photoSources.map(photoStats));
    const imprint = makeImprint(day.story,photoData,day.music.analysis,day.reading,day.date);
    return localizedDay({...day,photoData,imprint});
  }));
  await downloadArchive(selected);
}, submissionDays)]);
await download.saveAs(path.join(target, 'ottisk-examples.zip'));
await browser.close();

console.log(titles.join('\n'));
console.log(problems.length ? 'Ошибки на странице:\n' + problems.join('\n') : `Готово: ${fs.readdirSync(target).length} файлов в ${target}`);
process.exit(problems.length ? 1 : 0);
