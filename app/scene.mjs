import {language, storyLanguage, t} from './i18n.mjs';
// Markup for a memory, built only from strings so the page and the exported
// folder draw a day in exactly the same way.
import {FEELINGS, IDS, PAIRS, clamp, feelingLabel, feelingName, motionTokens, opposite} from './feelings.mjs';
import {contextRules, contextSVG} from './context.mjs';

export const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export const number = value => Number(value).toFixed(2).replace('.', language === 'en' ? '.' : ',');
const colour = (id, light = 62) => {
  const feeling = FEELINGS.find(item => item.id === id);
  return `hsl(${feeling.hue} ${Math.max(feeling.sat, 38)}% ${light}%)`;
};

// How things move, as custom properties. A scene carries its own day's motion, the
// site carries the diary's (or the open day's); both come from motionTokens.
// A browser without linear() easing gets the nearest ordinary curve.
const SPRINGS = typeof CSS === 'undefined' || !CSS.supports || CSS.supports('animation-timing-function', 'linear(0, 1)');
export function motionVars(motion) {
  const m = motion;
  const spring = SPRINGS ? m.easing
    : m.bounce >= .02 ? 'cubic-bezier(.3,1.45,.5,1)' : m.ratio >= 1.15 ? 'cubic-bezier(.16,1,.3,1)' : 'cubic-bezier(.2,.8,.2,1)';
  return {
    '--spring': spring, '--settle': `${m.settle}s`, '--quick': `${m.quick}s`, '--step': `${m.step}s`,
    '--rise': `${m.rise}px`, '--slide': `${-m.slide}px`, '--grow': String(m.grow), '--soft': `${m.soft}px`,
    '--wipe': m.wipe ? '104%' : '-20%', '--title-ghost': m.wipe ? '1' : '0',
    '--hover-zoom': String(m.hoverZoom), '--hover-time': `${m.hoverTime}s`, '--press': `${m.pressDepth}px`,
    '--cam-back': String(m.camBack), '--cam-y': `${m.camY}%`, '--cam-pad': String(m.camPad), '--cam-ease': m.camEase,
    '--ambient': `${m.ambient}s`, '--swell': String(m.swell),
    '--pace': String(m.pace), '--sway': `${m.sway}px`, '--air-ease': m.airEase
  };
}

export function sceneStyle(imprint) {
  const i = imprint;
  return [
    ...Object.entries(motionVars(motionTokens(i.feelings))).map(([name, value]) => `${name}:${value}`),
    ...IDS.map(id => `--${id}:${i.feelings[id]}`),
    `--hue:${i.hue}`, `--sat:${i.saturation}%`, `--base:${i.dark}%`, `--wash:${i.wash}`, `--grain:${i.grain}`,
    `--contrast:${i.contrast}`, `--filter-sat:${i.filterSat}`, `--sepia:${i.sepia}`, `--bright:${i.bright}`, `--matte:${i.matte ?? 0}`,
    `--inset:${i.inset}%`, `--radius:${i.radius}px`, `--title-scale:${i.titleScale}`, `--title-weight:${i.titleWeight}`,
    `--title-track:${i.tracking}em`, `--tilt:${i.tilt}deg`, `--fade:${i.fade}s`, `--dwell:${i.duration}s`, `--drift:${i.drift}`,
    `--scene-accent:hsl(${i.accentHue} ${i.accentSat}% ${i.accentLight}%)`
  ].join(';');
}

