// A shared hidden layer learns interactions between text cues and the eight mood scores.
import {BITS, ORDER, sigmoid} from '../app/own-model.mjs';

export const HIDDEN = 24;
const OUTPUTS = ORDER.length;
const DENSE = 29;
const FEATURES = (1 << BITS) + DENSE;

export function networkForward(model, features, hidden, scores) {
  const {input, output, inputScale = 1} = model;
  hidden.set(model.bias);
  for (let k = 0; k < features.index.length; k++) {
    const offset = features.index[k] * HIDDEN;
    const value = features.value[k] * inputScale;
    for (let h = 0; h < HIDDEN; h++) hidden[h] += input[offset + h] * value;
  }
  for (let k = 0; k < DENSE; k++) {
    const offset = ((1 << BITS) + k) * HIDDEN;
    const value = features.dense[k] * inputScale;
    for (let h = 0; h < HIDDEN; h++) hidden[h] += input[offset + h] * value;
  }
  for (let h = 0; h < HIDDEN; h++) hidden[h] = Math.tanh(hidden[h]);
  for (let f = 0; f < OUTPUTS; f++) {
    let z = output[HIDDEN * OUTPUTS + f];
    for (let h = 0; h < HIDDEN; h++) z += hidden[h] * output[h * OUTPUTS + f];
    scores[f] = sigmoid(z);
  }
  return scores;
}

export const networkWeights = FEATURES * HIDDEN;
