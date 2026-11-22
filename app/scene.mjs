// Markup for a memory, built only from strings so the page and the exported
// folder draw a day in exactly the same way.
import {FEELINGS, IDS, PAIRS, clamp, feelingName, opposite} from './feelings.mjs';
import {contextRules, contextSVG} from './context.mjs';

export const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export const number = value => Number(value).toFixed(2).replace('.', ',');
const colour = (id, light = 62) => {
  const feeling = FEELINGS.find(item => item.id === id);
  return `hsl(${feeling.hue} ${Math.max(feeling.sat, 38)}% ${light}%)`;
};

export function sceneStyle(imprint) {
  const i = imprint;
  return [
    ...IDS.map(id => `--${id}:${i.feelings[id]}`),
    `--hue:${i.hue}`, `--sat:${i.saturation}%`, `--base:${i.dark}%`, `--wash:${i.wash}`, `--grain:${i.grain}`,
    `--contrast:${i.contrast}`, `--filter-sat:${i.filterSat}`, `--sepia:${i.sepia}`, `--bright:${i.bright}`,
    `--inset:${i.inset}%`, `--radius:${i.radius}px`, `--title-scale:${i.titleScale}`, `--title-weight:${i.titleWeight}`,
    `--title-track:${i.tracking}em`, `--tilt:${i.tilt}deg`, `--fade:${i.fade}s`, `--dwell:${i.duration}s`, `--drift:${i.drift}`,
    `--scene-accent:hsl(${i.accentHue} ${i.accentSat}% ${i.accentLight}%)`
  ].join(';');
}

// Site-wide custom properties. The same call themes the archive (from the
// whole diary) and an open day (from that day alone).
export function themeVars(tokens) {
  const {hue, paperSat: sat, paperLight: base} = tokens;
  const light = shift => Math.round((base + shift) * 100) / 100;
  return {
    '--paper': `hsl(${hue} ${sat}% ${light(0)}%)`,
    '--surface': `hsl(${hue} ${sat}% ${light(4)}%)`,
    '--well': `hsl(${hue} ${sat}% ${Math.max(4, light(-2.5))}%)`,
    '--raise': `hsl(${hue} ${sat + 4}% ${light(8)}%)`,
    // A translucent light line reads as structure on any tinted paper.
    '--edge': `hsl(${hue} ${Math.min(40, sat + 10)}% 86% / .16)`,
    '--text': `hsl(${hue} 22% 93%)`,
    '--muted': `hsl(${hue} 10% 72%)`,
    '--accent': `hsl(${tokens.accentHue} ${tokens.accentSat}% ${tokens.accentLight}%)`,
    '--accent-hi': `hsl(${tokens.accentHue} ${tokens.accentSat}% ${tokens.accentLight + 7}%)`,
    '--on-accent': `hsl(${tokens.accentHue} 35% 11%)`,
    '--glow': `hsl(${hue} ${Math.min(70, sat * 3)}% 42% / ${tokens.glow})`,
    '--lines': String(tokens.lines),
    '--page-grain': String(tokens.pageGrain),
    '--r': `${Math.round(tokens.radius * .55)}px`,
    '--display-weight': String(tokens.titleWeight),
    // Section headings are smaller than a scene title, so they are tightened less.
    '--display-track': `${Math.round(tokens.tracking * 70) / 100}em`,
    '--display-scale': String(Math.round((1 + (tokens.titleScale - 1) * .5) * 100) / 100),
    '--tempo': `${tokens.tempo}s`
  };
}
export const themeStyle = tokens => Object.entries(themeVars(tokens)).map(([name, value]) => `${name}:${value}`).join(';');

