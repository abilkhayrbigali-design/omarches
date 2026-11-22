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
.d-clouds{position:fixed;inset:0;z-index:7;pointer-events:none;overflow:hidden;color:var(--d-p)}
.d-cloud{position:absolute;left:0;top:var(--y);width:clamp(115px,var(--width),360px);animation:d-cloud-cross var(--time) linear infinite;animation-delay:var(--delay)}
.d-cloud svg{display:block;width:100%;height:auto;overflow:visible}
.d-cloud.far{filter:blur(1px)}
@keyframes d-cloud-cross{from{transform:translate(-110%,0)}to{transform:translate(100vw,12px)}}
@media(max-width:1500px){.d-page .d-sky1{top:168px;right:2px;width:50px}.d-page .d-sky1.d-left{left:2px}}
@media(max-width:900px){.d-page .d-corner{opacity:.45}.d-page .d-sky1{width:36px;translate:30% 0}.d-page .d-sky1.d-left{translate:-30% 0}.d-page .d-col{width:34px}.d-page .d-col svg{width:44px;opacity:.75}.d-page .d-l svg{translate:-38% 0}.d-page .d-r svg{translate:38% 0}}
@media(max-width:680px){.d-page .d-band{opacity:.4}.d-page .d-band svg:not(.d-wide){width:16px!important;margin-left:4px}.d-page .d-col svg{width:32px;opacity:.6}}
/* The air of a holiday: some decorations cross the window, while Halloween
   flyers follow paths anchored to the top of the document.
   --pace, --sway and --air-ease come from the mood of the day (motionTokens on :root):
   a festive day is quick and swings wide, a quiet one slow and nearly straight, a tense one twitches. */
