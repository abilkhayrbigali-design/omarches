// The day's signs over the whole page of an open day: a band under the site header,
// the corners of the document, both side margins from top to bottom, and weather
// across the viewport. The layer sits behind the text (z-index -1 against the body),
// so the columns stay as readable as without it; strong signs go where there is no text.
import {GLYPHS, KITS, PALETTE, flake, mix, seeded} from './context-signs.mjs';

const f1 = value => value.toFixed(1);
const clamp = (x, min = 0, max = 1) => Math.min(max, Math.max(min, Number(x) || 0));

// The page is not inside the scene, so the colours come from the site theme on :root.
const STYLE = `<style>
.d-page{position:absolute;inset:0;z-index:-1;pointer-events:none;overflow:hidden;--scene-accent:var(--accent,#e8c27a)}
.d-page svg{position:absolute;overflow:visible;aspect-ratio:1}
.d-page .d-la,.d-page .d-lb,.d-page .d-lp,.d-page .d-lw{fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.d-page .d-la{stroke:var(--d-a)}.d-page .d-lb{stroke:var(--d-b)}.d-page .d-lp{stroke:var(--d-p)}.d-page .d-lw{stroke:var(--d-w)}
.d-page .d-fa{fill:var(--d-a);fill-opacity:.3}.d-page .d-fb{fill:var(--d-b);fill-opacity:.3}.d-page .d-fp{fill:var(--d-p);fill-opacity:.22}.d-page .d-fw{fill:var(--d-w);fill-opacity:.2}
.d-page .d-ga{fill:var(--d-a)}.d-page .d-gb{fill:var(--d-b)}.d-page .d-gp{fill:var(--d-p)}
.d-page .d-k{fill:var(--paper,#16130f)}
.d-page .d-col{position:absolute;top:0;bottom:0;width:max(54px,calc((100% - 1248px) / 2))}
.d-page .d-col svg{width:clamp(34px,62%,150px)}
.d-page .d-band{position:absolute;left:0;right:0;top:0;height:150px}
.d-page .d-band>svg,.d-page .d-wide{aspect-ratio:auto}
.d-page .d-quiet{opacity:.5}
.d-page .d-sky1{top:92px;right:1.5%;width:clamp(30px,calc((100% - 1248px) / 4),170px)}.d-page .d-sky1.d-left{right:auto;left:1.5%}
.d-page .d-wide.d-corner{opacity:.72}
.d-bob,.d-sway,.d-spin,.d-flick,.d-drift{transform-box:fill-box}
main:has(.memory.playing) .d-page .d-bob{animation:d-bob calc(var(--tempo,1s) * 6) ease-in-out infinite alternate}
main:has(.memory.playing) .d-page .d-sway{transform-origin:50% 0;animation:d-sway calc(var(--tempo,1s) * 7) ease-in-out infinite alternate}
main:has(.memory.playing) .d-page .d-spin{transform-origin:50% 50%;animation:d-spin 60s linear infinite}
main:has(.memory.playing) .d-page .d-flick{transform-origin:50% 100%;animation:d-flick 1.1s ease-in-out infinite alternate}
main:has(.memory.playing) .d-page .d-drift{animation:d-drift 14s ease-in-out infinite alternate}
main:has(.memory.playing) .d-page .d-fallen{animation:d-pagefall linear infinite}
main:has(.memory.playing) .d-page .d-flash{animation:d-pageflash 9s linear infinite}
@keyframes d-bob{to{transform:translateY(-6px)}}
@keyframes d-sway{from{transform:rotate(-4deg)}to{transform:rotate(4deg)}}
@keyframes d-spin{to{transform:rotate(360deg)}}
@keyframes d-flick{from{opacity:.6}to{opacity:1}}
@keyframes d-drift{to{transform:translateX(18px)}}
@keyframes d-pagefall{from{transform:translateY(-12vh)}to{transform:translateY(112vh)}}
@keyframes d-pageflash{0%,70%,73%,100%{opacity:0}71%,72%{opacity:.07}}
.d-sky{position:fixed;inset:0;overflow:hidden}
.d-sky .d-drops{position:absolute;inset:-12vh 0 0}
.d-sky .d-drops svg{aspect-ratio:auto}
.d-sky .d-bright{position:absolute;inset:0;background:var(--d-p);opacity:0}
.d-fog{position:absolute;left:-10%;width:120%;height:9vh;border-radius:50%;background:var(--d-p);opacity:.05;filter:blur(18px)}
@media(max-width:1500px){.d-page .d-sky1{top:168px;right:2px;width:50px}.d-page .d-sky1.d-left{left:2px}}
@media(max-width:900px){.d-page .d-corner{opacity:.45}.d-page .d-sky1{width:36px;translate:30% 0}.d-page .d-sky1.d-left{translate:-30% 0}.d-page .d-col{width:34px}.d-page .d-col svg{width:44px;opacity:.75}.d-page .d-l svg{translate:-38% 0}.d-page .d-r svg{translate:38% 0}}
@media(max-width:680px){.d-page .d-band{opacity:.4}.d-page .d-band svg:not(.d-wide){width:16px!important;margin-left:4px}.d-page .d-col svg{width:32px;opacity:.6}}
@media(prefers-reduced-motion:reduce){.d-page *{animation:none!important}}
</style>`;

