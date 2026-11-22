import {searchMusic} from './online-catalog.mjs';
import {musicQuery, rankOnlineTracks} from './music-query.mjs';
import {recommendTracks} from './recommend.mjs';
import {generateMusic} from './compose-music.mjs';
import {musicRights} from './music-rights.mjs';
import {audioStats} from './atmosphere.mjs';

// The publisher lets a page play a catalogue track but not read its sound, so the
// local server downloads it for analysis. Without the server the tags are used.
async function listen(track) {
  try {
    const response = await fetch('/api/music/audio', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({url: track.audioUrl}), signal: AbortSignal.timeout(40000)
    });
    if (!response.ok) return null;
    return {...await audioStats(await response.blob()), heard: true};
  } catch {
    return null;
  }
}

function externalLink(text, url) {
  const link = document.createElement('a');
  link.textContent = text;
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function catalogMusic(track) {
  const description = track.licenseCode === 'cc0'
    ? 'Источник указывает посвящение CC0. Ссылка на оригинал приложена к записи.'
    : 'При публикации укажите название, автора, источник, ссылку на лицензию и внесённые изменения.';
  const tags = [...track.genres, ...track.tags, track.title].join(' ').toLowerCase();
  const vibrant = /upbeat|energetic|dance|techno|drum|driving|punk|metal|intense/.test(tags);
  const quiet = /ambient|soft|piano|meditat|relax|mellow|slow|peaceful|calm/.test(tags);
  const pulse = tags.match(/\b(\d{2,3})\s*bpm\b/);
  const bpm = pulse && +pulse[1] >= 30 && +pulse[1] <= 250 ? +pulse[1] : null;
  const analysis = {
    bpm, confidence:0, energy:vibrant ? .82 : quiet ? .25 : .5,
    tone:/melanchol|sad|minor|dark/.test(tags) ? -.5 : /upbeat|happy|uplift|bright/.test(tags) ? .5 : 0
  };
  return {
    kind:'remote', origin:'catalog', track:track.title, artist:track.artist, source:track.audioUrl,
    url:track.sourceUrl, sourceUrl:track.sourceUrl, license:track.license, licenseUrl:track.licenseUrl,
    provider:track.provider, creatorUrl:track.creatorUrl, catalogId:track.id,
    rights:{label:track.license, description:track.attribution+' '+description}, analysis
  };
}

export function setupMusicPicker(form) {
  const get = id => form.querySelector('#'+id);
  const picks = get('music-picks');
  const more = get('music-more');
  const status = get('music-progress');
  const player = get('catalog-player');
  const preview = get('music-preview');
  const generate = get('music-generate');
  const generatedPreview = get('generated-preview');
  const generatedStatus = get('generated-status');
  const records = new Map();
  let selected;
  let story = '';
  let mode = '';
  let terms = [];
  let term = 0;
  let page = 1;
  let request;
  let generation = 0;
  let version = 0;
  let generated;
  let generatedURL;

  function cancel() {
    request?.abort();
    request = null;
    more.disabled = false;
    preview.pause();
    generatedPreview.pause();
    generation++;
    generate.disabled = false;
  }
  function clearGenerated() {
    if (generatedURL) URL.revokeObjectURL(generatedURL);
    generated = null;
    generatedURL = null;
    version = 0;
    generatedPreview.removeAttribute('src');
    generatedPreview.hidden = true;
    generate.textContent = 'Сочинить мелодию';
    generatedStatus.textContent = '';
  }
  function choose(track) {
    selected = track;
    preview.pause();
    preview.src = track.audioUrl;
    player.hidden = false;
    get('preview-title').textContent = track.title+' · '+track.artist;
    get('catalog-credit').replaceChildren(
      externalLink('Страница трека',track.sourceUrl), ' · ', externalLink(track.license,track.licenseUrl),
      track.licenseCode === 'by' ? ' · При публикации укажите автора.' : ' · Доступен по CC0.'
    );
  }
  preview.addEventListener('error', () => {
    if (mode === 'assist' && selected && preview.currentSrc === selected.audioUrl)
      status.textContent = 'Источник не воспроизвёл трек. Откройте его страницу или выберите другой.';
  });
  function addTrack(track) {
    const label = document.createElement('label');
    label.className = 'music-option';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'soundtrack';
    radio.value = track.id;
    const body = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = track.title;
    const subtitle = document.createElement('small');
    subtitle.textContent = [track.artist,track.license,track.duration ?
      Math.floor(track.duration/60)+':'+String(track.duration%60).padStart(2,'0') : ''].filter(Boolean).join(' · ');
    body.append(title,subtitle);
    label.append(radio,body);
    picks.append(label);
    radio.addEventListener('change', () => choose(track));
    if (!selected) { radio.checked = true; choose(track); }
  }

  async function loadMore() {
    if (request || mode !== 'assist' || term >= terms.length) return;
    const controller = new AbortController();
    request = controller;
    more.disabled = true;
    status.textContent = 'Ищем музыку в Openverse…';
    const previousCount = records.size;
    try {
      // Empty or duplicated result pages can occur after licensing filters.
      for (let attempt=0; attempt<2 && records.size===previousCount && term<terms.length; attempt++) {
        const result = await searchMusic({query:terms[term],page,signal:controller.signal});
        if (controller.signal.aborted) return;
        for (const track of rankOnlineTracks(story,result.tracks)) {
          if (!records.has(track.id)) { records.set(track.id,track); addTrack(track); }
        }
        if (result.hasMore) page++;
        else { term++; page=1; }
      }
      status.textContent = records.size ? 'Треков в подборке: '+records.size
        : 'Подходящих записей по этой теме пока нет.';
      more.textContent = 'Ещё треки';
      more.hidden = term >= terms.length;
    } catch (error) {
      if (controller.signal.aborted) return;
      status.textContent = error.message;
      more.hidden = false;
      more.textContent = 'Повторить поиск';
    } finally {
      if (request === controller) { request=null; more.disabled=false; }
    }
  }
  more.addEventListener('click',loadMore);

  function setMode(value) {
    cancel();
    mode = value;
    const text = form.elements.story.value.trim();
    if (text !== story) {
      story = text;
      terms = [];
      term=0;
      page=1;
      records.clear();
      selected=null;
      picks.replaceChildren();
      player.hidden=true;
      preview.removeAttribute('src');
      more.hidden=true;
      status.textContent='';
      clearGenerated();
    }
    if (value === 'assist' && story) {
      if (!terms.length) {
        const query=musicQuery(story);
        terms=query.terms;
        get('query-reason').textContent=query.reason;
      }
      if (!records.size) loadMore();
      else status.textContent='Треков в подборке: '+records.size;
    }
  }

  generate.addEventListener('click', async () => {
    if (!story || mode !== 'generate') return;
    const current = ++generation;
    generate.disabled=true;
    generatedStatus.textContent='Сочиняем мелодию…';
    try {
      const styleId = recommendTracks(story)[0].id;
      const song = await generateMusic({story,styleId,variant:version+1});
      if (generation !== current) return;
      version++;
      generatedPreview.pause();
      if (generatedURL) URL.revokeObjectURL(generatedURL);
      generated={...song,kind:'file',origin:'generated',styleId,rights:musicRights};
      generatedURL=URL.createObjectURL(song.blob);
      generatedPreview.src=generatedURL;
      generatedPreview.hidden=false;
      generatedStatus.textContent=song.track+' · '+song.analysis.bpm+' уд/мин';
      generate.textContent='Сочинить другой вариант';
    } catch {
      if (generation===current) generatedStatus.textContent='Синтез не удался. Попробуйте ещё раз.';
    } finally {
      if (generation===current) generate.disabled=false;
    }
  });

  return {
    setMode,
    pause() { cancel(); mode=''; },
    async selectedMusic() {
      if (mode==='generate') {
        if (!generated || generate.disabled) throw Error('Сначала сочините мелодию и дождитесь её готовности.');
        return generated;
      }
      if (!selected) throw Error('Сначала выберите трек, добавьте файл или укажите ссылку.');
      const music = catalogMusic(selected);
      status.textContent = 'Слушаем выбранный трек…';
      const heard = await listen(selected);
      status.textContent = 'Треков в подборке: '+records.size;
      // Tempo, energy and mode measured from the sound replace the guess made from tags.
      return heard ? {...music, analysis: heard} : music;
    }
  };
}