// ---------------------------------------------------------------------------
// The treatment of the photograph, as an SVG filter: the sliders redraw it at
// once and the exported folder carries it without any other file.
// `size` is the width of the picture relative to a full scene; a card is about a third.
const TREAT_FROM = .08;
function treatmentSVG(imprint, id, size) {
  const {paint = 0, plane = 0, smear = 0, sweep = 0} = imprint;
  const steps = [];
  let last = 'SourceGraphic';
  const px = value => Math.max(0, value).toFixed(2);
  if (paint >= TREAT_FROM) {
    // Dabs of colour: small details merge into patches, a noise field pushes the patches
    // off their edges, and a soft pass joins them. Solitude and quiet stretch the field
    // and the soft pass along the horizon, so the strokes lie long and level.
    const reach = paint * size;
    const lie = 1 + 2.4 * sweep;
    steps.push(
      `<feTurbulence type="fractalNoise" baseFrequency="${(.08 / lie / size).toFixed(4)} ${(.08 * (1 + .5 * sweep) / size).toFixed(4)}" numOctaves="2" seed="7" result="field"/>`,
      `<feMorphology in="${last}" operator="erode" radius="${px(1.4 * reach)}" result="worn"/>`,
      `<feMorphology in="worn" operator="dilate" radius="${px(1.8 * reach)}" result="dabs"/>`,
      `<feDisplacementMap in="dabs" in2="field" scale="${px(11 * reach)}" xChannelSelector="R" yChannelSelector="G" result="strokes"/>`,
      `<feGaussianBlur in="strokes" stdDeviation="${px((.5 + 2.8 * sweep) * reach)} ${px(.5 * reach)}" result="paint"/>`);
    last = 'paint';
  }
  if (plane >= TREAT_FROM) {
    // Flat planes: harder edges, then each colour falls to the nearest of a few steps.
    const share = (.9 * plane).toFixed(2);
    steps.push(
      `<feConvolveMatrix in="${last}" order="3" kernelMatrix="0 -1 0 -1 5 -1 0 -1 0" preserveAlpha="true" result="edges"/>`,
      `<feComponentTransfer in="edges" result="steps">${['R', 'G', 'B'].map(channel => `<feFunc${channel} type="discrete" tableValues="0 .14 .34 .6 .84 1"/>`).join('')}</feComponentTransfer>`,
      `<feComposite in="steps" in2="${last}" operator="arithmetic" k1="0" k2="${share}" k3="${(1 - share).toFixed(2)}" k4="0" result="plane"/>`);
    last = 'plane';
  }
  if (smear >= TREAT_FROM) {
    // A long exposure: the lights travel sideways, the dark parts stay where they were.
    steps.push(
      `<feGaussianBlur in="${last}" stdDeviation="${px(26 * smear * size)} 0" result="trail"/>`,
      `<feBlend in="trail" in2="${last}" mode="lighten" result="smear"/>`);
    last = 'smear';
  }
  if (!steps.length) return '';
  // Strokes pull in the empty space beyond the edge; the untouched frame underneath fills it.
  return `<svg class="treat" width="0" height="0" aria-hidden="true" focusable="false"><filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">${steps.join('')}<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="${last}"/></feMerge></filter></svg>`;
}

// One picture can stand on a page three times (hero, card, scene), so each place has its own filter.
export function treatment(imprint, key, size = 1) {
  const id = 'treat-' + String(key).replace(/[^\w-]/g, '');
  const svg = treatmentSVG(imprint, id, size);
  return {svg, style: svg ? `;--treat:url(#${id})` : '', attr: svg ? ' data-treat' : ''};
}

