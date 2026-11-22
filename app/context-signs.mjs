// Signs of a holiday and of the weather, drawn in the language of the generated
// figures in scene.mjs: thin lines and flat pale shapes, screened over the photograph
// and tinted by the accent of the day. Dark fills become holes under the screen
// blend, which is how a ghost gets its eyes without a single dark pixel.
//
// The outer svg has no viewBox, so every sign is a nested svg placed by percentages:
// the signs keep their shape on a wide scene, a phone and a card alike.

// Same tiny generator as scene.mjs (copied: that one is private to the scene).
function seeded(text) {
  let hash = 2166136261;
  for (const ch of String(text)) hash = Math.imul(hash ^ ch.codePointAt(0), 16777619);
  let state = hash >>> 0;
  return () => {
    state = state + 0x6D2B79F5 | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const f1 = value => value.toFixed(1);
const clamp = (x, min = 0, max = 1) => Math.min(max, Math.max(min, Number(x) || 0));
// A scene is about 1000×600; a sign's box height in percent is its width times this.
const WIDE = 1.66;

// Classes: l* are lines, f* flat fills, k a hole. a/b are the holiday's two colours, p is pale light.
const STYLE = `<style>
.d-ctx{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;overflow:hidden;mix-blend-mode:screen;opacity:calc(.92 - var(--quiet,0) * .3)}
.d-ctx .d-la,.d-ctx .d-lb,.d-ctx .d-lp,.d-ctx .d-lw{fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.d-ctx .d-la{stroke:var(--d-a)}.d-ctx .d-lb{stroke:var(--d-b)}.d-ctx .d-lp{stroke:var(--d-p)}.d-ctx .d-lw{stroke:var(--d-w)}
.d-ctx .d-fa{fill:var(--d-a);fill-opacity:.34}.d-ctx .d-fb{fill:var(--d-b);fill-opacity:.34}.d-ctx .d-fp{fill:var(--d-p);fill-opacity:.3}.d-ctx .d-fw{fill:var(--d-w);fill-opacity:.26}
.d-ctx .d-ga{fill:var(--d-a)}.d-ctx .d-gb{fill:var(--d-b)}.d-ctx .d-gp{fill:var(--d-p)}
.d-ctx .d-k{fill:#000}
.d-bob,.d-sway,.d-spin,.d-fall,.d-flick,.d-drift{transform-box:fill-box}
.memory.playing .d-bob{animation:d-bob calc(var(--dwell,6s) * .9) ease-in-out infinite alternate}
.memory.playing .d-sway{transform-origin:50% 0;animation:d-sway calc(var(--dwell,6s) * 1.1) ease-in-out infinite alternate}
.memory.playing .d-spin{transform-origin:50% 50%;animation:d-spin calc(var(--dwell,6s) * 9) linear infinite}
.memory.playing .d-drop{animation:d-drop calc(var(--dwell,6s) * .45) linear infinite}
.memory.playing .d-fall{animation:d-fall calc(var(--dwell,6s) * 1.6) linear infinite}
.memory.playing .d-flick{transform-origin:50% 100%;animation:d-flick .8s ease-in-out infinite alternate}
.memory.playing .d-drift{animation:d-drift calc(var(--dwell,6s) * 2.5) ease-in-out infinite alternate}
.memory.playing .d-flash{animation:d-flash calc(var(--dwell,6s) * 1.4) linear infinite}
@keyframes d-bob{to{transform:translateY(calc(-6px + var(--quiet,0) * 4px))}}
@keyframes d-sway{from{transform:rotate(calc(-5deg + var(--quiet,0) * 3deg))}to{transform:rotate(calc(5deg - var(--quiet,0) * 3deg))}}
@keyframes d-spin{to{transform:rotate(360deg)}}
@keyframes d-drop{to{stroke-dashoffset:-44}}
@keyframes d-fall{from{transform:translateY(-8px);opacity:0}20%{opacity:1}80%{opacity:1}to{transform:translateY(26px);opacity:0}}
@keyframes d-flick{from{opacity:.65;transform:scale(.92,.86)}to{opacity:1;transform:scale(1.04,1.08)}}
@keyframes d-drift{to{transform:translateX(calc(14px - var(--quiet,0) * 8px))}}
@keyframes d-flash{0%,64%,72%,100%{opacity:.35}66%,70%{opacity:1}}
@media(prefers-reduced-motion:reduce){.d-ctx *,.d-page *{animation:none!important}}
</style>`;

// The colours of a holiday, leaned toward the accent of the day so the signs belong to its scene.
const mix = (colour, share = 70) => `color-mix(in oklab,${colour} ${share}%,var(--scene-accent,#fff))`;
const PALETTE = {
  halloween: ['hsl(28 92% 62%)', 'hsl(268 40% 84%)'],
  newyear: ['hsl(152 42% 64%)', 'hsl(46 95% 72%)'],
  birthday: ['hsl(338 85% 74%)', 'hsl(46 95% 70%)'],
  nauryz: ['hsl(46 92% 66%)', 'hsl(352 78% 70%)'],
  none: ['hsl(44 95% 70%)', 'hsl(205 70% 82%)']
};

// ---------------------------------------------------------------------------
// Glyphs, each in a box from -50 to 50.
const flake = (r, cls = 'd-lp', w = 1.5) => [0, 60, 120].map(angle =>
  `<g transform="rotate(${angle})"><line class="${cls}" x1="0" y1="${-r}" x2="0" y2="${r}" stroke-width="${w}"/>` +
  `<path class="${cls}" stroke-width="${w}" d="M${f1(-r * .28)} ${f1(-r * .82)}L0 ${f1(-r * .55)}L${f1(r * .28)} ${f1(-r * .82)}M${f1(-r * .28)} ${f1(r * .82)}L0 ${f1(r * .55)}L${f1(r * .28)} ${f1(r * .82)}"/></g>`).join('');
const CLOUD = 'M-30 12A11 11 0 0 1-26-8A15 15 0 0 1 2-18A13 13 0 0 1 24-6A10 10 0 0 1 32 12Z';
const cloud = (dark = false) => `<path class="${dark ? 'd-fw' : 'd-fp'}" d="${CLOUD}"/><path class="d-lp" d="${CLOUD}"/>` +
  (dark ? '<path class="d-lp" stroke-width="1" d="M-18 4Q-4-2 12 3"/>' : '');
const rays = (inner, outer, count, wavy) => Array.from({length: count}, (_, i) => {
  const a = i * 2 * Math.PI / count, o = i % 2 ? outer * .82 : outer;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  if (!wavy) return `<line class="d-la" x1="${f1(c * inner)}" y1="${f1(s * inner)}" x2="${f1(c * o)}" y2="${f1(s * o)}"/>`;
  const m = (inner + o) / 2, n = 3;
  return `<path class="d-la" d="M${f1(c * inner)} ${f1(s * inner)}Q${f1(c * m - s * n)} ${f1(s * m + c * n)} ${f1(c * o)} ${f1(s * o)}"/>`;
}).join('');

const GLYPHS = {
  // Halloween
  pumpkin: () => `<g class="d-bob"><path class="d-fa" d="M0-14C-30-18-38 4-30 18C-24 30-10 30 0 26C10 30 24 30 30 18C38 4 30-18 0-14Z"/>
    <path class="d-la" d="M0-14C-30-18-38 4-30 18C-24 30-10 30 0 26C10 30 24 30 30 18C38 4 30-18 0-14Z"/>
    <path class="d-la" stroke-width="1.1" d="M0-14C-12-12-14 18 0 26C14 18 12-12 0-14M-14-13C-26-4-24 22-12 28M14-13C26-4 24 22 12 28"/>
    <path class="d-k" d="M-14 0l6-7 6 7zM2 0l6-7 6 7zM-12 12l4 4 4-4 4 4 4-4 4 4 4-4c-4 8-20 8-24 0z"/>
    <path class="d-lb" d="M0-14C0-20 2-26 7-29M3-24c6-6 14-4 15 2"/></g>`,
  ghost: () => `<g class="d-bob"><path class="d-fb" d="M-20 30V-4A20 20 0 0 1 20-4V30L13 23 7 30 0 23-7 30-13 23Z"/>
    <path class="d-lb" d="M-20 30V-4A20 20 0 0 1 20-4V30L13 23 7 30 0 23-7 30-13 23Z"/>
    <ellipse class="d-k" cx="-7" cy="-4" rx="3.4" ry="5"/><ellipse class="d-k" cx="7" cy="-4" rx="3.4" ry="5"/><ellipse class="d-k" cx="0" cy="9" rx="3" ry="4"/>
    <path class="d-lb" stroke-width="1.2" d="M-20 6c-8 2-12-2-14-8M20 6c8 2 12-2 14-8"/></g>`,
  bat: () => `<g class="d-bob"><path class="d-fb" style="fill-opacity:.5" d="M0-6C-4-12-14-14-30-8C-24-4-24 2-26 8C-20 4-14 4-12 9C-8 4-4 4 0 8C4 4 8 4 12 9C14 4 20 4 26 8C24 2 24-4 30-8C14-14 4-12 0-6Z"/>
    <path class="d-lb" d="M0-6C-4-12-14-14-30-8C-24-4-24 2-26 8C-20 4-14 4-12 9C-8 4-4 4 0 8C4 4 8 4 12 9C14 4 20 4 26 8C24 2 24-4 30-8C14-14 4-12 0-6ZM-3-8l-1-6 3 3 2 0 3-3-1 6"/></g>`,
  skull: () => `<g class="d-sway"><path class="d-fp" d="M-18-6A18 18 0 0 1 18-6C18 4 14 8 12 10V18H-12V10C-14 8-18 4-18-6Z"/>
    <path class="d-lp" d="M-18-6A18 18 0 0 1 18-6C18 4 14 8 12 10V18H-12V10C-14 8-18 4-18-6ZM-6 12V18M0 12V18M6 12V18"/>
    <circle class="d-k" cx="-7" cy="-4" r="5"/><circle class="d-k" cx="7" cy="-4" r="5"/><path class="d-k" d="M0 3l-3 5h6z"/>
    <path class="d-la" stroke-width="1.2" d="M-26 30L26 22M-26 22L26 30"/></g>`,
  spider: () => `<g class="d-sway"><line class="d-lp" stroke-width="1" x1="0" y1="-50" x2="0" y2="6"/><ellipse class="d-gp" cx="0" cy="12" rx="5" ry="6" opacity=".8"/>
    <path class="d-lp" stroke-width="1.2" d="M-4 9l-9-6-3-6M-4 12l-11 0-4 4M-4 15l-9 6-2 6M4 9l9-6 3-6M4 12l11 0 4 4M4 15l9 6 2 6"/></g>`,
  web: () => {
    const spokes = [8, 26, 46, 66, 84].map(d => d * Math.PI / 180);
    const at = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
    let path = spokes.map(a => { const [x, y] = at(a, 98); return `M0 0L${f1(x)} ${f1(y)}`; }).join('');
    for (const r of [24, 44, 64, 84]) {
      path += spokes.slice(1).map((a, i) => {
        const [x0, y0] = at(spokes[i], r), [x1, y1] = at(a, r), [mx, my] = at((a + spokes[i]) / 2, r * .86);
        return `M${f1(x0)} ${f1(y0)}Q${f1(mx)} ${f1(my)} ${f1(x1)} ${f1(y1)}`;
      }).join('');
    }
    return `<path class="d-lp" stroke-width="1" d="${path}"/>`;
  },
  // New Year
  fir: () => `<g class="d-sway"><path class="d-fa" d="M0-40L-14-16H-7L-22 6H-11L-28 30H28L11 6H22L7-16H14Z"/><path class="d-la" d="M0-40L-14-16H-7L-22 6H-11L-28 30H28L11 6H22L7-16H14ZM0 30V40"/>
    <circle class="d-gb" cx="-8" cy="0" r="2.2"/><circle class="d-gb" cx="10" cy="14" r="2.2"/><circle class="d-gb" cx="-12" cy="22" r="2.2"/><circle class="d-gb" cx="3" cy="-18" r="2"/>
    <path class="d-gb" d="M0-49l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L0-36.6-5 -33.8l1.2-5.6-4.2-3.8 5.6-.6z"/></g>`,
  snowflake: () => `<g class="d-spin">${flake(24, 'd-lp', 1.8)}<circle class="d-gp" r="2.4"/></g>`,
  bauble: () => `<g class="d-sway"><line class="d-lp" stroke-width="1" x1="0" y1="-50" x2="0" y2="-12"/><rect class="d-lb" x="-4" y="-12" width="8" height="5" rx="1"/>
    <circle class="d-fb" cx="0" cy="8" r="16"/><circle class="d-lb" cx="0" cy="8" r="16"/><path class="d-lb" stroke-width="1.2" d="M-15 4Q0 10 15 4M-14 13Q0 19 14 13"/>
    <path class="d-gp" opacity=".7" d="M-8 0a9 9 0 0 1 6-5a12 12 0 0 0-4 7z"/></g>`,
  star: () => `<g class="d-spin"><path class="d-fb" d="M0-26l7.6 15.4 17 2.5-12.3 12 2.9 16.9L0 12.8-15.2 20.8l2.9-16.9-12.3-12 17-2.5z"/>
    <path class="d-lb" d="M0-26l7.6 15.4 17 2.5-12.3 12 2.9 16.9L0 12.8-15.2 20.8l2.9-16.9-12.3-12 17-2.5z"/></g>`,
  sparkler: () => `<g><line class="d-lp" x1="-14" y1="34" x2="4" y2="-6"/><g class="d-flick">${rays(4, 26, 16, false).replace(/d-la/g, 'd-lb')}<circle class="d-gp" cx="0" cy="0" r="4"/>
    <circle class="d-gb" cx="-18" cy="-20" r="1.5"/><circle class="d-gb" cx="22" cy="-12" r="1.5"/><circle class="d-gb" cx="12" cy="24" r="1.3"/></g></g>`,
  // Birthday
  balloon: () => `<g class="d-bob"><path class="d-fa" d="M0-38C-16-38-22-24-20-12C-18 2-8 12 0 14C8 12 18 2 20-12C22-24 16-38 0-38Z"/>
    <path class="d-la" d="M0-38C-16-38-22-24-20-12C-18 2-8 12 0 14C8 12 18 2 20-12C22-24 16-38 0-38ZM-3 18H3L0 14Z"/>
    <path class="d-lp" stroke-width="1" d="M0 18C-6 26 6 32 0 40C-4 46 2 50 0 54"/><path class="d-gp" opacity=".6" d="M-11-24a12 12 0 0 1 6-8a14 14 0 0 0-3 10z"/></g>`,
  candle: () => `<g><rect class="d-fa" x="-6" y="-8" width="12" height="44" rx="2"/><rect class="d-la" x="-6" y="-8" width="12" height="44" rx="2"/>
    <path class="d-lb" stroke-width="1.2" d="M-6 2L6-4M-6 14L6 8M-6 26L6 20"/><line class="d-lp" stroke-width="1.2" x1="0" y1="-8" x2="0" y2="-13"/>
    <g class="d-flick"><path class="d-gb" opacity=".85" d="M0-34C5-26 7-20 4-15C2-12-2-12-4-15C-7-20-5-26 0-34Z"/><path class="d-gp" opacity=".8" d="M0-24C2-20 2-17 0-15C-2-17-2-20 0-24Z"/></g>
    <circle class="d-fb" cx="0" cy="-19" r="14" style="fill-opacity:.12"/></g>`,
  confetti: random => Array.from({length: 9}, (_, i) => {
    const x = random() * 80 - 40, y = random() * 80 - 40, r = random() * 180, cls = ['d-ga', 'd-gb', 'd-gp'][i % 3];
    return i % 3 === 2 ? `<path class="${cls.replace('d-g', 'd-l')}" stroke-width="1.4" transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(r)})" d="M-6 0q3-4 6 0t6 0"/>`
      : `<rect class="${cls}" opacity=".8" x="-3" y="-1.6" width="6" height="3.2" transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(r)})"/>`;
  }).join(''),
  // Nauryz. A tulip and a snowdrop are the first flowers of the steppe spring; the shanyrak is
  // the crown of the yurt (a circle crossed by bent laths, with the roof poles around it);
  // қошқар мүйіз is the ram's horn ornament: one stem, two spirals turning outwards.
  tulip: () => `<g class="d-sway"><path class="d-lp" d="M0 44C0 30 1 16 0 2"/><path class="d-fp" d="M0 34C-10 30-16 20-16 10C-8 14-3 22 0 34Z"/><path class="d-lp" stroke-width="1.2" d="M0 34C-10 30-16 20-16 10C-8 14-3 22 0 34Z"/>
    <path class="d-fb" d="M-12-24C-14-10-10 2 0 4C10 2 14-10 12-24L6-16 0-28-6-16Z"/><path class="d-lb" d="M-12-24C-14-10-10 2 0 4C10 2 14-10 12-24L6-16 0-28-6-16ZM0-28C-4-16-4-4 0 4"/></g>`,
  snowdrop: () => `<g class="d-sway"><path class="d-lp" d="M-6 44C-6 10 0-18 16-18"/><path class="d-lp" stroke-width="1.2" d="M-6 40C-14 24-14 10-10-2M-6 40C2 26 4 16 2 8"/>
    <path class="d-fp" d="M16-18C8-14 8 2 16 8C24 2 24-14 16-18Z"/><path class="d-lp" d="M16-18C8-14 8 2 16 8C24 2 24-14 16-18ZM16-18C13-10 13 0 16 8M16-18V-22"/></g>`,
  shanyrak: () => {
    const poles = Array.from({length: 24}, (_, i) => {
      const a = i * Math.PI / 12, [c, s] = [Math.cos(a), Math.sin(a)];
      return `M${f1(c * 33)} ${f1(s * 33)}L${f1(c * 46)} ${f1(s * 46)}`;
    }).join('');
    return `<g class="d-spin" style="animation-duration:calc(var(--dwell,6s) * 24)"><circle class="d-fa" r="30" style="fill-opacity:.12"/><circle class="d-la" r="30" stroke-width="2.2"/><circle class="d-la" r="26" stroke-width="1"/>
      <path class="d-la" stroke-width="1.4" d="M-9-25Q-14 0-9 25M0-26V26M9-25Q14 0 9 25M-25-9Q0-14 25-9M-26 0H26M-25 9Q0 14 25 9"/><path class="d-lp" stroke-width="1" d="${poles}"/></g>`;
  },
  horn: () => {
    const side = `M0 22C0 8-2-2-10-8C-20-15-32-8-30 2C-28 10-18 10-17 3C-16-2-22-4-24 0`;
    return `<g class="d-bob"><path class="d-la" stroke-width="2" d="${side}"/><path class="d-la" stroke-width="2" transform="scale(-1 1)" d="${side}"/>
      <path class="d-lb" stroke-width="1.4" d="M0 22V34M-6 34H6M0 -8C-4-16-4-24 0-30C4-24 4-16 0-8Z"/></g>`;
  },
  altybakan: () => `<g><path class="d-la" d="M-34 36L-22-26L-10 36M10 36L22-26L34 36M-26-24H26"/>
    <g class="d-sway"><path class="d-lp" stroke-width="1.2" d="M-8-24V16M8-24V16"/><path class="d-lb" stroke-width="2.4" d="M-12 16H12"/></g></g>`,
  springsun: () => `<g class="d-spin" style="animation-duration:calc(var(--dwell,6s) * 16)"><circle class="d-fa" r="14"/><circle class="d-la" r="14"/>${rays(19, 30, 12, false)}
    <circle class="d-la" r="36" stroke-width="1" stroke-dasharray="2 6"/></g>`,
  // Weather
  sun: (random, amount, heat) => `<g class="d-spin"><circle class="d-fa" r="${heat ? 17 : 14}"/><circle class="d-la" r="${heat ? 17 : 14}"/>${rays(heat ? 22 : 19, heat ? 38 : 29, heat ? 14 : 12, heat)}</g>`,
  cloud: () => `<g class="d-drift">${cloud()}</g>`,
  suncloud: () => `<g transform="translate(14 -14) scale(.8)"><circle class="d-fa" r="14"/><circle class="d-la" r="14"/>${rays(19, 28, 10, false)}</g><g transform="translate(-6 8)"><g class="d-drift">${cloud()}</g></g>`,
  rain: (random, amount, _, storm) => {
    const count = Math.round(4 + amount * 7), drizzle = amount < .4;
    const drops = Array.from({length: count}, (_, i) => {
      const x = -24 + i * 48 / (count - 1) + random() * 3, o = f1(random() * 44);
      return `<line class="d-lw d-drop" x1="${f1(x)}" y1="16" x2="${f1(x - 7)}" y2="${f1(16 + 32 + amount * 10)}" stroke-width="${drizzle ? 1.2 : 1.5}" stroke-dasharray="${drizzle ? '2 9' : `${f1(6 + amount * 6)} ${f1(38 - amount * 6)}`}" stroke-dashoffset="${o}"/>`;
    }).join('');
    const bolt = storm ? '<path class="d-gp d-flash" d="M6 10L-6 28H2L-6 46L14 22H6L12 10Z"/>' : '';
    return `<g transform="translate(0 -12)">${drops}${bolt}<g class="d-drift">${cloud(storm)}</g></g>`;
  },
  storm: random => GLYPHS.rain(random, .5, false, true),
  snow: (random, amount) => {
    const count = Math.round(3 + amount * 5);
    const flakes = Array.from({length: count}, (_, i) => {
      const x = -24 + i * 48 / Math.max(1, count - 1) + random() * 4, y = 20 + random() * 26;
      return `<g class="d-fall" style="animation-delay:-${f1(random() * 6)}s"><g transform="translate(${f1(x)} ${f1(y)})">${flake(2.8 + random() * 2.2, 'd-lp', 1)}</g></g>`;
    }).join('');
    return `<g transform="translate(0 -12)">${flakes}<g class="d-drift">${cloud()}</g></g>`;
  },
  // Wide signs (box -100 -25 200 50): a gust is a long line that ends in a curl.
  wind: (random, amount) => Array.from({length: amount > .8 ? 3 : 2}, (_, i) => {
    const y = -14 + i * 14, x = -90 + random() * 20, end = 40 + random() * 40;
    return `<g class="d-drift" style="animation-delay:-${f1(i * 1.3)}s"><path class="d-lp" stroke-width="${f1(1.2 + amount * .8)}" d="M${f1(x)} ${y}C${f1(x + 40)} ${y - 5} ${f1(end - 40)} ${y + 5} ${f1(end)} ${y}C${f1(end + 16)} ${y - 2} ${f1(end + 18)} ${y - 14} ${f1(end + 8)} ${y - 15}C${f1(end)} ${y - 15} ${f1(end - 2)} ${y - 8} ${f1(end + 4)} ${y - 7}"/></g>`;
  }).join(''),
  // A corner piece (box 0 0 100 100 from the corner): ice ferns growing in from the edge.
  frost: random => {
    let path = '';
    for (const a of [10, 32, 55, 78]) {
      const r = a * Math.PI / 180, len = 60 + random() * 34, [c, s] = [Math.cos(r), Math.sin(r)];
      path += `M0 0L${f1(c * len)} ${f1(s * len)}`;
      for (let t = 14; t < len - 6; t += 11) {
        const b = 9 * (1 - t / len) + 3, [x, y] = [c * t, s * t];
        path += `M${f1(x)} ${f1(y)}l${f1(Math.cos(r + .7) * b)} ${f1(Math.sin(r + .7) * b)}M${f1(x)} ${f1(y)}l${f1(Math.cos(r - .7) * b)} ${f1(Math.sin(r - .7) * b)}`;
      }
    }
    return `<path class="d-lw" stroke-width="1" d="${path}"/>`;
  }
};

// ---------------------------------------------------------------------------
// Placement. Points are in percent of the scene; the words keep the lower left
// (or the upper left when the scene puts them in the grid) and the dots the lower right.
const SLOTS = {
  scene: {sky: [84, 22, 19], spots: [[60, 12], [73, 9], [93, 40], [90, 63], [66, 30], [54, 7], [79, 46]], size: 16},
  grid: {sky: [90, 22, 14], spots: [[92, 45], [90, 66], [58, 80], [72, 74], [44, 84], [84, 84]], size: 12.5},
  card: {sky: [80, 26, 30], spots: [[50, 22], [88, 66], [28, 18], [64, 52]], size: 21}
};
const KITS = {
  halloween: ['pumpkin', 'ghost', 'bat', 'skull', 'bat', 'spider', 'pumpkin'],
  newyear: ['fir', 'snowflake', 'bauble', 'star', 'sparkler', 'snowflake', 'fir'],
  birthday: ['balloon', 'candle', 'balloon', 'confetti', 'balloon', 'candle', 'confetti'],
  nauryz: ['shanyrak', 'tulip', 'horn', 'snowdrop', 'tulip', 'altybakan', 'snowdrop']
};

const box = (glyph, cx, cy, w, {aspect = 1, view = '-50 -50 100 100', turn = 0} = {}) => {
  // A square sign gets a box wider than tall: on a wide scene the height decides its size,
  // on a tall phone scene the extra width keeps it from shrinking to a speck.
  const h = w * WIDE / aspect, wide = aspect === 1 ? w * 1.45 : w;
  const inner = turn ? `<g transform="rotate(${f1(turn)})">${glyph}</g>` : glyph;
  return `<svg x="${f1(cx - wide / 2)}%" y="${f1(cy - h / 2)}%" width="${f1(wide)}%" height="${f1(h)}%" viewBox="${view}" overflow="visible">${inner}</svg>`;
};
const corner = (glyph, right, w) => `<svg x="${right ? f1(100 - w) : 0}%" y="0" width="${f1(w)}%" height="${f1(w * WIDE)}%" viewBox="0 0 100 100" preserveAspectRatio="${right ? 'xMaxYMin' : 'xMinYMin'} meet" overflow="visible">${right ? `<g transform="translate(100 0) scale(-1 1)">${glyph}</g>` : glyph}</svg>`;

// A string sagging between the given x (percent) along the top, with something hung on it.
function swag(from, to, depth, hang, count, random) {
  const points = [];
  const line = [];
  const loops = 2;
  for (let l = 0; l < loops; l++) {
    const x0 = from + (to - from) * l / loops, x1 = from + (to - from) * (l + 1) / loops;
    line.push(`M${f1(x0)} 2Q${f1((x0 + x1) / 2)} ${f1(2 + depth * 2)} ${f1(x1)} 2`);
    for (let i = 1; i <= count; i++) {
      const t = i / (count + 1);
      points.push([x0 + (x1 - x0) * t, 2 + 2 * depth * t * (1 - t) * 2 * .5 * 2]);
    }
  }
  const string = `<svg x="0" y="0" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" overflow="visible"><path class="d-lp" stroke-width="1" vector-effect="non-scaling-stroke" d="${line.join('')}"/></svg>`;
  return string + points.map(([x, y], i) => hang(x, y, i, random)).join('');
}

// Which sky sign stands in the corner: one figure, the strongest kind of weather.
function skyGlyph(weather, random) {
  const has = kind => weather.find(item => item.kind === kind);
  const amount = kind => has(kind)?.amount ?? 0;
  if (has('storm')) return GLYPHS.rain(random, Math.max(.5, amount('rain')), false, true);
  if (has('rain')) return GLYPHS.rain(random, amount('rain'));
  if (has('snow')) return GLYPHS.snow(random, amount('snow'));
  if (has('sun') && has('clouds')) return GLYPHS.suncloud();
  if (has('clouds')) return GLYPHS.cloud();
  if (has('sun') || has('heat')) return GLYPHS.sun(random, amount('sun'), !!has('heat'));
  return '';
}

export function signsSVG(context, imprint, seed, size = 1) {
  const random = seeded(String(seed) + ':context');
  const f = imprint.feelings || {};
  const card = size < .6;
  const grid = !card && imprint.place === 'grid';
  const slot = SLOTS[card ? 'card' : grid ? 'grid' : 'scene'];
  const weather = context.weather || [];
  const has = kind => weather.find(item => item.kind === kind);
  const occasion = KITS[context.occasion] ? context.occasion : null;
  const parts = [];

  // The sky: in its corner, rain and snow fall from the cloud they came from.
  let sky = skyGlyph(weather, random);
  if (!sky && occasion === 'nauryz') sky = GLYPHS.springsun();
  if (sky) {
    const [x, y, w] = slot.sky;
    parts.push(box(sky, x, y, w));
    // A heavy rain or snow brings a second, smaller cloud.
    const heavy = (has('rain')?.amount ?? 0) > .8 || (has('snow')?.amount ?? 0) > .8 || has('storm');
    if (heavy && !card) parts.push(box(skyGlyph(weather, random), x - (grid ? 4 : 19), y + (grid ? 28 : -2), w * .7));
  }
  // Snow also drifts over the top of the frame, a few flakes per strength.
  if (has('snow') && !card) {
    const count = Math.round(4 + has('snow').amount * 8);
    for (let i = 0; i < count; i++) {
      const x = grid ? 76 + random() * 22 : 36 + random() * 62, y = grid ? 30 + random() * 50 : 4 + random() * 34;
      parts.push(box(`<g class="d-fall" style="animation-delay:-${f1(random() * 8)}s">${flake(30 + random() * 12, 'd-lp', 3.4)}</g>`, x, y, 2.6 + random() * 2));
    }
  }
  if (has('wind')) {
    const w = card ? 46 : grid ? 22 : 32;
    parts.push(box(GLYPHS.wind(random, has('wind').amount), card ? 46 : grid ? 84 : 69, card ? 46 : grid ? 50 : 15, w, {aspect: 4, view: '-100 -25 200 50'}));
  }
  if (has('fog')) {
    const id = 'd-fog-' + String(seed).replace(/[^\w-]/g, '') + (card ? 'c' : 's');
    const bands = Math.round(2 + has('fog').amount * 3);
    const rows = Array.from({length: bands}, (_, i) => {
      const y = (card ? 30 : 10) + i * (card ? 12 : 7.5) + random() * 3, x = 36 + random() * 24;
      return `<g class="d-drift" style="animation-delay:-${f1(i * 2)}s"><rect x="${f1(x)}%" y="${f1(y)}%" width="${f1(98 - x)}%" height="${f1(card ? 8 : 6)}%" rx="3%" fill="url(#${id})" filter="url(#${id}-soft)"/>
        <line class="d-lp" stroke-width="1" opacity=".5" x1="${f1(x + 12)}%" y1="${f1(y + 2.5)}%" x2="94%" y2="${f1(y + 2.5)}%" stroke-dasharray="40 14 90 22"/></g>`;
    }).join('');
    parts.unshift(`<defs><linearGradient id="${id}"><stop offset="0" stop-color="var(--d-p)" stop-opacity="0"/><stop offset=".35" stop-color="var(--d-p)" stop-opacity="${f1(.22 + has('fog').amount * .3)}"/><stop offset="1" stop-color="var(--d-p)" stop-opacity=".08"/></linearGradient><filter id="${id}-soft" x="-10%" y="-100%" width="120%" height="300%"><feGaussianBlur stdDeviation="${card ? 2 : 5}"/></filter></defs>${rows}`);
  }
  if (has('frost')) parts.push(corner(GLYPHS.frost(random), grid, card ? 24 : 18));

  if (occasion) {
    // Festive days hang more, quiet days fewer; a card shows the two or three clearest.
    let count = card ? 2 + (clamp(f.festive) > .5 ? 1 : 0) - (sky ? 1 : 0)
      : 3 + Math.round(clamp(f.festive) * 3) - (clamp(f.quiet) > .6 ? 1 : 0) - (sky ? 1 : 0);
    count = Math.max(card ? 2 : 2, Math.min(count, slot.spots.length));
    const kit = KITS[occasion];
    const start = Math.floor(random() * 2);
    for (let i = 0; i < count; i++) {
      const [sx, sy] = slot.spots[i];
      const kind = kit[(i + start) % kit.length];
      const w = slot.size * (.85 + random() * .35) * (i === 0 ? 1.15 : 1);
      const turn = ['pumpkin', 'ghost', 'bat', 'star', 'balloon', 'confetti'].includes(kind) ? random() * 24 - 12 : 0;
      parts.push(box(`<g style="animation-delay:-${f1(random() * 5)}s">${GLYPHS[kind](random)}</g>`, sx + random() * 4 - 2, sy + random() * 4 - 2, w, {turn}));
    }
    // Along the top: a garland, a string of pennants, or a cobweb in the free corner.
    if (!card && !grid && occasion === 'newyear') parts.push(swag(34, 100, 8, (x, y, i) =>
      box(`<g class="d-flick" style="animation-delay:-${f1(i * .37)}s"><circle class="${i % 2 ? 'd-ga' : 'd-gb'}" r="9"/><circle class="d-gp" r="4"/><circle class="${i % 2 ? 'd-fa' : 'd-fb'}" r="20" style="fill-opacity:.18"/></g>`, x, y + 1.8, 2.6), 5, random));
    if (!card && !grid && occasion === 'birthday') parts.push(swag(30, 100, 9, (x, y, i) =>
      box(`<path class="${i % 2 ? 'd-fa' : 'd-fb'}" style="fill-opacity:.55" d="M-22-30H22L0 30Z"/><path class="${i % 2 ? 'd-la' : 'd-lb'}" d="M-22-30H22L0 30Z"/>`, x, y + 3.4, 3.6, {turn: (i % 3 - 1) * 6}), 4, random));
    if (occasion === 'halloween' && !has('frost')) parts.push(corner(GLYPHS.web(), grid || card, card ? 30 : 17));
  }
  if (!parts.length) return '';

  const [a, b] = PALETTE[occasion || 'none'];
  const style = `--d-a:${mix(a)};--d-b:${mix(b)};--d-p:color-mix(in oklab,hsl(var(--hue,40) 40% 93%) 85%,var(--scene-accent,#fff));--d-w:${mix('hsl(205 75% 82%)', 78)}`;
  return `<svg class="decor d-ctx" style="${style}" width="100%" height="100%" aria-hidden="true" focusable="false">${STYLE}${parts.join('')}</svg>`;
}

// Falling snow at the sides of an open day's page, never under the words.
export function pageSnow(amount, quiet) {
  const random = seeded('page-snow');
  const flakes = Array.from({length: Math.round(8 + amount * 10)}, (_, i) => {
    const left = i % 2 ? 1 + random() * 9 : 90 + random() * 9;
    const size = 6 + random() * 8, time = 16 + random() * 14 + quiet * 10;
    return `<svg class="d-pf" style="left:${f1(left)}vw;width:${f1(size)}px;height:${f1(size)}px;animation-duration:${f1(time)}s;animation-delay:-${f1(random() * time)}s" viewBox="-10 -10 20 20">${flake(9, 'd-lp', 1.6)}</svg>`;
  }).join('');
  return `<div class="d-page" aria-hidden="true"><style>
.d-page{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden;opacity:.45}
.d-page .d-lp{fill:none;stroke:var(--accent-hi,#fff);stroke-linecap:round}
.d-page .d-pf{position:absolute;top:-20px;animation:d-pagefall linear infinite}
@keyframes d-pagefall{to{transform:translateY(105vh) rotate(160deg)}}
@media(prefers-reduced-motion:reduce){.d-page{display:none}}
</style>${flakes}</div>`;
}