// One sign in a -50..50 box, placed by CSS.
const sign = (glyph, style, cls = '') => `<svg class="${cls}" style="${style}" viewBox="-50 -50 100 100" aria-hidden="true">${glyph}</svg>`;
// A corner piece, its glyph drawn from (0,0) into a 100 box, turned toward the given corner.
const corner = (glyph, side, size) => {
  const [v, h] = side;
  const flip = `scale(${h === 'right' ? -1 : 1} ${v === 'bottom' ? -1 : 1})`;
  return `<svg class="d-wide d-corner" style="${v}:0;${h}:0;width:${size};height:${size}" viewBox="0 0 100 100" aria-hidden="true"><g transform="translate(${h === 'right' ? 100 : 0} ${v === 'bottom' ? 100 : 0}) ${flip}">${glyph}</g></svg>`;
};

// Strings that sag across the band, with something hung along them.
function swags(loops, depth, hang, per, random) {
  let path = '', items = '';
  for (let l = 0; l < loops; l++) {
    const x0 = l * 100 / loops, x1 = (l + 1) * 100 / loops;
    path += `M${f1(x0)} 0Q${f1((x0 + x1) / 2)} ${depth * 2} ${f1(x1)} 0`;
    for (let i = 1; i <= per; i++) {
      const t = i / (per + 1);
      items += hang(x0 + (x1 - x0) * t, 2 * depth * t * (1 - t), l * per + i, random);
    }
  }
  return `<svg class="d-wide" style="left:0;top:0;width:100%;height:${depth * 2}px" viewBox="0 0 100 ${depth * 2}" preserveAspectRatio="none"><path class="d-lp" stroke-width="1.2" vector-effect="non-scaling-stroke" d="${path}"/></svg>${items}`;
}

// A horizontal strip of the ram's horn ornament: the Nauryz border.
const hornStrip = (id, top) => `<svg class="d-wide" style="left:0;top:${top}px;width:100%;height:30px" aria-hidden="true"><defs><pattern id="${id}" width="64" height="30" patternUnits="userSpaceOnUse">
  <g transform="translate(32 17) scale(.42)"><path class="d-la" stroke-width="4" d="M0 22C0 8-2-2-10-8C-20-15-32-8-30 2C-28 10-18 10-17 3C-16-2-22-4-24 0"/><path class="d-la" stroke-width="4" transform="scale(-1 1)" d="M0 22C0 8-2-2-10-8C-20-15-32-8-30 2C-28 10-18 10-17 3C-16-2-22-4-24 0"/></g>
  <path class="d-lb" stroke-width="1.2" d="M0 28H64M0 3H64"/></pattern></defs><rect width="100%" height="30" fill="url(#${id})"/></svg>`;

