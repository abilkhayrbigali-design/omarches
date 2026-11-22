import {occasionNames, weatherNames} from './context.mjs';
import {IDS, feelingName, ranking} from './feelings.mjs';
import {t} from './i18n.mjs';

// Choose scenes by the same measured context and final mood that actually paint
// them. Within a mood, prefer a clear reading without competing holiday or
// weather decorations. For weather, prefer the day dedicated to a single effect.
export function spectrumGroups(days) {
  const examples = days.filter(day => day.demo);
  function items(labels, score) {
    return labels.flatMap(([id, label]) => {
      let representative;
      let highest = -Infinity;
      for (const day of examples) {
        const value = score(day.imprint, id, day);
        if (value > highest) {
          highest = value;
          representative = day;
        }
      }
      return representative ? [{id, label, day:representative}] : [];
    });
  }
  const holidays = items(occasionNames(), (imprint, id, day) => {
    if (imprint.context.occasion !== id) return -Infinity;
    return day.participantExample ? 2 : 1;
  });
  const weather = items(weatherNames(), (imprint, id) => {
    const effects = imprint.context.weather;
    const effect = effects.find(effect => effect.kind === id);
    return effect ? effect.amount / effects.length : -Infinity;
  });
  const moods = items(IDS.map(id => [id, feelingName(id)]), (imprint, id) => {
    if (ranking(imprint.feelings).lead !== id) return -Infinity;
    const plain = !imprint.context.occasion && !imprint.context.weather.length;
    return imprint.feelings[id] + (plain ? 1 : 0);
  });
  return [
    {id:'occasion', label:t('Праздники'), items:holidays},
    {id:'weather', label:t('Погода'), items:weather},
    {id:'mood', label:t('Настроения'), items:moods}
  ];
}