// ---------------------------------------------------------------------------
// The imprint: eight spokes, opposite feelings on opposite sides of the wheel.
const spoke = (index, radius) => {
  const angle = (index * 45 - 90) * Math.PI / 180;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
};
const point = ([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`;

export function stampSVG(feelings, {labels = false, title = ''} = {}) {
  const points = IDS.map((id, index) => spoke(index, 9 + 37 * clamp(feelings[id])));
  let path = `M${point(points[0])}`;
  for (let index = 0; index < 8; index++) {
    const [before, from, to, after] = [-1, 0, 1, 2].map(step => points[(index + step + 8) % 8]);
    const first = [from[0] + (to[0] - before[0]) / 6, from[1] + (to[1] - before[1]) / 6];
    const second = [to[0] - (after[0] - from[0]) / 6, to[1] - (after[1] - from[1]) / 6];
    path += `C${point(first)} ${point(second)} ${point(to)}`;
  }
  const axes = [0, 1, 2, 3].map(index => {
    const [x, y] = spoke(index, 46);
    return `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(-x).toFixed(1)}" y2="${(-y).toFixed(1)}"/>`;
  }).join('');
  // Name above, number below it in the serif used for everything the author owns.
  const captions = labels ? IDS.map((id, index) => {
    const [x, y] = spoke(index, 56);
    const upright = Math.abs(x) < 4;
    const anchor = upright ? 'middle' : x > 0 ? 'start' : 'end';
    const top = (y + (upright ? (y < 0 ? -9 : 6) : -2)).toFixed(1);
    return `<text x="${x.toFixed(1)}" y="${top}" text-anchor="${anchor}">${feelingName(id)}<tspan class="num" x="${x.toFixed(1)}" dy="11">${number(feelings[id])}</tspan></text>`;
  }).join('') : '';
  const box = labels ? '-104 -76 208 154' : '-50 -50 100 100';
  return `<svg class="stamp${labels ? ' labelled' : ''}" viewBox="${box}" role="img" aria-label="${escape(title || 'Оттиск настроения')}">
    <g class="guide"><circle r="46"/>${axes}</g><path class="shape" d="${path}Z"/>${captions}</svg>`;
}

// ---------------------------------------------------------------------------
// Generative layer. The amount of every figure is one of the numbers.
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
const fixed = value => value.toFixed(1);

const figures = {
  joy(amount, random) {
    return Array.from({length: Math.round(4 + amount * 12)}, () =>
      `<circle cx="${fixed(random() * 1000)}" cy="${fixed(random() * 360)}" r="${fixed(3 + random() * 7)}" opacity="${fixed(.25 + random() * .4)}"/>`).join('');
  },
  festive(amount, random) {
    return Array.from({length: Math.round(3 + amount * 9)}, (_, index) => {
      const x = random() * 1300 - 300;
      const dash = 90 + random() * 200;
      const offset = fixed(random() * 900);
      // --o lets the playing animation continue each streak from where it rests.
      return `<line x1="${fixed(x)}" y1="640" x2="${fixed(x + 420)}" y2="-40" stroke-width="${fixed(2 + random() * 5)}"
        stroke-dasharray="${fixed(dash)} ${fixed(900 - dash)}" stroke-dashoffset="${offset}" style="--o:${offset}" class="${index % 2 ? 'alt' : ''}" opacity="${fixed(.28 + random() * .3)}"/>`;
    }).join('');
  },
  tension(amount, random) {
    const columns = 4 + Math.round(amount * 6);
    const rows = 3 + Math.round(amount * 4);
    const grid = Array.from({length: columns - 1}, (_, index) => `<line x1="${fixed((index + 1) * 1000 / columns)}" y1="0" x2="${fixed((index + 1) * 1000 / columns)}" y2="600"/>`).join('')
      + Array.from({length: rows - 1}, (_, index) => `<line x1="0" y1="${fixed((index + 1) * 600 / rows)}" x2="1000" y2="${fixed((index + 1) * 600 / rows)}"/>`).join('');
    const x = 560 + random() * 300;
    const y = 90 + random() * 200;
    const size = 50 + amount * 110;
    const marks = [
      `<rect class="mark" x="${fixed(x - size * 1.6)}" y="${fixed(y + size * .9)}" width="${fixed(size * 3.2)}" height="${fixed(6 + amount * 10)}" transform="rotate(${fixed(-18 - random() * 24)} ${fixed(x)} ${fixed(y)})"/>`,
      `<circle class="ring" cx="${fixed(x)}" cy="${fixed(y)}" r="${fixed(size * .7)}"/>`,
      `<path class="mark" d="M${fixed(x + size)} ${fixed(y - size * .2)}l${fixed(size * .8)} ${fixed(size * 1.3)}h${fixed(-size * 1.6)}z"/>`
    ].slice(0, Math.max(1, Math.round(amount * 3)));
    return `<g class="lattice" opacity="${fixed(.1 + amount * .14)}">${grid}</g>${marks.join('')}`;
  },
  solitude(amount, random) {
    const y = 600 * (.4 + random() * .2);
    return `<line x1="0" y1="${fixed(y)}" x2="1000" y2="${fixed(y)}" opacity="${fixed(.2 + amount * .3)}"/>
      <circle cx="${fixed(180 + random() * 640)}" cy="${fixed(y - 50 - random() * 110)}" r="${fixed(4 + amount * 7)}" opacity="${fixed(.3 + amount * .35)}"/>`;
  },
  sadness(amount, random) {
    return Array.from({length: Math.round(8 + amount * 26)}, () => {
      const x = random() * 1000;
      const drop = 30 + random() * 70;
      const offset = fixed(random() * 640);
      return `<line x1="${fixed(x)}" y1="-20" x2="${fixed(x - 14)}" y2="620" stroke-dasharray="${fixed(drop)} ${fixed(640 - drop)}"
        stroke-dashoffset="${offset}" style="--o:${offset}" opacity="${fixed(.14 + random() * .2)}"/>`;
    }).join('');
  },
  calm(amount, random) {
    const x = 250 + random() * 500;
    const y = 400 + random() * 120;
    return Array.from({length: 2 + Math.round(amount * 3)}, (_, index) =>
      `<ellipse cx="${fixed(x)}" cy="${fixed(y)}" rx="${fixed(120 + index * 110)}" ry="${fixed(34 + index * 30)}" opacity="${fixed(.3 - index * .045)}"/>`).join('');
  },
  warmth(amount, random) {
    return Array.from({length: Math.round(3 + amount * 6)}, (_, index) =>
      `<circle cx="${fixed(random() * 1000)}" cy="${fixed(random() * 600)}" r="${fixed(30 + random() * 80)}" class="${index % 2 ? 'alt' : ''}" opacity="${fixed(.1 + random() * .12)}"/>`).join('');
  }
};

