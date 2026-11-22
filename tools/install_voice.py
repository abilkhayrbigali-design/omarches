"""Install the official Silero Russian TTS model and a CPU-only runtime locally."""
import hashlib
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import wave

from neural_voice import MODEL, PYTHON, READY, RUNTIME, SAMPLE_RATE

MODEL_URL = 'https://models.silero.ai/models/tts/ru/v5_6_ru.pt'
MODEL_SHA256 = '04cc9b1d08ce38bcaa9d02c488d80d3e6806d17f7eaa7c95982f36a3cbf50b2e'
MODEL_BYTES = 147_664_410
CPU_INDEX = 'https://download.pytorch.org/whl/cpu'
LINUX_WHEEL = ('https://download-r2.pytorch.org/whl/cpu/'
               'torch-2.8.0%2Bcpu-cp311-cp311-manylinux_2_28_x86_64.whl'
               '#sha256=cb06175284673a581dd91fb1965662ae4ecaba6e5c357aa0ea7bb8b84b6b7eeb')


def compatible_python():
    if sys.version_info[:2] in [(3, 11), (3, 12), (3, 13), (3, 10)]:
        return sys.executable
    for name in ('python3.11', 'python3.12', 'python3.13', 'python3.10'):
        if executable := shutil.which(name):
            return executable
    raise SystemExit('Для озвучки установите Python 3.10–3.13 с модулем venv.')


def install_runtime():
    if not PYTHON.is_file():
        subprocess.run([compatible_python(), '-m', 'venv', str(PYTHON.parent.parent)], check=True)
    if subprocess.run([str(PYTHON), '-c', 'from num2words import num2words'], capture_output=True).returncode:
        subprocess.run([str(PYTHON), '-m', 'pip', 'install', '--disable-pip-version-check',
                        '--index-url', 'https://pypi.org/simple', 'num2words==0.5.14'], check=True)
    check = 'import torch; assert torch.__version__.split("+")[0] == "2.8.0"'
    if subprocess.run([str(PYTHON), '-c', check], capture_output=True).returncode == 0:
        return
    args = [str(PYTHON), '-m', 'pip', 'install', '--disable-pip-version-check', '--no-cache-dir',
            '--only-binary=:all:']
    py = subprocess.check_output([str(PYTHON), '-c', 'import sys;print(sys.version_info.minor)'], text=True).strip()
    if sys.platform.startswith('linux') and platform.machine() == 'x86_64' and py == '11':
        args += ['--index-url', 'https://pypi.org/simple', LINUX_WHEEL]
    elif sys.platform == 'darwin':
        args += ['--index-url', 'https://pypi.org/simple', 'torch==2.8.0']
    else:
        args += ['--index-url', CPU_INDEX, 'torch==2.8.0']
    subprocess.run(args, check=True)


def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda:stream.read(1024*1024), b''):
            result.update(chunk)
    return result.hexdigest()


def install_model():
    if MODEL.is_file() and MODEL.stat().st_size == MODEL_BYTES and digest(MODEL) == MODEL_SHA256:
        return
    print('Загружаем модель Silero v5_6_ru…', flush=True)
    with tempfile.TemporaryDirectory(dir=RUNTIME) as temp:
        target = Path(temp)/'model.pt'
        with urllib.request.urlopen(MODEL_URL, timeout=120) as response, target.open('wb') as output:
            for chunk in iter(lambda:response.read(1024*1024), b''):
                output.write(chunk)
                if output.tell() > MODEL_BYTES:
                    raise ValueError('Размер загруженной модели превышает ожидаемый.')
        if target.stat().st_size != MODEL_BYTES or digest(target) != MODEL_SHA256:
            raise ValueError('Не совпала контрольная сумма файла весов.')
        os.replace(target, MODEL)


if __name__ == '__main__':
    RUNTIME.mkdir(exist_ok=True)
    install_runtime()
    install_model()
    # Perform a real inference before announcing availability to the diary server.
    sample = '[[[{"text":"Я помню этот день.","rate":1.0,"pause_ms":0}],"baya"]]'
    with tempfile.TemporaryDirectory(dir=RUNTIME) as temp:
        subprocess.run([str(PYTHON), str(Path(__file__).with_name('neural_voice.py')), temp],
                       input=sample.encode(), check=True, timeout=90)
        with wave.open(str(Path(temp)/'0.wav'),'rb') as audio:
            if audio.getframerate()!=SAMPLE_RATE or audio.getnframes() < SAMPLE_RATE//3:
                raise RuntimeError('Не удалось проверить звук новой голосовой модели.')
    (RUNTIME/'NOTICE.txt').write_text(
        'Silero TTS v5_6_ru by Silero Team. Original model, used locally.\n'
        'Model license: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International.\n'
        'https://github.com/snakers4/silero-models/blob/v5.6/LICENSE\n'
        'https://creativecommons.org/licenses/by-nc-sa/4.0/\n'
        'https://github.com/snakers4/silero-models\n' + MODEL_URL + '\nSHA-256: ' + MODEL_SHA256 + '\n',
        encoding='utf-8')
    READY.touch()
    print('Пять голосов Silero установлены. Откройте дневник через python3 server.py.')
