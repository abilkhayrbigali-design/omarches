import {readContext} from '../app/context.mjs';
import {normalizeContextText} from '../app/context-spelling.mjs';

const experiencer=/(?:^|[^\p{L}])(?:я|мы|меня|мне|нам|нас|мной|i|we|me|my|us|our|мен|мені|маған|менің|біз|бізді|бізге|біздің)(?!\p{L})/iu;
const narrative=/улыб|тревож|ску[чш]|плак|груст|смех|смеял|весел|расстро|счаст|радов|танце|раздраж|поддерж|обня|успок|страш|боял|ссора|тих[а-я]*\s+было\s+мне|confused|cried|sorrow|laugh|smil|quietly|hug|danc|frustrat|thrill|happy|glad|fear|feel|felt|worried|anxious|sad|calm|relax|worr|scared|қуан|куан|жыла|ашул|уайым|сағын|сагын|күл|күлім|кул|биле|қобал|мазасыз|құшақ|кушак|сезін|сезин/iu;
const calendar=/^(?:это\s+были?|тогда\s+были?|у\s+нас\s+был|it\s+(?:was|were)\b|we\s+(?:did\s+not|didn't)\s+celebrat|the\s+calend[ae]r|в\s+календаре|бұл\s|бул\s|күнтізбе|кунтизбе|праздников|никакого\s+торжества|мереке\s+бол|ешқандай\s+той|ешкандай\s+той|there\s+(?:was|were)\s+no\s+ce)/iu;
const forecast=/^(?:прогноз|the\s+forecast|ертең|ертен)/iu;

export function moodText(story) {
  const clauses=story.match(/[^.!?…\n]+[.!?…]*/gu) || [];
  const keep=clauses.filter(source=>{
    const line=source.trim();
    if (!line) return false;
    const {text}=normalizeContextText(line);
    if (narrative.test(text)) return true;
    if (calendar.test(text) || forecast.test(text)) return false;
    if (experiencer.test(text)) return true;
    const context=readContext(line);
    return !(context.occasion || context.weather.length);
  });
  return keep.join(' ').trim() || story;
}
