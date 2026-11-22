import {serviceMessage, t} from './i18n.mjs';
const maxFrames = 12;
const maxBytes = 20 * 1024 * 1024;

export function setupImagePicker(form) {
  const strip = form.querySelector('#photo-strip');
  const orderStatus = form.querySelector('#frame-order-status');
  const upload = form.elements.photos;
  const make = form.querySelector('#generate-image');
  const accept = form.querySelector('#accept-image');
  const preview = form.querySelector('#generated-image');
  const review = form.querySelector('#image-review');
  const status = form.querySelector('#image-status');
  const scene = form.querySelector('#image-description');
  const help = form.querySelector('#image-key-help');
  const style = form.querySelector('#image-style');
  const box = form.querySelector('.image-generator');
  const frames = [];
  let service = null;
  let pending = null;
  let candidate = null;
  let story = '';
  let serial = 0;
  let generationNumber = 0;

  function discardPreview() {
    if (candidate) URL.revokeObjectURL(candidate.url);
    candidate = null;
    preview.removeAttribute('src');
    review.hidden = true;
  }

  function refreshCapacity() {
    scene.disabled = Boolean(pending);
    style.disabled = Boolean(pending);
    make.disabled = !scene.value.trim() || !service?.available || Boolean(pending) || frames.length >= maxFrames;
    accept.disabled = frames.length >= maxFrames || Boolean(pending);
    upload.disabled = frames.length >= maxFrames;
  }

  function showFrames() {
    strip.replaceChildren();
    for (const [index,frame] of frames.entries()) {
      const item = document.createElement('div');
      item.className = 'frame-item';
      const chip = document.createElement('div');
      chip.className = 'frame-chip';
      const image = new Image();
      image.src = frame.url;
      image.alt = frame.file.name || t`Кадр ${index+1}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label',t`Убрать кадр ${index+1}`);
      remove.addEventListener('click', () => {
        frames.splice(index,1);
        URL.revokeObjectURL(frame.url);
        showFrames();
        const neighbor = strip.children[Math.min(index,frames.length-1)];
        if (neighbor) neighbor.querySelector('.frame-chip button').focus();
        else upload.focus();
      });
      chip.append(image,remove);
      item.append(chip);
      if (frames.length>1) {
        const order = document.createElement('div');
        order.className = 'frame-order';
        for (const offset of [-1,1]) {
          const position=index+offset;
          const direction=offset<0?'earlier':'later';
          const move=document.createElement('button');
          move.type='button';
          move.className='plain bordered';
          move.dataset.move=direction;
          move.textContent=offset<0?'←':'→';
          move.disabled=position<0 || position>=frames.length;
          const label=offset<0?t`Переместить кадр ${index+1} раньше`:t`Переместить кадр ${index+1} позже`;
          move.setAttribute('aria-label',label);
          move.title=label;
          move.addEventListener('click',()=>{
            [frames[index],frames[position]]=[frames[position],frames[index]];
            showFrames();
            const moved=strip.children[position];
            (moved.querySelector(`[data-move="${direction}"]:enabled`) || moved.querySelector('.frame-chip button')).focus();
            orderStatus.textContent=t`Кадр ${index+1} перемещён на позицию ${position+1}.`;
          });
          order.append(move);
        }
        item.append(order);
      }
      strip.append(item);
    }
    refreshCapacity();
  }

  upload.addEventListener('change', () => {
    const added = [...upload.files];
    upload.value = '';
    if (added.length + frames.length > maxFrames || added.some(file => !file.size || file.size > maxBytes)) {
      status.textContent=t('Можно добавить до 12 кадров по 20 МБ. Выберите файлы меньшего размера или уберите лишние кадры.');
      return;
    }
    for (const file of added) frames.push({file,url:URL.createObjectURL(file),origin:{type:'upload'}});
    status.textContent='';
    showFrames();
  });

  function stopPending() {
    serial++;
    pending?.abort();
    pending=null;
    refreshCapacity();
  }

  async function enter() {
    stopPending();
    const currentStory = form.elements.story.value.trim();
    if (currentStory !== story) { discardPreview(); story=currentStory; scene.value=story; }
    status.textContent='';
    help.hidden=true;
    service=null;
    refreshCapacity();
    const attempt = serial;
    try {
      const response = await fetch('/api/image/status',{cache:'no-store',signal:AbortSignal.timeout(5000)});
      if (!response.ok) throw Error();
      const config = await response.json();
      if (attempt !== serial) return;
      if (config.provider !== 'openai') throw Error();
      service = config;
      delete box.dataset.offline;
      help.hidden = config.available;
    } catch {
      // A copy on the web has no image generator: say what works here instead of reporting a fault.
      if (attempt === serial) {
        box.dataset.offline='';
        status.textContent=t('Картинки по рассказу создаёт версия, запущенная на компьютере с ключом OpenAI. Здесь добавьте свои фотографии.');
      }
    } finally { if (attempt === serial) refreshCapacity(); }
  }

  scene.addEventListener('input',refreshCapacity);
  form.querySelector('#check-image-settings').addEventListener('click',enter);

  make.addEventListener('click', async () => {
    if (!service?.available || pending || frames.length >= maxFrames) return;
    const controller = new AbortController();
    const attempt = ++serial;
    const provider = service.provider;
    const brief = scene.value.trim();
    if (!brief) return;
    const selectedStyle = style.selectedOptions[0];
    const timer = setTimeout(()=>controller.abort(),300000);
    let url;
    pending=controller;
    refreshCapacity();
    make.textContent=t('Создаём изображение…');
    status.textContent=t('OpenAI создаёт изображение по выбранному описанию…');
    try {
      const response=await fetch('/api/image',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({story:brief,style:selectedStyle.value,provider}),signal:controller.signal
      });
      if (!response.ok) {
        const error = await response.json().catch(()=>({}));
        throw Error(serviceMessage(error.message, 'Не удалось создать изображение. Попробуйте ещё раз.'));
      }
      const model = decodeURIComponent(response.headers.get('X-Ottisk-Model') || service.model);
      const blob = await response.blob();
      if (!blob.type.startsWith('image/') || !blob.size || blob.size>maxBytes)
        throw Error(t('Генератор вернул нечитаемый или слишком большой кадр.'));
      url = URL.createObjectURL(blob);
      const check = new Image();
      check.src=url;
      await check.decode();
      if (attempt !== serial) return;
      discardPreview();
      const extension = blob.type==='image/jpeg' ? 'jpg' : blob.type==='image/webp' ? 'webp' : 'png';
      const file = new File([blob],t('Иллюстрация ')+(++generationNumber)+'.'+extension,{type:blob.type});
      candidate={file,url,origin:{type:'generated',provider,model,style:selectedStyle.textContent}};
      preview.src=url;
      url=null;
      review.hidden=false;
      status.textContent=t('Иллюстрация готова. Добавьте её к кадрам или создайте другой вариант.');
    } catch (error) {
      if (attempt === serial) status.textContent = controller.signal.aborted ? t('Генератор долго не отвечал. Попробуйте ещё раз.') : error.message;
    } finally {
      clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
      if (attempt === serial) {
        pending=null;
        make.textContent=candidate ? t('Создать другой вариант') : t('Создать изображение');
        refreshCapacity();
      }
    }
  });

  accept.addEventListener('click', () => {
    if (!candidate || frames.length >= maxFrames) return;
    frames.push(candidate);
    candidate=null;
    discardPreview();
    make.textContent=t('Создать изображение');
    status.textContent=t('Иллюстрация добавлена к кадрам дня.');
    showFrames();
  });

  return {
    enter,
    leave() { stopPending(); make.textContent=candidate?t('Создать другой вариант'):t('Создать изображение'); },
    files() {
      if (!frames.length) throw Error(candidate ? t('Нажмите «Добавить к кадрам», чтобы сохранить иллюстрацию.') : t('Добавьте фотографию или создайте изображение по рассказу.'));
      return frames.map(frame=>frame.file);
    },
    origins() { return frames.map(frame=>frame.origin); },
    restore(photos, origins) {
      for (const [index,file] of photos.entries()) {
        frames.push({file,url:URL.createObjectURL(file),origin:origins?.[index] ?? {type:'upload'}});
      }
      showFrames();
    },
    reset() {
      stopPending();
      discardPreview();
      for (const frame of frames) URL.revokeObjectURL(frame.url);
      frames.length=0;
      generationNumber=0;
      scene.value='';
      story='';
      orderStatus.textContent='';
      showFrames();
    }
  };
}
