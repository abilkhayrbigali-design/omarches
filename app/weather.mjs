// The exported day embeds this function, so keep its dependencies inside it.
export function weatherLayer() {
  const clouds = [...document.querySelectorAll('.d-cloud')];
  const mark = document.querySelector('.d-weather');
  if (!clouds.length && !mark) return () => {};

  const root = document.documentElement;
  const stillness = matchMedia('(prefers-reduced-motion: reduce)');
  let updatePrecipitation = () => {};
  function updateMood() {
    const style = getComputedStyle(root);
    const pace = parseFloat(style.getPropertyValue('--pace')) || 1;
    for (const cloud of clouds) {
      for (const animation of cloud.getAnimations()) animation.updatePlaybackRate(pace);
    }
    updatePrecipitation(style, pace);
  }
  const theme = new MutationObserver(updateMood);
  theme.observe(root, {attributes: true, attributeFilter: ['style']});
  stillness.addEventListener('change', updateMood);

  function stopClouds() {
    theme.disconnect();
    stillness.removeEventListener('change', updateMood);
  }
  if (!mark) {
    updateMood();
    return stopClouds;
  }

  const canvas = document.createElement('canvas');
  canvas.className = 'weather-precipitation';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:8;pointer-events:none';
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    updateMood();
    return stopClouds;
  }
  document.body.append(canvas);

  const snow = Number(mark.dataset.snow) || 0;
  const rain = Number(mark.dataset.rain) || 0;
  const rand = (a, b) => a + Math.random() * (b - a);
  const flakes = [], drops = [], sparks = [];
  const piles = new WeakMap();
  const grain = 4;
  let width, height, ratio, pace, sway, light;
  let ledges = [], dirty = true, frameId = 0, last = 0, clock = 0, nextSurvey = 0;

  updatePrecipitation = (style, speed) => {
    pace = speed;
    sway = parseFloat(style.getPropertyValue('--sway')) || 10;
    light = style.colorScheme === 'light';
    dirty = true;
  };

  function spawn(particle, isSnow, initial = false) {
    particle.x = rand(-18, width + (isSnow ? 18 : height * .16));
    particle.y = initial ? rand(-30, height) : rand(-65, -4);
    particle.speed = isSnow ? rand(24, 67) : rand(530, 940);
    particle.size = isSnow ? rand(.8, 3.5) : rand(8, 20);
    particle.phase = rand(0, Math.PI * 2);
    particle.alpha = isSnow ? rand(.35, .86) : rand(.22, .55);
    return particle;
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const area = Math.min(1.45, width * height / 850000);
    for (const [particles, amount, isSnow] of [[flakes, snow, true], [drops, rain, false]]) {
      const count = amount ? Math.max(14, Math.round((30 + amount * 105) * area)) : 0;
      particles.splice(count);
      while (particles.length < count) particles.push(spawn({}, isSnow, true));
    }
    dirty = true;
  }

  function survey() {
    ledges = [];
    for (const element of document.querySelectorAll('.memory, .top nav .primary, .day-actions .bordered, .transport button, .transport audio')) {
      const box = element.getBoundingClientRect();
      if (box.width < 30 || box.top < 4 || box.top > height - 2 || box.right < 0 || box.left > width) continue;
      const scene = element.matches('.memory');
      const inset = scene ? 10 : 6;
      const cap = scene ? 6 : 3;
      const columns = Math.ceil((box.width - inset * 2) / grain);
      let pile = piles.get(element);
      if (snow && (!pile || pile.length !== columns)) {
        // Leave a few uneven traces to brush away as soon as the snowy day opens.
        pile = Float32Array.from({length: columns}, (_, i) =>
          Math.max(0, Math.sin(i * .13) * .55 + rand(-.15, .35)) * cap * (.4 + snow * .5));
        piles.set(element, pile);
      }
      ledges.push({left: box.left + inset, right: box.right - inset, y: box.top + 1, pile, cap});
    }
    ledges.sort((a, b) => a.y - b.y);
    dirty = false;
  }

  function drawSnow(x, y, size, angle) {
    ctx.beginPath();
    if (size < 2.4) {
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    for (let arm = 0; arm < 3; arm++) {
      const direction = angle + arm * Math.PI / 3;
      const dx = Math.cos(direction) * size, dy = Math.sin(direction) * size;
      ctx.moveTo(x - dx, y - dy);
      ctx.lineTo(x + dx, y + dy);
    }
    ctx.stroke();
  }

  function fall(particle, dt, isSnow) {
    const {x, y, speed, size, phase, alpha} = particle;
    const fallSpeed = speed * (isSnow ? .55 + .5 * pace : .75 + .35 * pace);
    const lean = -.05 - .09 * Math.max(0, pace - .5);
    particle.y += fallSpeed * dt;
    particle.x += (isSnow ? Math.sin(clock * .85 + phase) * (7 + sway * .5) : fallSpeed * lean) * dt;
    for (const ledge of ledges) {
      if (y > ledge.y || particle.y <= ledge.y) continue;
      const hitX = x + (particle.x - x) * (ledge.y - y) / (particle.y - y);
      if (hitX <= ledge.left || hitX >= ledge.right) continue;
      if (isSnow) {
        const column = Math.floor((hitX - ledge.left) / grain);
        if (ledge.pile[column] < ledge.cap && Math.random() < .75) {
          for (let at = Math.max(0, column - 1); at <= Math.min(ledge.pile.length - 1, column + 1); at++) {
            ledge.pile[at] = Math.min(ledge.cap, ledge.pile[at] + size * (at === column ? .7 : .35));
          }
          spawn(particle, true);
          return;
        }
      } else if (Math.random() < .38) {
        for (const direction of [-1, 1]) {
          sparks.push({x: hitX, y: ledge.y - 1, vx: direction * rand(30, 93), vy: rand(-140, -75), age: 0, life: rand(.18, .32), size: rand(.8, 1.5), snow: false});
        }
        spawn(particle, false);
        return;
      }
      break;
    }
    if (particle.y > height + 20 || particle.x < -35 || particle.x > width + height * .2 + 30) {
      spawn(particle, isSnow);
      return;
    }
    ctx.globalAlpha = alpha;
    if (isSnow) {
      drawSnow(particle.x, particle.y, size, phase + clock * .5);
    } else {
      ctx.beginPath();
      ctx.moveTo(particle.x - lean * size, particle.y - size);
      ctx.lineTo(particle.x, particle.y);
      ctx.stroke();
    }
  }

  function frame(now) {
    frameId = 0;
    if (stillness.matches) return;
    const dt = last ? Math.min(.04, (now - last) / 1000) : 0;
    last = now;
    clock += dt;
    if (dirty || now >= nextSurvey) {
      survey();
      nextSurvey = now + 250;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = 'round';
    ctx.lineWidth = 1;
    const flakeColor = light ? '#829ab5' : '#f5faff';
    const rainColor = light ? '#55799d' : '#b7d7f6';
    ctx.fillStyle = ctx.strokeStyle = flakeColor;
    for (const flake of flakes) fall(flake, dt, true);
    if (snow) {
      ctx.globalAlpha = light ? .9 : .85;
      ctx.fillStyle = light ? '#d5e2eb' : '#edf6ff';
      for (const {left, right, y, pile} of ledges) {
        ctx.beginPath();
        ctx.moveTo(left, y);
        for (let i = 0; i < pile.length; i++) {
          const x = Math.min(right, left + (i + .5) * grain);
          const next = pile[i + 1] ?? 0;
          ctx.quadraticCurveTo(x, y - pile[i], Math.min(right, x + grain / 2), y - (pile[i] + next) / 2);
        }
        ctx.lineTo(right, y);
        ctx.fill();
      }
    }
    ctx.strokeStyle = rainColor;
    for (const drop of drops) fall(drop, dt, false);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const spark = sparks[i];
      spark.age += dt;
      if (spark.age >= spark.life) {
        sparks.splice(i, 1);
        continue;
      }
      spark.vy += (spark.snow ? 180 : 660) * dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      ctx.fillStyle = spark.snow ? flakeColor : rainColor;
      ctx.globalAlpha = (1 - spark.age / spark.life) * .8;
      drawSnow(spark.x, spark.y, spark.size, 0);
    }
    frameId = requestAnimationFrame(frame);
  }

  function brush(event) {
    if (!snow || stillness.matches || event.pointerType === 'touch') return;
    if (dirty) survey();
    for (const {left, y, pile} of ledges) {
      if (Math.abs(event.clientY - y) > 13) continue;
      const center = Math.floor((event.clientX - left) / grain);
      for (let i = Math.max(0, center - 4); i <= Math.min(pile.length - 1, center + 4); i++) {
        const amount = pile[i];
        pile[i] *= .12;
        if (amount < .3 || Math.random() > .5) continue;
        sparks.push({x: left + (i + .5) * grain, y: y - amount, vx: rand(-18, 18) + Math.max(-22, Math.min(22, event.movementX)) * 3, vy: rand(-40, -10), age: 0, life: rand(.45, .8), size: rand(1, 2.2), snow: true});
      }
    }
  }

  const scrolled = () => { dirty = true; };
  function motionChanged() {
    if (stillness.matches) {
      cancelAnimationFrame(frameId);
      frameId = 0;
      last = 0;
    } else if (!frameId) {
      frameId = requestAnimationFrame(frame);
    }
  }
  resize();
  updateMood();
  motionChanged();
  if (snow) window.addEventListener('pointermove', brush, {passive: true});
  window.addEventListener('scroll', scrolled, {passive: true});
  window.addEventListener('resize', resize);
  stillness.addEventListener('change', motionChanged);
  return () => {
    stopClouds();
    cancelAnimationFrame(frameId);
    window.removeEventListener('pointermove', brush);
    window.removeEventListener('scroll', scrolled);
    window.removeEventListener('resize', resize);
    stillness.removeEventListener('change', motionChanged);
    canvas.remove();
  };
}
