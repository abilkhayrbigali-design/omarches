// Records the demo video: drives the diary in headless Chromium, captures the
// screen at a constant 25 fps, then adds captions and the sound the page played.
//
//   node tools/record-demo.mjs <output.mp4> [work-folder]
//   node tools/record-demo.mjs <output.mp4> <work-folder> --compose   (re-edit a finished take without recording again)
//
// Needs: the diary running (default http://localhost:8765, override with OTTISK_URL),
// ffmpeg on PATH, Chromium (CHROMIUM, default /usr/bin/chromium) and the
// playwright-core package (PLAYWRIGHT_CORE may point at its folder).
// The story, the photos and the song below are the day shown in the video.
// To record your own day without putting it into the repository, describe it in
// my-day/day.json (that folder is ignored by git; DEMO_DAY may name another file):
//   {"story": "…", "date": "2026-10-31", "photos": ["1.jpg", "2.jpg"],
//    "song": {"catalog": true, "pick": "часть названия"}, "ai": true}
// Paths in the file are relative to the file itself.
// For a trial take, DEMO_CATALOG=1 picks the song from the catalogue and
// DEMO_NO_AI=1 keeps the text on this computer (no paid requests).
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(process.argv[2] || 'ottisk-demo.mp4');
const work = path.resolve(process.argv[3] || fs.mkdtempSync(path.join(os.tmpdir(), 'ottisk-demo-')));
const site = process.env.OTTISK_URL || 'http://localhost:8765';
const font = process.env.CAPTION_FONT || '/usr/share/fonts/Adwaita/AdwaitaSans-Regular.ttf';
const WIDTH = 1280, HEIGHT = 780, STRIP = 100, FPS = 25;

const day = {
  story: 'Встали до рассвета и поехали первым поездом в горы. К полудню вышли к озеру: вода ледяная, но мы всё равно зашли по колено и хохотали на весь берег. Обратно ехали молча, уставшие и счастливые.',
  photos: ['app/media/train.webp', 'app/media/lake.webp'].map(file => path.join(root, file)),
  // The song is either your own file:   {file: '…/song.mp3', name: 'Название.mp3'}
  // or a track from the open catalogue: {catalog: true, pick: 'часть названия'}
  // (the diary searches the catalogue by the story; without `pick` the first track is taken).
  song: {file: path.join(root, 'app/media/train.mp3'), name: 'Первый свет.mp3'},
  // false leaves the text on this computer: the dictionary reads it instead of the model.
  ai: true,
  // The date of the day as YYYY-MM-DD; without it the form keeps today's date.
  date: null
};
const ownDay = process.env.DEMO_DAY || path.join(root, 'my-day', 'day.json');
if (fs.existsSync(ownDay)) {
  const own = JSON.parse(fs.readFileSync(ownDay, 'utf8'));
  const beside = file => path.resolve(path.dirname(ownDay), file);
  Object.assign(day, own, {photos: own.photos.map(beside), song: own.song.file ? {...own.song, file: beside(own.song.file)} : own.song});
}
if (process.env.DEMO_CATALOG) day.song = {catalog: true};
if (process.env.DEMO_NO_AI) day.ai = false;

fs.mkdirSync(work, {recursive: true});
// The sound laid under the picture: a copy of your file, or the catalogue track downloaded during the take.
const songFile = path.join(work, day.song.catalog ? 'catalogue-track.mp3' : day.song.name);
if (!day.song.catalog) fs.copyFileSync(day.song.file, songFile);

const voiceFile = path.join(work, 'voice.wav');
const timelineFile = path.join(work, 'timeline.json');
const rawVideo = path.join(work, 'screen.mp4');

async function record() {
const core = process.env.PLAYWRIGHT_CORE
  ? await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href)
  : await import('playwright-core');
const browser = await core.chromium.launch({
  executablePath: process.env.CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--hide-scrollbars']
});
const context = await browser.newContext({viewport: {width: WIDTH, height: HEIGHT}, deviceScaleFactor: 1, locale: 'ru-RU', acceptDownloads: true});
const page = await context.newPage();

// A drawn pointer: a headless browser has no cursor to show where the clicks land.
await page.addInitScript(() => {
  addEventListener('DOMContentLoaded', () => {
    const dot = document.createElement('div');
    dot.style.cssText = 'position:fixed;z-index:2147483647;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;' +
      'background:rgba(255,255,255,.28);border:1.5px solid rgba(255,255,255,.9);box-shadow:0 0 0 1px rgba(0,0,0,.35);pointer-events:none;transition:transform .12s ease,background .12s ease';
    document.documentElement.append(dot);
    addEventListener('mousemove', event => { dot.style.left = event.clientX + 'px'; dot.style.top = event.clientY + 'px'; }, true);
    addEventListener('mousedown', () => { dot.style.transform = 'scale(.7)'; dot.style.background = 'rgba(255,255,255,.7)'; }, true);
    addEventListener('mouseup', () => { dot.style.transform = ''; dot.style.background = 'rgba(255,255,255,.28)'; }, true);
  });
});

