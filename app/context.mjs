// What an entry is about besides how it felt: a holiday, the weather.
// The diary draws these as signs on the scene of the day.
//
// The four functions below are the whole contract with the rest of the diary:
// atmosphere.mjs stores readContext() in the imprint of a day, scene.mjs places
// contextSVG() among the layers of a scene and lists contextRules() under
// «Как собрана сцена», main.mjs adds contextSVG() to the cards of the archive and
// contextPageHTML() to the page of an open day. Everything returned is a plain
// string that carries its own styles, so the exported folder shows it as well.

// story: the text of the entry; date: 'YYYY-MM-DD' or undefined.
// Returns a small serialisable object; `occasion` is null when no holiday is named.
export function readContext(story, date) {
  return {occasion: null, weather: []};
}

// The signs for one scene: '' when there is nothing to draw, otherwise one
// <svg class="decor" …> that fills the scene (it is positioned by the page).
// imprint carries the feelings and tokens of the day, seed is the day's id,
// size is the width of the picture relative to a full scene (a card is about .36).
export function contextSVG(context, imprint, seed, size = 1) {
  return '';
}

// Lines for «Как собрана сцена»: [{label: 'Хэллоуин', text: 'тыквы и призраки по краям кадра'}].
export function contextRules(context) {
  return [];
}

// An optional layer over the whole page of an open day (falling snow, for example): '' or markup.
export function contextPageHTML(context, imprint) {
  return '';
}