.d-air{position:fixed;inset:0;z-index:8;pointer-events:none;overflow:hidden}
.d-air--halloween{position:absolute}
.d-air svg{display:block;overflow:visible;aspect-ratio:1}
.d-air .d-la,.d-air .d-lb,.d-air .d-lp{fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.d-air .d-la{stroke:var(--d-a)}.d-air .d-lb{stroke:var(--d-b)}.d-air .d-lp{stroke:var(--d-p)}
.d-air .d-fa{fill:var(--d-a);fill-opacity:.42}.d-air .d-fb{fill:var(--d-b);fill-opacity:.42}.d-air .d-fp{fill:var(--d-p);fill-opacity:.4}
.d-air .d-ga{fill:var(--d-a)}.d-air .d-gb{fill:var(--d-b)}.d-air .d-gp{fill:var(--d-p)}.d-air .d-gg{fill:none;stroke:var(--d-g);stroke-linecap:round}
.d-air .d-k{fill:#0b0c08;fill-opacity:.72}
.d-fly{position:absolute;left:0;top:0;animation:d-cross calc(var(--t) / var(--pace,1)) linear infinite;animation-delay:calc(var(--d) / var(--pace,1))}
.d-wob{animation:d-wob calc(var(--w) / var(--pace,1)) var(--air-ease,ease-in-out) infinite alternate;animation-delay:var(--d2)}
.d-side{animation:d-side calc(var(--w) / var(--pace,1)) var(--air-ease,ease-in-out) infinite alternate;animation-delay:var(--d2)}
.d-tumble{animation:d-tumble calc(var(--w) * 2.6 / var(--pace,1)) linear infinite,d-side calc(var(--w) / var(--pace,1)) var(--air-ease,ease-in-out) infinite alternate;animation-delay:var(--d2)}
@keyframes d-cross{from{transform:translate(var(--x0),var(--y0))}to{transform:translate(var(--x1),var(--y1))}}
@keyframes d-wob{from{translate:0 calc(var(--sway,10px) * var(--amp,1) * -1);rotate:calc(var(--lean,4deg) * -1)}to{translate:0 calc(var(--sway,10px) * var(--amp,1));rotate:var(--lean,4deg)}}
@keyframes d-side{from{translate:calc(var(--sway,10px) * var(--amp,1) * -1) 0}to{translate:calc(var(--sway,10px) * var(--amp,1)) 0}}
@keyframes d-tumble{to{rotate:360deg}}
.d-air .d-grass{position:absolute;left:0;bottom:0;width:100%;height:clamp(26px,6vh,56px);aspect-ratio:auto;transform-origin:50% 100%;animation:d-grow calc(var(--settle,.6s) * 2.4) var(--spring,ease-out) both}
.d-air .d-grass g{transform-box:fill-box;transform-origin:50% 100%;animation:d-blade calc(4.6s / var(--pace,1)) ease-in-out infinite alternate}
@keyframes d-grow{from{transform:scaleY(0)}}
@keyframes d-blade{from{transform:rotate(-3deg)}to{transform:rotate(3deg)}}
@media(max-width:680px){.d-air .d-fly:nth-child(2n){display:none}}
@media(prefers-reduced-motion:reduce){.d-page *{animation:none!important}.d-air,.d-clouds,.weather-precipitation{display:none}}
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
  // Rain and snow over the whole window are drawn by weather.mjs (see the mark at the end).
  if (has('fog')) sky.push(Array.from({length: 2 + Math.round(amount('fog') * 3)}, (_, i) =>
    `<div class="d-fog d-drift" style="top:${f1(8 + i * 22 + random() * 8)}vh;opacity:${f1(.04 + amount('fog') * .05)};animation-delay:-${f1(i * 3)}s"></div>`).join(''));
  if (has('storm')) sky.push('<div class="d-bright d-flash"></div>');

  // The air of the holiday, over the whole window and above the page, pale enough to read through.
  // How many there are comes from the day's own numbers; how they move comes from its motion.
  const air = [];
  const joy = clamp(f.joy), calm = clamp(f.calm), tension = clamp(f.tension), warmth = clamp(f.warmth);
  const flyer = (glyph, {size, opacity, from, to, time, wob, kind = 'd-wob', lean = 4, amp = 1, view = '-50 -50 100 100', ratio = 1}) =>
    `<div class="d-fly" style="--x0:${from[0]};--y0:${from[1]};--x1:${to[0]};--y1:${to[1]};--t:${f1(time)}s;--d:-${f1(random() * time)}s">` +
    `<div class="${kind}" style="--w:${f1(wob)}s;--d2:-${f1(random() * wob)}s;--lean:${f1(lean)}deg;--amp:${amp}">` +
    `<svg style="width:${f1(size)}px;aspect-ratio:${ratio};opacity:${opacity.toFixed(2)}" viewBox="${view}" aria-hidden="true">${glyph}</svg></div></div>`;
  const vw = value => `${f1(value)}vw`, vh = value => `${f1(value)}vh`;
  if (occasion === 'halloween') {
    // Ghosts drift across at their own heights, each a little up or down; bats cut through faster.
    const offLeft = 'calc(-100% - 24px)', offRight = 'calc(100vw + 24px)';
    const ghosts = Math.round(clamp(3 + 5 * festive + joy - 2 * quiet, 2, 8));
    for (let i = 0; i < ghosts; i++) {
      const back = random() < .5, y = 6 + (i + random()) * 76 / ghosts;
      air.push(flyer(GLYPHS.ghost(), {size: 84 + random() * 80, opacity: .42 + random() * .2, time: 22 + random() * 20, wob: 3 + random() * 2.6, lean: 4 + random() * 6,
        from: [back ? offRight : offLeft, vh(y)], to: [back ? offLeft : offRight, vh(y + random() * 22 - 11)]}));
    }
    const bats = Math.round(clamp(1 + 3 * festive + 2 * tension, 1, 6));
    for (let i = 0; i < bats; i++) {
      const back = random() < .5, y = 4 + random() * 46;
      air.push(flyer(GLYPHS.bat(), {size: 34 + random() * 30, opacity: .5 + random() * .25, time: 10 + random() * 8, wob: .45 + random() * .3, lean: 9, amp: .5,
        from: [back ? offRight : offLeft, vh(y)], to: [back ? offLeft : offRight, vh(y + random() * 30 - 8)]}));
    }
  }
  if (occasion === 'nauryz') {
    // Spring: blossom petals on a warm wind, swallows high up, young grass along the bottom of the window.
    const petals = Math.round(clamp(10 + 12 * joy + 8 * festive + 4 * warmth - 6 * quiet, 8, 30));
    for (let i = 0; i < petals; i++) {
      const x = random() * 125 - 30;
      air.push(flyer(`<path class="${i % 3 ? 'd-fb' : 'd-fp'}" style="fill-opacity:.85" d="M0-9C6-6 7 3 0 9C-7 3-6-6 0-9Z"/>`, {view: '-10 -10 20 20', size: 12 + random() * 10, opacity: .65 + random() * .3,
        time: 11 + random() * 10, wob: 1.8 + random() * 1.6, kind: 'd-tumble', from: [vw(x), vh(-6)], to: [vw(x + 18 + random() * 22), vh(106)]}));
    }
    const swallows = Math.round(clamp(1 + 2 * joy + festive, 1, 4));
    for (let i = 0; i < swallows; i++) {
      const back = random() < .35, y = 6 + random() * 26;
      air.push(flyer(`<g transform="scale(${back ? -1 : 1} 1)"><path class="d-gp" d="M0 0C-9-9-22-10-32-3C-22-4-13-1-7 5L-17 17-3 9 3 12 7 5C13-1 22-4 32-3C22-10 9-9 0 0Z"/></g>`, {size: 46 + random() * 26, opacity: .62,
        time: 9 + random() * 6, wob: 1.6 + random(), lean: 7, amp: 1.5, from: [vw(back ? 106 : -8), vh(y)], to: [vw(back ? -8 : 106), vh(y + random() * 14 - 9)]}));
    }
    const tufts = Array.from({length: 8}, (_, tuft) => `<g style="animation-delay:-${f1(random() * 4)}s">${Array.from({length: 11}, (_, blade) => {
      const x = tuft * 150 + blade * 13.6 + random() * 8, h = 16 + random() * 40, bend = random() * 14 - 7;
      return `<path class="d-gg" stroke-width="${f1(1.2 + random())}" vector-effect="non-scaling-stroke" d="M${f1(x)} 60Q${f1(x + bend * .3)} ${f1(60 - h * .55)} ${f1(x + bend)} ${f1(60 - h)}"/>`;
    }).join('')}</g>`).join('');
    air.push(`<svg class="d-grass" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true" style="opacity:${f1(.5 + .2 * joy)}">${tufts}</svg>`);
  }
  if (occasion === 'birthday') {
    // Balloons rise slowly, confetti comes down turning.
    const balloons = Math.round(clamp(2 + 5 * festive + 2 * joy, 2, 8));
    for (let i = 0; i < balloons; i++) {
      const x = 4 + (i + random()) * 90 / balloons;
      air.push(flyer(GLYPHS.balloon(), {size: 62 + random() * 46, opacity: .42 + random() * .18, time: 20 + random() * 14, wob: 3 + random() * 2, kind: 'd-side', amp: .8,
        from: [vw(x), vh(112)], to: [vw(x + random() * 10 - 5), vh(-26)]}));
    }
    const confetti = Math.round(clamp(6 + 20 * festive, 6, 26));
    for (let i = 0; i < confetti; i++) {
      const x = random() * 100;
      air.push(flyer(`<rect class="${['d-ga', 'd-gb', 'd-gp'][i % 3]}" x="-6" y="-3" width="12" height="6" rx="1"/>`, {view: '-10 -10 20 20', size: 12 + random() * 7, opacity: .65 + random() * .3,
        time: 7 + random() * 6, wob: 1 + random(), kind: 'd-tumble', from: [vw(x), vh(-5)], to: [vw(x + random() * 14 - 7), vh(106)]}));
    }
  }

  // Start the clouds at staggered points along their route and vary their depth and silhouette.
  const overcast = Math.max(amount('clouds'), amount('rain') * .7, amount('snow') * .6, has('storm') ? .9 : 0);
  const cloudCount = overcast ? Math.round(3 + overcast * 3) : 0;
  const clouds = Array.from({length: cloudCount}, (_, i) => {
    const far = i % 2 === 0;
    const time = (far ? 62 : 39) + random() * 18;
    const phase = (i + .35 + random() * .3) / cloudCount;
    const shape = far
      ? 'M4 35Q8 26 30 26Q32 14 53 17Q64 5 82 13Q92 16 96 25Q119 24 124 34Q128 41 115 43H17Q3 43 4 35Z'
      : 'M4 33Q8 24 23 25Q31 14 45 18Q48 5 66 6Q82 6 89 20Q105 16 112 27Q124 28 125 36Q123 44 109 44H19Q3 43 4 33Z';
    const opacity = (far ? .08 : .12) + overcast * .09;
    return `<div class="d-cloud${far ? ' far' : ''}" style="--y:${f1(1 + random() * 24)}vh;--width:${f1((far ? 18 : 22) + random() * 9)}vw;--time:${f1(time)}s;--delay:-${f1(time * phase)}s;opacity:${opacity.toFixed(2)}"><svg viewBox="0 0 128 48" fill="currentColor"><path d="${shape}"/><path opacity=".38" d="M13 38Q44 42 69 37T118 35Q117 42 105 43H23Q15 43 13 38Z"/></svg></div>`;
  }).join('');
  const snowfall = Math.max(amount('snow'), occasion === 'newyear' ? .32 : 0);
  const rainfall = Math.max(amount('rain'), has('storm') ? .9 : 0);
  const weatherMark = snowfall || rainfall ? `<i class="d-weather" hidden data-snow="${f1(snowfall)}" data-rain="${f1(rainfall)}"></i>` : '';

  const [a, b] = PALETTE[occasion || 'none'];
  const vars = `--d-a:${mix(a)};--d-b:${mix(b)};--d-p:color-mix(in oklab,var(--text,#eee) 78%,var(--accent,#e8c27a));--d-w:${mix('hsl(205 75% 82%)', 78)};opacity:${f1(.95 - quiet * .3)}`;
  const airVars = `--d-a:${mix(a, 82)};--d-b:${mix(b, 82)};--d-p:color-mix(in oklab,var(--text,#eee) 82%,var(--accent,#e8c27a));--d-g:${mix('hsl(104 46% 60%)', 78)};--scene-accent:var(--accent,#e8c27a)`;
  const airClass = occasion === 'halloween' ? 'd-air d-air--halloween' : 'd-air';
  const airLayer = air.length ? `<div class="${airClass}" style="${airVars};opacity:${f1(1 - quiet * .25)}" aria-hidden="true">${air.join('')}</div>` : '';
  const cloudLayer = clouds ? `<div class="d-clouds" style="${airVars}" aria-hidden="true">${clouds}</div>` : '';
  return `<div class="d-page" style="${vars}" aria-hidden="true">${STYLE}${sky.length ? `<div class="d-sky">${sky.join('')}</div>` : ''}<div class="d-band">${band.join('')}</div>${corners.join('')}<div class="d-col d-l" style="left:0">${left.join('')}</div><div class="d-col d-r" style="right:0">${right.join('')}</div></div>${cloudLayer}${airLayer}${weatherMark}`;
}