// --- capture: the newest screencast frame is written to ffmpeg 25 times a second.
const encoder = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', rawVideo], {stdio: ['pipe', 'inherit', 'inherit']});
const cdp = await context.newCDPSession(page);
let latest = null, started = 0, written = 0;
cdp.on('Page.screencastFrame', frame => {
  latest = Buffer.from(frame.data, 'base64');
  cdp.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => {});
});
const clock = () => (Date.now() - started) / 1000;
const pump = setInterval(() => {
  if (!latest) return;
  if (!started) started = Date.now();
  while (written < Math.floor(clock() * FPS) + 1) { encoder.stdin.write(latest); written++; }
}, 1000 / FPS / 2);

const captions = [];
const sounds = [];
let credit = null;
const say = text => {
  if (captions.length) captions.at(-1).end = clock() - .15;
  if (text) captions.push({start: clock(), end: null, text});
};
const pause = seconds => page.waitForTimeout(seconds * 1000);
async function point(selector) {
  const target = page.locator(selector).first();
  await target.scrollIntoViewIfNeeded();
  let box = await target.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {steps: 22});
  await pause(.25);
  // The dialog is centred and changes height as content arrives: follow the element until it rests.
  for (let attempt = 0; attempt < 6; attempt++) {
    const now = await target.boundingBox();
    const moved = Math.abs(now.x - box.x) + Math.abs(now.y - box.y) > 1.5;
    box = now;
    if (!moved) break;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {steps: 8});
    await pause(.2);
  }
  return box;
}
async function click(selector) {
  await point(selector);
  await page.mouse.down();
  await pause(.09);
  await page.mouse.up();
}
const glide = (selector, block = 'center') => page.locator(selector).first()
  .evaluate((element, where) => element.scrollIntoView({behavior: 'smooth', block: where}), block).then(() => pause(1.1));
const top = () => page.evaluate(() => scrollTo({top: 0, behavior: 'smooth'})).then(() => pause(1));

await page.exposeFunction('demoSound', (kind, event, position) => sounds.push({kind, event, position, at: clock()}));
const listen = (selector, kind) => page.locator(selector).evaluate((audio, name) => {
  for (const event of ['play', 'pause', 'ended']) audio.addEventListener(event, () => window.demoSound(name, event, audio.currentTime));
}, kind);

await page.goto(site + '/');
await page.waitForSelector('.day-card');
await page.evaluate(() => document.fonts.ready);
await page.mouse.move(WIDTH * .7, HEIGHT * .55);
await cdp.send('Page.startScreencast', {format: 'jpeg', quality: 90, everyNthFrame: 1});
await pause(1.2);

// 1. The diary as it is.
say('«Оттиск» — дневник, который хранит не только кадры, но и ощущение дня');
await pause(3.6);
say('У дневника есть настроение: восемь чисел в четырёх парах противоположностей');
await glide('.diary-mood');
await pause(3.6);
await glide('#archive-grid', 'start');
say('Каждый день оформлен по-своему, но это страницы одного дневника');
await pause(3.2);
await top();

// 2. A new day: text, photographs, a song.
say('Шаг 1. Рассказ о дне: текстом или голосом');
await click('#compose');
if (day.date) await page.fill('input[name=date]', day.date);
await pause(.8);
await click('textarea[name=story]');
// A long entry is typed faster, so the step takes about the same time for any text.
await page.keyboard.type(day.story, {delay: Math.round(Math.max(8, Math.min(30, 6000 / day.story.length)))});
await pause(.8);
say('Запись читает собственная модель «Оттиска» на устройстве; OpenAI — только по желанию автора');
if (await page.isVisible('#ai-consent')) {
  await point('#ai-consent');
  if (day.ai) await click('input[name=useAI]');
}
await pause(2.6);
say('Шаг 2. Фотографии дня');
await click('#next-step');
await pause(.7);
await point('input[name=photos]');
await page.setInputFiles('input[name=photos]', day.photos);
await pause(2.4);
say('Шаг 3. Песня дня: свой файл, ссылка или подбор из открытого каталога');
await click('#next-step');
// The catalogue search starts by itself on this step; let its list settle before choosing a mode.
await page.waitForFunction(() => !document.querySelector('#music-progress').textContent.startsWith('Ищем'), null, {timeout: 20000}).catch(() => {});
await pause(1.8);
if (day.song.catalog) {
  await page.waitForSelector('#music-picks .music-option', {timeout: 30000});
  if (day.song.pick) {
    const wanted = `#music-picks .music-option:has-text(${JSON.stringify(day.song.pick)})`;
    // The track may be further down the list: ask for more, the way a person would.
    for (let more = 0; more < 4 && !(await page.locator(wanted).count()) && await page.isVisible('#music-more'); more++) {
      await click('#music-more');
      await page.waitForFunction(() => !document.querySelector('#music-more').disabled, null, {timeout: 20000});
      await pause(1.2);
    }
    await click(wanted);
  } else await point('#music-picks .music-option');
  await pause(1.8);
  credit = await page.evaluate(() => ({title: document.querySelector('#preview-title').textContent,
    terms: document.querySelector('#catalog-credit').textContent, url: document.querySelector('#music-preview').src}));
  fs.writeFileSync(songFile, Buffer.from(await (await fetch(credit.url)).arrayBuffer()));
} else {
  await click('input[name=musicType][value=file]');
  await pause(.6);
  await point('input[name=audio]');
  await page.setInputFiles('input[name=audio]', songFile);
  await pause(2.6);
}
say(day.ai ? 'Модель OpenAI читает запись: числа настроения и название папки дня' : 'Модель «Оттиска» читает запись: числа настроения и название папки дня');
await click('#day-form [type=submit]');
await page.waitForSelector('.memory', {timeout: 60000});
const dayTitle = await page.textContent('#day-heading');
await listen('.transport audio', 'music');
await pause(3.4);