// Site-wide custom properties. The same call themes the archive (from the
// whole diary) and an open day (from that day alone).
export function themeVars(tokens) {
  const {hue, paperSat: sat, paperLight: base} = tokens;
  // A print day is set on light paper in dark ink; the same properties, the other way round.
  const day = Boolean(tokens.light);
  const light = shift => Math.min(100, Math.round((day ? 93 + shift * .9 : base + shift) * 100) / 100);
  const ink = day ? {
    '--edge': `hsl(${hue} 25% 18% / ${(tokens.edge ?? .16) + .05})`,
    '--text': `hsl(${hue} 30% 13%)`,
    '--muted': `hsl(${hue} 14% 34%)`,
    '--accent': `hsl(${tokens.accentHue} ${Math.min(62, tokens.accentSat)}% 33%)`,
    '--accent-hi': `hsl(${tokens.accentHue} ${Math.min(62, tokens.accentSat)}% 27%)`,
    '--on-accent': `hsl(${tokens.accentHue} 40% 96%)`,
    '--glow': `hsl(${hue} 85% 72% / ${tokens.glow})`,
    '--vignette': '0', '--line-ink': '0 0% 0%', '--grain-blend': 'multiply', '--danger': 'hsl(16 72% 36%)', '--shadow': '#0003', 'color-scheme': 'light'
  } : {'--line-ink': '0 0% 100%', '--grain-blend': 'screen', '--danger': '#ffd0ab', '--shadow': '#0008', 'color-scheme': 'dark'};
  return {
    '--paper': `hsl(${hue} ${sat}% ${light(0)}%)`,
    '--surface': `hsl(${hue} ${sat}% ${light(4)}%)`,
    '--well': `hsl(${hue} ${sat}% ${day ? light(-5) : Math.max(4, light(-2.5))}%)`,
    '--raise': `hsl(${hue} ${sat + 4}% ${light(8)}%)`,
    // A translucent light line reads as structure on any tinted paper.
    '--edge': `hsl(${hue} ${Math.min(40, sat + 10)}% 86% / ${tokens.edge ?? .16})`,
    '--text': `hsl(${hue} 22% ${tokens.textLight ?? 93}%)`,
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
    '--tempo': `${tokens.tempo}s`,
    '--air': String(tokens.air ?? 1),
    '--glow-x': `${tokens.glowX ?? 85}%`,
    '--glow-y': `${tokens.glowY ?? -10}%`,
    '--vignette': String(tokens.vignette ?? 0),
    '--leading': String(tokens.leading ?? 1.7),
    '--measure': `${tokens.measure ?? 62}ch`,
    ...(tokens.motion ? motionVars(tokens.motion) : {}),
    ...ink
  };
}