export function motifSVG(imprint, seed) {
  const f = imprint.feelings;
  // Within a pair the stronger side takes the figures; only the three clearest feelings draw.
  const drawn = IDS.filter(id => figures[id])
    .map(id => ({id, amount: clamp(f[id] - .6 * f[opposite(id)])}))
    .filter(item => item.amount >= .2)
    .sort((a, b) => b.amount - a.amount).slice(0, 3);
  const random = seeded(seed);
  // Several scenes can share a page, so the blur filter needs its own id in each.
  const blur = 'soft-' + String(seed).replace(/[^\w-]/g, '');
  const groups = drawn.map(({id, amount}, index) => {
    const share = amount * [1, .7, .45][index];
    const soften = id === 'warmth' ? ` filter="url(#${blur})"` : '';
    return `<g class="m-${id}"${soften}>${figures[id](share, random)}</g>`;
  }).join('');
  return `<svg class="motif" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <defs><filter id="${blur}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter></defs>${groups}</svg>`;
}

export const layersHTML = (imprint, seed, {motif = true} = {}) =>
  `<div class="wash"></div><div class="leak"></div>${motif ? motifSVG(imprint, seed) + contextSVG(imprint.context, imprint, seed) : ''}<div class="scrim"></div><div class="grain"></div>`;

export function sceneHTML(day, sources, dateText, heading = 'h1') {
  const i = day.imprint;
  const frames = sources.map((source, index) => `<img class="frame${index ? '' : ' visible'}" src="${escape(source)}" alt="">`).join('');
  const dots = sources.length > 1 ? `<div class="positions" aria-label="Кадры">${sources.map((_, index) =>
    `<button class="dot" type="button" data-index="${index}" aria-label="Кадр ${index + 1}" aria-pressed="${index === 0}"></button>`).join('')}</div>` : '';
  const treat = treatment(i, 's-' + day.id);
  return `<section class="memory" data-face="${i.face}" data-place="${i.place}" data-duration="${i.duration}"${treat.attr} style="${sceneStyle(i)}${treat.style}">
    ${treat.svg}<div class="frames" aria-hidden="true">${frames}</div>${layersHTML(i, day.id)}
    <div class="scene-text"><time datetime="${escape(day.date)}">${escape(dateText)}</time><${heading} id="day-heading">${escape(i.title)}</${heading}><p>${escape(i.excerpt)}</p></div>${dots}
  </section>`;
}