// 3. The memory.
say('Сцена собрана из текста, фото и песни. Темп музыки задаёт ритм кадров');
await click('#play');
await page.mouse.move(WIDTH * .78, HEIGHT * .3, {steps: 20});
await pause(5.2);
// A holiday or the weather named in the entry is drawn on the scene: point it out when it is there.
if (await page.locator('.d-air').count()) say('В записи назван праздник: его знаки на сцене, а по всей странице он идёт в темпе дня');
else if (await page.locator('.memory .decor').count()) say('В записи назван праздник или погода, и на сцене появились их знаки');
await pause(5.2);
// The song keeps playing under the explanation and the sliders; it stops before the voice reads.
say('Оттиск и правила объясняют, почему день выглядит именно так');
await glide('#day-stamp');
await pause(3);
await glide('#day-rules');
await pause(3);
say('Песня тоже разобрана: темп, лад и то, как она сдвинула числа');
await glide('#music-line');
await pause(3);
say('Движение тоже считается из чисел: пружина, направление и пауза между элементами');
await glide('#motion-line');
await pause(3.4);

// 4. The numbers can be corrected; the scene and the site follow at once.
say('Числа можно поправить: кадр, сцена, движение и весь сайт меняются сразу');
await click('.tune summary');
await pause(.8);
const slide = async (name, value) => {
  const box = await point(`.tune input[name=${name}]`);
  await page.mouse.click(box.x + 8 + (box.width - 16) * value, box.y + box.height / 2);
  await pause(1.3);
};
const before = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.tune input')].map(input => [input.name, Number(input.value)])));
await slide('tension', .92);
await slide('calm', .04);
await top();
await pause(2.6);
if (day.ai && await page.isVisible('#reread')) {
  say('Одна кнопка возвращает прочтение модели OpenAI');
  await click('#reread');
  await page.waitForFunction(() => document.querySelector('#reading-source').textContent.startsWith('Запись прочитала'), null, {timeout: 60000});
} else {
  say('Те же ползунки возвращают числа на место');
  await slide('tension', before.tension);
  await slide('calm', before.calm);
}
await pause(1.2);
await top();
await pause(1.6);
await click('#play');
await pause(.8);

// 5. Narration.
say('Запись можно послушать: голос читает её с паузами и темпом текста');
await glide('.narrator');
await listen('#narrator-audio', 'voice');
await click('#voice');
await page.waitForFunction(() => { const audio = document.querySelector('#narrator-audio'); return !audio.paused && audio.currentTime > .05; }, null, {timeout: 90000});
const voice = await page.locator('#narrator-audio').evaluate(async audio => {
  const bytes = new Uint8Array(await (await fetch(audio.src)).arrayBuffer());
  let text = '';
  for (let index = 0; index < bytes.length; index += 32768) text += String.fromCharCode(...bytes.subarray(index, index + 32768));
  return {data: btoa(text), duration: audio.duration};
});
fs.writeFileSync(voiceFile, Buffer.from(voice.data, 'base64'));
// A long entry takes most of a minute to read aloud: the video keeps the first twelve seconds.
await page.waitForFunction(() => { const audio = document.querySelector('#narrator-audio'); return audio.ended || audio.currentTime >= 12; }, null, {timeout: 90000});
if (!(await page.locator('#narrator-audio').evaluate(audio => audio.ended))) await click('#voice');
await pause(.8);

