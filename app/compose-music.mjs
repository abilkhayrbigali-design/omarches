const sampleRate = 24000;
const tableLength = 2048;
const tau = 2 * Math.PI;
const major = [0, 2, 4, 5, 7, 9, 11];
const minor = [0, 2, 3, 5, 7, 8, 10];
const dorian = [0, 2, 3, 5, 7, 9, 10];

const styles = {
  maple: {name:'Янтарная мелодия', bpm:70, energy:.28, tone:.22, scale:major, lead:'keys', swing:.07, rhythm:[0, 1.5, 2, 3.5]},
  office: {name:'Ночной импульс', bpm:138, energy:.87, tone:-.15, scale:minor, lead:'pulse', swing:0, rhythm:[0, .5, 1.5, 2, 2.75, 3.5]},
  train: {name:'Линия рассвета', bpm:102, energy:.53, tone:.56, scale:major, lead:'bell', swing:.03, rhythm:[0, .5, 1.5, 2.5, 3]},
  rain: {name:'Капли на стекле', bpm:68, energy:.21, tone:-.68, scale:minor, lead:'keys', swing:.04, rhythm:[.5, 1.5, 3]},
  lake: {name:'Отражения в воде', bpm:80, energy:.34, tone:-.09, scale:dorian, lead:'flute', swing:0, rhythm:[0, 1.5, 3]},
  cake: {name:'Огни после полуночи', bpm:126, energy:.84, tone:.73, scale:major, lead:'pluck', swing:.11, rhythm:[0, .75, 1.5, 2, 3, 3.5]}
};

