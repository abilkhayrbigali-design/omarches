import {moodText} from '../mood-server/mood-text.mjs';
import {loadServerModel, readOnServer, serverModelName} from '../mood-server/infer.mjs';

const headers = {'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'};
const reply = (body, status = 200) => Response.json(body,{status,headers});
const MAX_BYTES = 32_768;
const ENHANCED = 'ottisk-mood-5';

async function enhancedReading(request, story, lang) {
  const base = await readOnServer(story,lang);
  try {
    const response = await fetch(new URL('/api/mood_semantic',request.url),{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({text:moodText(story)}),signal:AbortSignal.timeout(49_000)
    });
    if (!response.ok) return base;
    const data=await response.json();
    const keys=Object.keys(base.feelings);
    if (data.model!==ENHANCED || !keys.every(id=>Number.isFinite(data.scores?.[id]))) return base;
    const lead=keys.reduce((a,b)=>data.scores[b]>data.scores[a]?b:a);
    const other=keys.filter(id=>id!==lead);
    for (const id of other) base.feelings[id]=Math.min(.99,base.feelings[id]);
    base.feelings[lead]=Math.max(base.feelings[lead],Number((Math.max(...other.map(id=>base.feelings[id]))+.01).toFixed(2)));
    return {...base,model:ENHANCED,primary:lead};
  } catch {
    return base;
  }
}

export default {
  async fetch(request) {
    if (request.method === 'GET') {
      try {
        await loadServerModel();
        return reply({available:true,model:ENHANCED,fallbackModel:serverModelName});
      } catch {
        return reply({available:false},503);
      }
    }
    if (request.method !== 'POST') return reply({code:'method_not_allowed'},405);
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return reply({code:'invalid_type'},415);
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return reply({code:'invalid_origin'},403);
    const reader = request.body?.getReader();
    if (!reader) return reply({code:'invalid_request'},400);
    let bytes = 0, body = '';
    const decoder = new TextDecoder();
    try {
      while (true) {
        const {done,value} = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > MAX_BYTES) {
          await reader.cancel();
          return reply({code:'invalid_size'},413);
        }
        body += decoder.decode(value,{stream:true});
      }
      body += decoder.decode();
      const input = JSON.parse(body);
      const story = typeof input?.story === 'string' ? input.story.trim() : '';
      if (!story || story.length > 6000) return reply({code:'invalid_story'},400);
      const lang = ['ru','kk','en'].includes(input.language) ? input.language : 'ru';
      try { return reply(await enhancedReading(request,story,lang)); }
      catch { return reply({code:'unavailable'},503); }
    } catch { return reply({code:'invalid_request'},400); }
  }
};