// 6. Back in the archive: the diary has moved a little.
await top();
await click('.back');
await page.waitForSelector('.day-card');
if (await page.evaluate(title => document.querySelector('.featured h2')?.textContent === title, dayTitle)) {
  say('Новая запись понемногу сдвинула числа всего дневника: стрелки показывают, на сколько');
  await pause(2.6);
  await glide('.diary-mood');
  await pause(5.4);
} else {
  // A day from the past takes its place by date; the diary is replayed in order with it.
  say('Запись встала в архив по своей дате, и числа дневника пересчитались по всем дням по порядку');
  await pause(1.6);
  await glide('.diary-mood');
  await pause(3);
  await glide(`.day-card:has-text(${JSON.stringify(dayTitle)})`);
  await pause(2.8);
}
say('Композиция меняется с настроением. У радостного дня светлая страница, кадр лежит отпечатком');
await glide('#archive-grid', 'start');
await pause(1);
await click('.day-card[href="#day/train"]');
await pause(3.8);
await click('.back');
await page.waitForSelector('.day-card');
say('Карточка вырастает в сцену. У напряжённого дня сетка, рубленый шрифт и резкое движение');
await pause(.8);
await click('.day-card[href="#day/office"]');
await pause(4.4);
say('Папка дня: текст, фото, песня, сцена и озвучка в одном архиве');
const saved = page.waitForEvent('download').catch(() => null);
await click('#download');
await saved;
await pause(3);
say(null);

const length = clock();
clearInterval(pump);
await cdp.send('Page.stopScreencast');
encoder.stdin.end();
await once(encoder, 'close');
await browser.close();
const take = {length, captions, sounds, credit};
fs.writeFileSync(timelineFile, JSON.stringify(take, null, 1));
return take;
}

const {length, captions, sounds, credit: musicCredit} = process.argv.includes('--compose')
  ? JSON.parse(fs.readFileSync(timelineFile, 'utf8')) : await record();

// --- sound: every stretch the page played is laid under the picture at the same moment.
const stretches = [];
for (const kind of ['music', 'voice']) {
  let open = null;
  for (const item of sounds.filter(sound => sound.kind === kind)) {
    if (item.event === 'play') open = item;
    else if (open) { stretches.push({kind, at: open.at, from: open.position, length: item.at - open.at}); open = null; }
  }
  if (open) stretches.push({kind, at: open.at, from: open.position, length: length - open.at});
}
const inputs = ['-i', rawVideo];
const filters = [`[0:v]pad=${WIDTH}:${HEIGHT + STRIP}:0:0:color=0x15170f[v0]`];
captions.forEach((caption, index) => {
  const file = path.join(work, `caption-${index}.txt`);
  fs.writeFileSync(file, caption.text);
  const escaped = value => value.replace(/\\/g, '/').replace(/:/g, '\\:');
  filters.push(`[v${index}]drawtext=fontfile=${escaped(font)}:textfile=${escaped(file)}:fontcolor=0xf3f0df:fontsize=21:` +
    `x=(w-text_w)/2:y=${HEIGHT}+(${STRIP}-text_h)/2:enable='between(t,${caption.start.toFixed(2)},${(caption.end ?? length).toFixed(2)})'[v${index + 1}]`);
});
const mixed = [];
stretches.filter(stretch => stretch.length > .2).forEach((stretch, index) => {
  inputs.push('-ss', stretch.from.toFixed(3), '-t', stretch.length.toFixed(3), '-i', stretch.kind === 'music' ? songFile : voiceFile);
  const fade = Math.max(0, stretch.length - .25).toFixed(2);
  filters.push(`[${index + 1}:a]aresample=48000,loudnorm=I=${stretch.kind === 'music' ? -20 : -17}:TP=-2:LRA=11,aresample=48000,afade=t=in:st=0:d=0.12,afade=t=out:st=${fade}:d=0.25,` +
    `adelay=${Math.round(stretch.at * 1000)}:all=1[a${index}]`);
  mixed.push(`[a${index}]`);
});
filters.push(`anullsrc=r=48000:cl=stereo,atrim=0:${length.toFixed(2)}[quiet]`);
// Tracks are mastered at very different levels: even them out, then keep peaks below clipping.
filters.push(`[quiet]${mixed.join('')}amix=inputs=${mixed.length + 1}:normalize=0:duration=first,alimiter=limit=0.84:level=disabled[aout]`);
const final = spawn('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filters.join(';'), '-map', `[v${captions.length}]`, '-map', '[aout]',
  '-t', length.toFixed(2), '-r', String(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', output], {stdio: 'inherit'});
const [code] = await once(final, 'close');
console.log(code === 0 ? `Готово: ${output}, ${length.toFixed(1)} с` : `ffmpeg завершился с кодом ${code}`);
if (musicCredit) console.log(`В ролике звучит трек из каталога: ${musicCredit.title}. ${musicCredit.terms}\nУкажите автора и лицензию в описании сдачи.`);
process.exit(code);