// The composition of a scene, in the diary's own words.
const PLACES = {
  base: 'Слова лежат на кадре, слева внизу: ровный или тёплый день держится за фотографию.',
  grid: 'Слова вверху, у акцентной полосы и по сетке: напряжение выше половины.',
  burst: 'Заголовок крупный, по центру и с наклоном: праздник выше 0,55.',
  low: 'Кадр обрезан и уходит в темноту, слова в дальнем нижнем углу: день ведёт грусть.',
  air: 'Небольшой кадр в широких полях, подпись под ним: уединение или тишина.',
  print: 'Светлый отпечаток с подписью на нижнем поле, и вся страница светлая: день ведёт радость, а кадр не ночной.'
};
export const placeLine = imprint => t(PLACES[imprint.place] || PLACES.base);
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
  return `<svg class="stamp${labels ? ' labelled' : ''}" viewBox="${box}" role="img" aria-label="${escape(title || t('Оттиск настроения'))}">
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

const phaseLabels = ['В начале дня', 'В конце дня'];
const phaseNames = ['start', 'end'];

export function momentLine(imprint) {
  if (!imprint.moments) return '';
  const [first, last] = imprint.moments.map(moment => feelingLabel(moment.feelings));
  return t`Смена настроения: ${first} → ${last}.`;
}

function appearance(imprint, id, phase) {
  const moment = imprint.moments?.[phase];
  const i = moment ?? imprint;
  const key = moment ? id + '-' + phaseNames[phase] : id;
  const treat = treatment(i, 's-' + key);
  return {
    attrs: `data-face="${i.face}" data-place="${i.place}" data-duration="${i.duration}"${treat.attr}${moment ? ` data-moment="${phaseNames[phase]}" data-moment-label="${escape(t(phaseLabels[phase]))}"` : ''} style="${sceneStyle(i)}${treat.style}"`,
    svg: treat.svg + motifSVG(i, key),
  };
}

function appearanceTemplates(imprint, id, first) {
  const templates = imprint.moments ? [first, appearance(imprint, id, 1)] : [first];
  return templates.map(({attrs, svg}, index) => `<template data-scene-moment="${index}" ${attrs}>${svg}</template>`).join('');
}

// This function is also embedded in the downloadable scene. Its templates carry
// the same rendered styles and figures as the version in the diary.
export function applySceneMoment(scene, index, count) {
  const first = scene.querySelector('template[data-scene-moment="0"]');
  const last = scene.querySelector('template[data-scene-moment="1"]');
  const view = last && index >= Math.ceil(count / 2) ? last : first;
  if (scene.dataset.activeMoment === view.dataset.sceneMoment) return;
  scene.dataset.activeMoment = view.dataset.sceneMoment;
  scene.dataset.face = view.dataset.face;
  scene.dataset.place = view.dataset.place;
  scene.dataset.duration = view.dataset.duration;
  if (view.dataset.moment) scene.dataset.moment = view.dataset.moment;
  else delete scene.dataset.moment;
  const label = scene.querySelector('.moment-label');
  if (label) label.textContent = view.dataset.momentLabel;
  scene.toggleAttribute('data-treat', view.hasAttribute('data-treat'));
  const band = scene.style.getPropertyValue('--band');
  scene.style.cssText = view.style.cssText;
  if (band) scene.style.setProperty('--band', band);
  scene.querySelector(':scope > .treat')?.remove();
  scene.querySelector(':scope > .motif').remove();
  scene.prepend(view.content.cloneNode(true));
}

export function refreshSceneMoments(scene, day, index, count) {
  scene.querySelectorAll('template[data-scene-moment]').forEach(template => template.remove());
  scene.insertAdjacentHTML('beforeend', appearanceTemplates(day.imprint, day.id, appearance(day.imprint, day.id, 0)));
  delete scene.dataset.activeMoment;
  applySceneMoment(scene, index, count);
}

export function sceneHTML(day, sources, dateText, heading = 'h1') {
  const i = day.imprint;
  const images = i.moments && sources.length === 1 ? [sources[0], sources[0]] : sources;
  const frames = images.map((source, index) => `<img class="frame${index ? '' : ' visible'}" src="${escape(source)}" alt="">`).join('');
  const dots = images.length > 1 ? `<div class="positions" aria-label="${t(i.moments ? 'Смена настроения' : 'Кадры')}">${images.map((_, index) => {
    const frame = t`Кадр ${index + 1}`;
    const phase = i.moments ? t(phaseLabels[Number(index >= Math.ceil(images.length / 2))]) : '';
    return `<button class="dot" type="button" data-index="${index}" aria-label="${escape(phase ? `${phase} · ${frame}` : frame)}" aria-pressed="${index === 0}"></button>`;
  }).join('')}</div>` : '';
  const first = appearance(i, day.id, 0);
  return `<section class="memory"${day.participantExample ? ' data-photo-album' : ''} data-active-moment="0" ${first.attrs}>
    ${first.svg}<div class="frames" aria-hidden="true">${frames}</div>${layersHTML(i, day.id, {motif:false})}${contextSVG(i.context, i, day.id)}
    <div class="scene-text"><div class="scene-date"><time datetime="${escape(day.date)}">${escape(dateText)}</time>${i.moments ? `<span class="moment-label">${escape(t(phaseLabels[0]))}</span>` : ''}</div><${heading} id="day-heading">${escape(i.title)}</${heading}><p lang="${storyLanguage(day.story)}">${escape(i.excerpt)}</p></div>${dots}
    ${appearanceTemplates(i, day.id, first)}
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
    const note = Math.abs(lean) < .12 ? (a + b < .3 ? t('без сдвига') : t('обе стороны слышны, ни одна не глушит другую'))
      : lean > 0 ? pair.more : pair.less;
    return `<div class="pair">
      <span class="pole">${shift(a, previous?.[pair.a])}<span>${feelingName(pair.a)}</span><b>${number(a)}</b></span>
      <span class="meter" aria-hidden="true"><i class="to-a" style="--v:${a};--c:${colour(pair.a)}"></i><i class="to-b" style="--v:${b};--c:${colour(pair.b)}"></i></span>
      <span class="pole end"><b>${number(b)}</b><span>${feelingName(pair.b)}</span>${shift(b, previous?.[pair.b])}</span>
      <small>${t(pair.layer)}: ${t(note)}.</small>
    </div>`;
  }).join('')}</div>`;
}

export function tuneHTML(feelings) {
  const row = id => `<label>${feelingName(id)}<input type="range" min="0" max="1" step="0.01" name="${id}" value="${feelings[id]}"><output>${number(feelings[id])}</output></label>`;
  return `<details class="tune"><summary>${t("Поправить числа")}</summary>
    <p class="hint">${t("Если день прочитан не так, подвиньте числа. Сцена и оформление сайта изменятся сразу.")}</p>
    <div class="tune-grid">${PAIRS.map(pair => row(pair.a) + row(pair.b)).join('')}</div></details>`;
}

// What the numbers did to this scene, in the diary's own words.
export function rulesHTML(imprint) {
  const f = imprint.feelings;
  const rules = [];
  const say = (id, text) => { if (f[id] >= .3) rules.push([id, text]); };
  say('joy', t('кадр светлее, цвета насыщеннее'));
  say('sadness', t('кадр темнее и глуше, по краям тень') + ((imprint.matte ?? 0) >= .15 ? t(', тени выцветают в серую дымку, как на старом отпечатке, цвет кадра бледнеет') : ''));
  const shown = value => value >= TREAT_FROM;
  // Calm gives no colour of its own; the line says so only when it would otherwise have given one.
  const plain = imprint.lead === 'calm' || imprint.second === 'calm' ? t(', своего цвета не даёт: сцена в одном цвете, акцент — светлый тон того же цвета') : '';
  say('calm', t('мягкие углы, длинные растворения') + plain + (!shown(imprint.paint) ? '' : imprint.sweep >= .45 ? t(', кадр ложится длинными ровными мазками') : t(', кадр распадается на короткие мазки')));
  say('tension', (imprint.face === 'grotesk' ? t('сетка, рубленый заголовок, резкие склейки') : t('контраст выше, углы острее')) + (shown(imprint.plane) ? t(', кадр собран в плоскости цвета') : ''));
  say('festive', t('световые следы, крупный заголовок, быстрый ритм') + (shown(imprint.smear) ? t(', свет на кадре тянется, как при длинной выдержке') : ''));
  say('quiet', t('мало движения, заголовок меньше, графика приглушена'));
  say('warmth', t('тёплая засветка и плёночное зерно'));
  say('solitude', t('поля вокруг кадра, линия горизонта, цвет кадра уходит в холодный воздух, как у дальних гор'));
  // What the entry is about (a holiday, the weather) is listed after what it felt like.
  const signs = contextRules(imprint.context).map(rule => `<li><b>${escape(rule.label)}</b> ${escape(rule.text)}</li>`).join('');
  if (!rules.length && !signs) return `<p class="hint">${t("Ярких чувств в записи не нашлось, поэтому сцена оформлена нейтрально.")}</p>`;
  return `<ul class="rules">${rules.sort((a, b) => f[b[0]] - f[a[0]]).map(([id, text]) =>
    `<li><b>${feelingName(id)} ${number(f[id])}</b> ${text}</li>`).join('')}${signs}</ul>`;
}
