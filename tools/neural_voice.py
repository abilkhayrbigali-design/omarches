"""Generate Russian diary narration locally with an isolated Silero CPU worker."""
import array
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import wave
import warnings
from xml.sax.saxutils import escape

RUNTIME = Path(__file__).resolve().parents[1] / '.voice-runtime'
PYTHON = RUNTIME / 'venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
MODEL = RUNTIME / 'v5_6_ru.pt'
MODEL_NAME = 'Silero TTS v5_6_ru'
READY = RUNTIME / '.silero-v5_6_ru-ready'
SAMPLE_RATE = 24_000
VOICES = [
    {'id':'baya', 'name':'Бая', 'description':'Женский голос'},
    {'id':'aidar', 'name':'Айдар', 'description':'Мужской голос'},
    {'id':'kseniya', 'name':'Ксения', 'description':'Женский голос'},
    {'id':'xenia', 'name':'Ксения II', 'description':'Женский голос'},
    {'id':'eugene', 'name':'Евгений', 'description':'Мужской голос'},
]


def available():
    return READY.is_file() and PYTHON.is_file() and MODEL.is_file()


def voices():
    return list(VOICES)


def synthesize(parts, voice):
    return synthesize_batch([(parts, voice)])[0]


def synthesize_batch(jobs):
    """Produce each track in order, loading the model once for the batch."""
    jobs = list(jobs)
    if not 1 <= len(jobs) <= 64:
        raise ValueError('Выберите от одной до 64 дорожек.')
    for parts, voice in jobs:
        if voice not in {item['id'] for item in VOICES}:
            raise ValueError('Выберите доступный голос.')
        if not isinstance(parts,list) or not parts:
            raise ValueError('Добавьте текст для чтения.')
        if not all(isinstance(p,dict) and isinstance(p.get('text'),str)
                   and isinstance(p.get('rate'),(int,float)) and .5 <= p['rate'] <= 1.5
                   and isinstance(p.get('pause_ms'),int) and 0 <= p['pause_ms'] <= 5000 for p in parts):
            raise ValueError('Неверные параметры чтения.')
        if sum(len(p['text']) for p in parts) > 6500 or not any(p['text'].strip() for p in parts):
            raise ValueError('Для озвучки нужен текст длиной до 6000 знаков.')
    if not available():
        raise RuntimeError('Установите русскую модель озвучки.')
    try:
        with tempfile.TemporaryDirectory(prefix='ottisk-narration-') as temp:
            subprocess.run([str(PYTHON), str(Path(__file__).resolve()), temp],
                           input=json.dumps(jobs).encode(), stdout=subprocess.DEVNULL,
                           stderr=subprocess.PIPE, check=True, timeout=min(600, 150 * len(jobs)))
            return [(Path(temp) / f'{i}.wav').read_bytes() for i in range(len(jobs))]
    except (subprocess.SubprocessError, OSError) as error:
        raise RuntimeError('Не удалось озвучить текст на устройстве. Проверьте установку речевой модели.') from error


def trim_and_encode(samples):
    """Keep a small margin of room tone at each edge before adding planned pauses."""
    import torch
    sound = samples.detach().flatten().cpu()
    voiced = torch.nonzero(sound.abs() > .003, as_tuple=True)[0]
    if not voiced.numel():
        return b''
    margin = SAMPLE_RATE // 30
    start = max(0, int(voiced[0])-margin)
    stop = min(sound.numel(), int(voiced[-1])+margin+1)
    data = array.array('h', (sound[start:stop].clamp(-1, 1)*32767).round().short().tolist())
    if sys.byteorder != 'little':
        data.byteswap()
    return data.tobytes()


def spoken_text(text):
    """The Russian acoustic model expects Cyrillic words and spelled-out numbers."""
    from num2words import num2words
    text = re.sub(r'[\x00-\x08\x0b-\x0c\x0e-\x1f*]', ' ', text)
    # Numerals in running text and, especially, digit-only entries should be audible.
    def number(match):
        digits = match.group()
        if len(digits) > 12 or (len(digits) > 1 and digits.startswith('0')):
            return ' '.join(num2words(int(d), lang='ru') for d in digits)
        return num2words(int(digits), lang='ru')

    text = re.sub(r'[0-9]+', number, text)
    names = 'эй би си ди и эф джи эйч ай джей кей эл эм эн оу пи кью ар эс ти ю ви дабл-ю икс уай зи'.split()
    alphabet = dict(zip('abcdefghijklmnopqrstuvwxyz', names))
    return re.sub(r'[A-Za-z]+', lambda m: ' '.join(alphabet[c] for c in m.group().lower()), text)


def render_track(model, parts, voice, path):
    has_audio = False
    with wave.open(str(path), 'wb') as out:
        out.setparams((1, 2, SAMPLE_RATE, 0, 'NONE','not compressed'))
        for part in parts:
            # Escaping user text keeps the SSML controls exclusive to the local planner.
            text = spoken_text(part['text'])
            if not re.search(r'[а-яё]', text, re.IGNORECASE):
                continue
            rate = round(100*part['rate'])
            speech = f'<speak><prosody rate="{rate}%">{escape(text)}</prosody></speak>'
            samples = model.apply_tts(ssml_text=speech, speaker=voice, sample_rate=SAMPLE_RATE)
            pcm = trim_and_encode(samples)
            if pcm:
                has_audio = True
                out.writeframesraw(pcm)
                out.writeframesraw(bytes(2 * SAMPLE_RATE * part['pause_ms'] // 1000))
    if not has_audio:
        raise ValueError('В тексте отсутствуют слова для чтения.')


def worker(directory, jobs):
    # This path uses native torch tensors and stdlib WAV encoding.
    warnings.filterwarnings('ignore', message='Failed to initialize NumPy.*', category=UserWarning)
    import torch
    torch.set_num_threads(min(4, os.cpu_count() or 1))
    torch.set_num_interop_threads(1)
    model = torch.package.PackageImporter(str(MODEL)).load_pickle('tts_models', 'model')
    model.to(torch.device('cpu'))
    if any(voice['id'] not in model.speakers for voice in VOICES):
        raise RuntimeError('Неподдерживаемая версия речевой модели.')
    with torch.inference_mode():
        for index, (parts, voice) in enumerate(jobs):
            render_track(model, parts, voice, directory / f'{index}.wav')


if __name__ == '__main__':
    worker(Path(sys.argv[1]), json.load(sys.stdin))