// ---------------------------------------------------------------------------
// The numbers, shown as four tugs of war.
function shift(now, before) {
  if (before == null) return '';
  const change = now - before;
  if (Math.abs(change) < .015) return '';
  return `<span class="delta ${change > 0 ? 'up' : 'down'}">${change > 0 ? '↑' : '↓'} ${number(Math.abs(change))}</span>`;
}

export function pairsHTML(feelings, previous) {
  return `<div class="pairs">${PAIRS.map(pair => {
    const a = feelings[pair.a];
    const b = feelings[pair.b];
    const lean = a - b;
    const note = Math.abs(lean) < .12 ? (a + b < .3 ? 'без сдвига' : 'обе стороны слышны, ни одна не глушит другую')
      : lean > 0 ? pair.more : pair.less;
    return `<div class="pair">
      <span class="pole">${shift(a, previous?.[pair.a])}<span>${feelingName(pair.a)}</span><b>${number(a)}</b></span>
      <span class="meter" aria-hidden="true"><i class="to-a" style="--v:${a};--c:${colour(pair.a)}"></i><i class="to-b" style="--v:${b};--c:${colour(pair.b)}"></i></span>
      <span class="pole end"><b>${number(b)}</b><span>${feelingName(pair.b)}</span>${shift(b, previous?.[pair.b])}</span>
      <small>${pair.layer}: ${note}.</small>
    </div>`;
  }).join('')}</div>`;
}

export function tuneHTML(feelings) {
  const row = id => `<label>${feelingName(id)}<input type="range" min="0" max="1" step="0.01" name="${id}" value="${feelings[id]}"><output>${number(feelings[id])}</output></label>`;
  return `<details class="tune"><summary>Поправить числа</summary>
    <p class="hint">Если день прочитан не так, подвиньте числа. Сцена и оформление сайта изменятся сразу.</p>
    <div class="tune-grid">${PAIRS.map(pair => row(pair.a) + row(pair.b)).join('')}</div></details>`;
}

// What the numbers did to this scene, in the diary's own words.
export function rulesHTML(imprint) {
  const f = imprint.feelings;
  const rules = [];
  const say = (id, text) => { if (f[id] >= .3) rules.push([id, text]); };
  say('joy', 'кадр светлее, цвета насыщеннее');
  say('sadness', 'кадр темнее и глуше, по краям тень');
  const shown = value => value >= TREAT_FROM;
  say('calm', 'мягкие углы, длинные растворения' + (!shown(imprint.paint) ? '' : imprint.sweep >= .45 ? ', кадр ложится длинными ровными мазками' : ', кадр распадается на короткие мазки'));
  say('tension', (imprint.face === 'grotesk' ? 'сетка, рубленый заголовок, резкие склейки' : 'контраст выше, углы острее') + (shown(imprint.plane) ? ', кадр собран в плоскости цвета' : ''));
  say('festive', 'световые следы, крупный заголовок, быстрый ритм' + (shown(imprint.smear) ? ', свет на кадре тянется, как при длинной выдержке' : ''));
  say('quiet', 'мало движения, заголовок меньше, графика приглушена');
  say('warmth', 'тёплая засветка и плёночное зерно');
  say('solitude', 'поля вокруг кадра, линия горизонта, холоднее цвет');
  // What the entry is about (a holiday, the weather) is listed after what it felt like.
  const signs = contextRules(imprint.context).map(rule => `<li><b>${escape(rule.label)}</b> ${escape(rule.text)}</li>`).join('');
  if (!rules.length && !signs) return '<p class="hint">Ярких чувств в записи не нашлось, поэтому сцена оформлена нейтрально.</p>';
  return `<ul class="rules">${rules.sort((a, b) => f[b[0]] - f[a[0]]).map(([id, text]) =>
    `<li><b>${feelingName(id)} ${number(f[id])}</b> ${text}</li>`).join('')}${signs}</ul>`;
}
