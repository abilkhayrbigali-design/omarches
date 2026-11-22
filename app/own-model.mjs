// The diary's own reader: a model that runs on the device and turns the text of
// an entry into the eight numbers, without any outside service.
//
// Contract with reading.mjs: ownReading(story) resolves to
//   {feelings: {joy, sadness, calm, tension, festive, quiet, warmth, solitude},  // each 0…1
//    title, reason, source: 'own', model: '<name and version>'}
// or to null when the model cannot be used; the dictionary answers then.
export async function ownReading(story) {
  return null;
}