const SIDE = {
  halloween: ['pumpkin', 'ghost', 'bat', 'skull', 'bat', 'ghost', 'pumpkin'],
  newyear: ['bauble', 'snowflake', 'star', 'fir', 'bauble', 'snowflake', 'sparkler'],
  birthday: ['balloon', 'confetti', 'candle', 'balloon', 'confetti', 'balloon'],
  nauryz: ['shanyrak', 'tulip', 'horn', 'snowdrop', 'tulip', 'shanyrak']
};

export function pageDecor(context, imprint) {
  const weather = context.weather || [];
  const has = kind => weather.find(item => item.kind === kind);
  const occasion = KITS[context.occasion] ? context.occasion : null;
  if (!occasion && !weather.length) return '';
  const f = imprint?.feelings || {};
  const festive = clamp(f.festive), quiet = clamp(f.quiet);
  const random = seeded(`${occasion}:${weather.map(w => w.kind).join(',')}:${imprint?.title || ''}`);
  const key = 'd' + Math.floor(random() * 1e8).toString(36);
  const band = [], corners = [], left = [], right = [], sky = [];
  const quietCls = quiet > .7 ? 'd-quiet' : '';

  // Side margins: a sign every so often down the whole document, alternating sides.
  const side = (kind, i, count, glyph) => {
    const top = 8 + (i + random() * .7) * 88 / count;
    const scale = (.7 + random() * .45).toFixed(2);
    const html = sign(`<g style="animation-delay:-${f1(random() * 6)}s">${glyph || GLYPHS[kind](random)}</g>`,
      `top:${f1(top)}%;left:${f1(10 + random() * 25)}%;scale:${scale}`, quietCls);
    (i % 2 ? right : left).push(html);
  };
  if (occasion) {
    const count = Math.round(6 + festive * 8 - quiet * 3);
    const kit = SIDE[occasion];
    for (let i = 0; i < count; i++) side(kit[(i + Math.floor(random() * 3)) % kit.length], i, count);
  }

  // The band under the header and the corners of the document.
  // Corners grow with the margin, so on a laptop they never reach the header buttons or the footer.
  const cornerSize = 'clamp(54px,calc((100% - 1248px) / 2),250px)';
  if (occasion === 'birthday') band.push(swags(6, 34, (x, y, i) =>
    sign(`<path class="${i % 2 ? 'd-fa' : 'd-fb'}" style="fill-opacity:.55" d="M-22-30H22L0 30Z"/><path class="${i % 2 ? 'd-la' : 'd-lb'}" d="M-22-30H22L0 30Z"/>`,
      `left:calc(${f1(x)}% - 14px);top:${f1(y + 4)}px;width:28px;rotate:${(i % 3 - 1) * 6}deg`), 4, random));
  if (occasion === 'newyear') band.push(swags(7, 30, (x, y, i) =>
    sign(`<g class="d-flick" style="animation-delay:-${f1(i * .37)}s"><circle class="${i % 2 ? 'd-ga' : 'd-gb'}" r="11"/><circle class="d-gp" r="5"/><circle class="${i % 2 ? 'd-fa' : 'd-fb'}" r="26" style="fill-opacity:.16"/></g>`,
      `left:calc(${f1(x)}% - 13px);top:${f1(y - 6)}px;width:26px`), 5, random));
  if (occasion === 'halloween') {
    // Strands from the top edge with a spider on each, in the side margins where there is no text.
    for (let i = 0; i < 4 + Math.round(festive * 3); i++) {
      const x = 8 + random() * 62, drop = 60 + random() * 160;
      (i % 2 ? right : left).push(`<svg class="d-wide" style="left:${f1(x)}%;top:0;width:30px;height:${f1(drop + 30)}px" viewBox="-15 0 30 ${f1(drop + 30)}"><g class="d-sway"><line class="d-lp" stroke-width="1" x1="0" y1="0" x2="0" y2="${f1(drop)}"/>
        <g transform="translate(0 ${f1(drop + 8)}) scale(.55)"><ellipse class="d-gp" rx="5" ry="6" opacity=".8"/><path class="d-lp" stroke-width="1.6" d="M-4-3l-9-6-3-6M-4 0l-11 0-4 4M-4 3l-9 6-2 6M4-3l9-6 3-6M4 0l11 0 4 4M4 3l9 6 2 6"/></g></g></svg>`);
    }
    corners.push(corner(GLYPHS.web(), ['top', 'left'], cornerSize));
    if (!has('sun')) corners.push(corner(GLYPHS.web(), ['top', 'right'], cornerSize));
    corners.push(sign(GLYPHS.pumpkin(), 'bottom:18px;left:max(2px,min(2%,calc((100% - 1248px) / 2 - 34px)));width:clamp(30px,calc((100% - 1248px) / 4),110px)'), sign(GLYPHS.pumpkin(), 'bottom:22px;right:max(2px,min(3%,calc((100% - 1248px) / 2 - 34px)));width:clamp(30px,calc((100% - 1248px) / 4),90px)'));
  }
  if (occasion === 'nauryz') {
    band.push(hornStrip(key + 'h', 0));
    corners.push(sign(GLYPHS.tulip(), 'bottom:6px;left:max(2px,min(1.5%,calc((100% - 1248px) / 2 - 34px)));width:clamp(30px,calc((100% - 1248px) / 4),110px)'), sign(GLYPHS.snowdrop(), 'bottom:6px;left:calc(1.5% + clamp(26px,calc((100% - 1248px) / 4),90px));width:clamp(30px,calc((100% - 1248px) / 4),90px)'),
      sign(GLYPHS.tulip(), 'bottom:6px;right:max(2px,min(2%,calc((100% - 1248px) / 2 - 34px)));width:clamp(30px,calc((100% - 1248px) / 4),110px)'));
    if (!weather.length) corners.push(sign(GLYPHS.springsun(), '', 'd-sky1'));
  }
  if (occasion === 'newyear') corners.push(sign(GLYPHS.fir(), 'bottom:10px;left:max(2px,min(1.5%,calc((100% - 1248px) / 2 - 34px)));width:clamp(30px,calc((100% - 1248px) / 4),130px)'), sign(GLYPHS.fir(), 'bottom:10px;right:max(2px,min(1.5%,calc((100% - 1248px) / 2 - 34px)));width:clamp(30px,calc((100% - 1248px) / 4),110px)'));
  if (occasion === 'birthday') corners.push(sign(GLYPHS.balloon(random), 'bottom:40px;left:max(2px,min(2%,calc((100% - 1248px) / 2 - 34px)));width:clamp(30px,calc((100% - 1248px) / 4),110px)'), sign(GLYPHS.balloon(random), 'bottom:70px;right:max(2px,min(2.5%,calc((100% - 1248px) / 2 - 34px)));width:clamp(30px,calc((100% - 1248px) / 4),96px)'));

  // Weather: a sky in the top corner, signs in the margins, and a light layer over the viewport.
  const amount = kind => has(kind)?.amount ?? 0;
  if (has('sun') || has('heat')) corners.push(sign(GLYPHS.sun(random, amount('sun'), !!has('heat')), '', 'd-sky1'));
  const cloudy = has('clouds') || has('rain') || has('snow') || has('storm');
  if (cloudy) {
    const glyph = has('storm') ? () => GLYPHS.storm(random) : has('rain') ? () => GLYPHS.rain(random, amount('rain')) : has('snow') ? () => GLYPHS.snow(random, amount('snow')) : () => GLYPHS.cloud();
    const clouds = 2 + Math.round((amount('rain') || amount('snow') || amount('clouds') || .5) * 3);
    for (let i = 0; i < clouds; i++) side(null, i, clouds, glyph());
    corners.push(sign(glyph(), '', has('sun') || has('heat') ? 'd-sky1 d-left' : 'd-sky1'));
  }
  if (has('wind')) {
    const lines = 2 + Math.round(amount('wind') * 3);
    for (let i = 0; i < lines; i++) (i % 2 ? right : left).push(`<svg class="d-wide ${quietCls}" style="top:${f1(10 + (i + random() * .6) * 85 / lines)}%;left:${f1(random() * 10)}%;width:78%;aspect-ratio:4" viewBox="-100 -25 200 50">${GLYPHS.wind(random, amount('wind'))}</svg>`);
  }
  if (has('frost')) {
    corners.push(corner(GLYPHS.frost(random), ['top', 'left'], cornerSize), corner(GLYPHS.frost(random), ['bottom', 'right'], cornerSize));
    if (occasion !== 'halloween') corners.push(corner(GLYPHS.frost(random), ['top', 'right'], cornerSize), corner(GLYPHS.frost(random), ['bottom', 'left'], cornerSize));
  }
  // Rain and snow cross the whole viewport, sparse and pale; they fall only while the scene plays.
  const falling = has('snow') || has('rain');
  if (falling) {
    const snow = has('snow') && !has('rain');
    const count = Math.round(16 + falling.amount * 26);
    const drops = Array.from({length: count}, () => {
      const x = random() * 100, y = random() * 110, time = (snow ? 18 : 3) + random() * (snow ? 14 : 2);
      const look = snow ? `<svg style="left:${f1(x)}%;top:${f1(y)}vh;width:${f1(7 + random() * 7)}px;aspect-ratio:1" viewBox="-10 -10 20 20">${flake(9, 'd-lp', 1.5)}</svg>`
        : `<svg style="left:${f1(x)}%;top:${f1(y)}vh;width:6px;height:${f1(14 + falling.amount * 16)}px" viewBox="0 0 6 30" preserveAspectRatio="none"><line class="d-lw" x1="5" y1="0" x2="1" y2="30" stroke-width="1.2" vector-effect="non-scaling-stroke"/></svg>`;
      return `<div class="d-fallen" style="position:absolute;inset:0;animation-duration:${f1(time)}s;animation-delay:-${f1(random() * time)}s">${look}</div>`;
    }).join('');
    sky.push(`<div class="d-drops" style="opacity:${f1(.14 + falling.amount * .14 - quiet * .06)}">${drops}</div>`);
  }
  if (has('fog')) sky.push(Array.from({length: 2 + Math.round(amount('fog') * 3)}, (_, i) =>
    `<div class="d-fog d-drift" style="top:${f1(8 + i * 22 + random() * 8)}vh;opacity:${f1(.04 + amount('fog') * .05)};animation-delay:-${f1(i * 3)}s"></div>`).join(''));
  if (has('storm')) sky.push('<div class="d-bright d-flash"></div>');

  const [a, b] = PALETTE[occasion || 'none'];
  const vars = `--d-a:${mix(a)};--d-b:${mix(b)};--d-p:color-mix(in oklab,var(--text,#eee) 78%,var(--accent,#e8c27a));--d-w:${mix('hsl(205 75% 82%)', 78)};opacity:${f1(.95 - quiet * .3)}`;
  return `<div class="d-page" style="${vars}" aria-hidden="true">${STYLE}${sky.length ? `<div class="d-sky">${sky.join('')}</div>` : ''}<div class="d-band">${band.join('')}</div>${corners.join('')}<div class="d-col d-l" style="left:0">${left.join('')}</div><div class="d-col d-r" style="right:0">${right.join('')}</div></div>`;
}
