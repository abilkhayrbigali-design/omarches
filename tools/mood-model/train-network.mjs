import {BITS, ORDER} from '../../app/own-model.mjs';
import {HIDDEN, networkForward, networkWeights} from '../../mood-server/network.mjs';

export function createRandom(seed) {
  let state = seed;
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}

export function fitNetwork(data, {epochs, balance, l2, rate}, rand) {
  const input = new Float32Array(networkWeights);
  const inputG = new Float32Array(input.length).fill(.001);
  const bias = new Float32Array(HIDDEN);
  const biasG = new Float32Array(HIDDEN).fill(.001);
  const output = Float32Array.from({length:(HIDDEN + 1) * ORDER.length}, () => (rand() - .5) * .24);
  const outputG = new Float32Array(output.length).fill(.001);
  const hidden = new Float32Array(HIDDEN);
  const scores = new Float32Array(ORDER.length);
  const hiddenError = new Float32Array(HIDDEN);
  const model = {input, bias, output};
  const order = data.map((_, i) => i);
  const counts = {};
  for (const {lang} of data) counts[lang] = (counts[lang] ?? 0) + 1;
  const weight = data.map(({lang}) => (data.length / (3 * counts[lang])) ** balance);

  function move(values, history, index, gradient) {
    const g = gradient + l2 * values[index];
    history[index] += g * g;
    values[index] -= rate * g / Math.sqrt(history[index]);
  }
  for (let epoch = 0; epoch < epochs; epoch++) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const index of order) {
      const {x,y} = data[index];
      networkForward(model, x, hidden, scores);
      hiddenError.fill(0);
      for (let i = 0; i < ORDER.length; i++) {
        const error = (scores[i] - y[i]) * weight[index];
        for (let h = 0; h < HIDDEN; h++) {
          const k = h * ORDER.length + i;
          hiddenError[h] += error * output[k];
          move(output, outputG, k, error * hidden[h]);
        }
        move(output, outputG, HIDDEN * ORDER.length + i, error);
      }
      for (let h = 0; h < HIDDEN; h++) {
        hiddenError[h] *= 1 - hidden[h] ** 2;
        move(bias, biasG, h, hiddenError[h]);
      }
      for (let k = 0; k < x.index.length; k++) {
        const offset = x.index[k] * HIDDEN;
        for (let h = 0; h < HIDDEN; h++) move(input, inputG, offset + h, hiddenError[h] * x.value[k]);
      }
      for (let k = 0; k < x.dense.length; k++) {
        const offset = ((1 << BITS) + k) * HIDDEN;
        for (let h = 0; h < HIDDEN; h++) move(input, inputG, offset + h, hiddenError[h] * x.dense[k]);
      }
    }
  }
  return model;
}