function randomSource(text) {
  let state = 2166136261;
  for (const character of text) state = Math.imul(state ^ character.codePointAt(0), 16777619);
  if (!state) state = 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

const pick = (items, random) => items[Math.floor(random() * items.length)];
function waveform(harmonics) {
  const wave = new Float32Array(tableLength);
  const weight = harmonics.reduce((sum, value) => sum + value, 0);
  for (let i = 0; i < tableLength; i++) {
    for (const [index, gain] of harmonics.entries()) {
      wave[i] += gain * Math.sin(tau * i * (index + 1) / tableLength) / weight;
    }
  }
  return wave;
}

const instruments = {
  keys: waveform([1, .44, .18, .075]),
  flute: waveform([1, .05, .12]),
  pulse: waveform([1, .11, .32, .045, .09]),
  pluck: waveform([1, .54, .3, .15, .09]),
  bell: waveform([1, .22, .03, .16, .08]),
  pad: waveform([1, .19, .08]),
  bass: waveform([1, .25, .06])
};

// A single note has an attack, exponential decay and a short release.
// Keeping phase and decay incremental makes rendering inexpensive on a phone.
function note(buffer, start, seconds, midi, volume, instrument, attack, decay) {
  const wave = instruments[instrument];
  const step = tableLength * 440 * 2 ** ((midi - 69) / 12) / sampleRate;
  const offset = Math.round(start * sampleRate);
  const length = Math.min(buffer.length - offset, Math.round(seconds * sampleRate));
  const attackSamples = Math.max(1, sampleRate * attack);
  const releaseSamples = Math.max(1, Math.min(length / 3, sampleRate * .16));
  const multiplier = Math.exp(-1 / (sampleRate * decay));
  let amplitude = volume;
  let phase = 0;
  for (let i = 0; i < length; i++) {
    const lower = Math.floor(phase);
    const fraction = phase - lower;
    const sample = wave[lower] + fraction * (wave[(lower + 1) % tableLength] - wave[lower]);
    buffer[offset + i] += sample * amplitude * Math.min(1, i / attackSamples, (length - i) / releaseSamples);
    phase += step;
    if (phase >= tableLength) phase -= tableLength;
    amplitude *= multiplier;
  }
}

function percussion(buffer, start, drum, volume, random) {
  const offset = Math.round(start * sampleRate);
  const kick = drum === 'kick';
  const snare = drum === 'snare';
  const seconds = kick ? .24 : snare ? .145 : .06;
  const length = Math.min(buffer.length - offset, Math.round(seconds * sampleRate));
  const decay = Math.exp(-5.2 / length);
  let amplitude = volume, phase = 0, previousNoise = 0;
  for (let i = 0; i < length; i++) {
    let signal;
    if (kick) {
      phase += tau / sampleRate * (45 + 95 * Math.exp(-i / (sampleRate * .033)));
      signal = Math.sin(phase);
    } else {
      const noise = random() * 2 - 1;
      signal = snare ? .55 * noise + .20 * Math.sin(tau * i * 183 / sampleRate) : .45 * (noise - previousNoise);
      previousNoise = noise;
    }
    buffer[offset + i] += amplitude * Math.min(1, i / 35) * signal;
    amplitude *= decay;
  }
}

function audioFile(buffer, beat, name) {
  const dataSize = buffer.length * 4;
  const bytes = new ArrayBuffer(44 + dataSize);
  const view = new DataView(bytes);
  const label = (offset, value) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  label(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  label(8, 'WAVE');
  label(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  label(36, 'data');
  view.setUint32(40, dataSize, true);
  const leftDelay = Math.round(sampleRate * beat * .5);
  const rightDelay = Math.round(sampleRate * beat * .75);
  let peak = .001;
  for (const value of buffer) peak = Math.max(peak, Math.abs(value));
  const gain = .92 / (peak * 1.23);
  for (let i = 0; i < buffer.length; i++) {
    const level = gain * Math.min(1, i / (sampleRate * .04), (buffer.length - 1 - i) / (sampleRate * .70));
    const left = buffer[i] + .17 * (buffer[i - leftDelay] || 0) + .06 * (buffer[i - 2 * rightDelay] || 0);
    const right = buffer[i] + .17 * (buffer[i - rightDelay] || 0) + .06 * (buffer[i - 2 * leftDelay] || 0);
    view.setInt16(44 + i * 4, Math.round(left * level * 32767), true);
    view.setInt16(46 + i * 4, Math.round(right * level * 32767), true);
  }
  return new File([bytes], name + '.wav', {type:'audio/wav'});
}

export async function generateMusic({story, styleId, variant = 1}) {
  const text = String(story || '').trim().toLocaleLowerCase('ru').replace(/\s+/gu, ' ');
  if (!text) throw new Error('Сначала добавьте текст о дне.');
  const style = styles[styleId];
  if (!Object.hasOwn(styles, styleId)) throw new Error('Выберите характер музыки.');
  if (!Number.isSafeInteger(variant) || variant < 1) throw new Error('Укажите положительный номер варианта.');
  const random = randomSource(text + '|' + styleId + '|' + variant);
  const emphasis = Math.min(2, (text.match(/!/gu) || []).length);
  const bpm = style.bpm + Math.round((random() - .5) * 8) + emphasis;
  const beat = 60 / bpm;
  const bars = Math.round(25 / (8 * beat)) * 2;
  const buffer = new Float32Array(Math.round((bars * 4 * beat + .9) * sampleRate));
  const tonic = pick([48, 50, 52, 53, 55], random);
  const progression = pick([[0, 4, 5, 3], [0, 3, 5, 4], [0, 5, 3, 4], [0, 2, 3, 4]], random);
  const motif = style.rhythm.map(() => pick([0, 2, 2, 4, 6], random));
  const pitch = degree => tonic + style.scale[degree % 7] + 12 * Math.floor(degree / 7);
  const energetic = style.energy > .65;

  for (let bar = 0; bar < bars; bar++) {
    const last = bar === bars - 1;
    const chord = last ? 0 : progression[bar % progression.length];
    const start = bar * 4 * beat;
    for (const degree of [chord, chord + 2, chord + 4]) {
      note(buffer, start, 4 * beat, pitch(degree), .068, 'pad', .16, 3.1);
    }
    note(buffer, start, 1.9 * beat, pitch(chord) - 12, .26, 'bass', .018, .55);
    if (!last) note(buffer, start + 2 * beat, 1.4 * beat, pitch(chord + 4) - 12, .18, 'bass', .018, .41);

    const steps = last ? [0, 1.5, 2.5] : style.rhythm;
    steps.forEach((position, index) => {
      const finalNote = last && index === steps.length - 1;
      const variation = bar % 4 === 3 && index === 1 ? 1 : 0;
      const degree = finalNote ? 0 : chord + motif[index] + variation;
      const swing = Number.isInteger(position) ? 0 : style.swing;
      const time = start + (position + swing) * beat;
      const length = finalNote ? 1.5 * beat : Math.min(1.7, (steps[index + 1] ?? 4) - position + .2) * beat;
      note(buffer, time, length, pitch(degree) + 12, .28 + random() * .08, style.lead, style.lead === 'flute' ? .06 : .013, energetic ? .27 : .59);
    });
    if (energetic && !last) {
      for (const position of [0, 2]) percussion(buffer, start + position * beat, 'kick', .45, random);
      for (const position of [1, 3]) percussion(buffer, start + position * beat, 'snare', .28, random);
    }
    if (!last && (energetic || bar % 2 === 1)) {
      for (const position of energetic ? [.5, 1.5, 2.5, 3.5] : [1.5, 3.5]) {
        percussion(buffer, start + (position + style.swing) * beat, 'hat', .06 + .05 * style.energy, random);
      }
    }
    // Let the editor paint its progress state between rendered phrases.
    if (bar % 2 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  const track = style.name + ' · ' + variant;
  const analysis = {bpm, energy:Math.min(1, style.energy + emphasis * .025), tone:style.tone, confidence:1};
  return {blob:audioFile(buffer, beat, track), track, analysis, duration:buffer.length / sampleRate, styleId, variant};
}
