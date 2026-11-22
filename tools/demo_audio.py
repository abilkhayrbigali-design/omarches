"""Build the sample soundtracks and the day-specific neural narration."""
from pathlib import Path
import argparse
import json
import math
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
RATE = 24000
HARMONY = {
    "maple": (55, [0, 5, 9, 7], [0, 7, 12, 16, 19, 16, 12, 7], .52),
    "office": (41, [0, 0, 3, 1], [0, 12, 7, 12, 0, 15, 7, 12], .18),
    "train": (57, [0, 4, 7, 2], [0, 7, 12, 16, 19, 24, 16, 12], .41),
    "rain": (48, [0, 3, 8, 5], [0, 7, 12, 15, 19, 15, 12, 7], .57),
    "lake": (50, [0, 7, 5, 3], [0, 7, 12, 14, 19, 24, 14, 7], .58),
    "cake": (50, [0, 5, 9, 7], [0, 12, 7, 16, 19, 12, 16, 24], .23),
}


def encode(samples, target):
    import numpy as np

    data = (np.clip(samples, -1, 1)*32767).astype("<i2")
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "s16le",
                    "-ar", str(RATE), "-ac", "2", "-i", "-", "-codec:a", "libmp3lame",
                    "-b:a", "112k", str(target)], input=data.tobytes(), check=True)


def soundtrack(day_id, bpm, target):
    import numpy as np

    root, steps, melody, decay = HARMONY[day_id]
    per_beat = 60 / bpm
    beats = math.ceil(33 / (per_beat * 4)) * 4
    rng = np.random.default_rng(sum(map(ord, day_id)))
    mix = np.zeros((int((beats * per_beat+2)*RATE), 2))

    def add(start, signal, level, pan):
        pos = round(start*RATE)
        take = min(len(signal), len(mix)-pos)
        if take > 0:
            mix[pos:pos+take] += signal[:take, None] * np.array([1-pan, pan]) * level

    def note(start, midi, length, level, pan, bass=False):
        t = np.arange(round(length*RATE))/RATE
        phase = 2*np.pi*440*2**((midi-69)/12)*t
        env = (1-np.exp(-t*145))*np.exp(-t/(decay*(1.7 if bass else 1)))
        harmonics = np.sin(phase) + .18*np.sin(phase*2.01) + .08*np.sin(phase*3.98)
        add(start, env*harmonics, level, pan)

    fast = day_id in {"office", "cake"}
    minor = day_id in {"office", "rain"}
    for beat in range(beats):
        start = beat * per_beat
        shift = steps[(beat//8) % len(steps)]
        interval = melody[beat % len(melody)]
        if minor and interval % 12 == 4:
            interval -= 1
        note(start, root + shift + interval, 1.5, .27 if beat%4==0 else .21, .32 if beat%2 else .65)
        if beat % 4 == 0:
            note(start, root+shift-12, 2.0, .37 if fast else .25, .5, bass=True)
        if fast or beat % 4 == 2:
            t = np.arange(int(RATE * .14))/RATE
            click = rng.uniform(-1,1,len(t))*np.exp(-t*(38 if fast else 27))
            add(start+(0 if fast else .025), click, .19 if fast else .13, .46)
        if fast:
            note(start+per_beat*.5, root+shift+12+(beat%4)*3, .45, .13, .56)
    for echo, gain in [(int(RATE*.23), .16), (int(RATE*.37), .09)]:
        mix[echo:] += mix[:-echo, ::-1]*gain
    pad = int(RATE*.06)
    tail = int(RATE*1.5)
    mix[:pad] *= np.linspace(0,1,pad)[:,None]
    mix[-tail:] *= np.linspace(1,0,tail)[:,None]
    encode(mix,target)


def render_narrations(days):
    # Also support direct invocation as python3 tools/demo_audio.py.
    sys.path.insert(0, str(ROOT))
    from tools.narration_style import plan_narration
    from tools.neural_voice import synthesize_batch, voices

    media = ROOT / "app" / "media"
    tracks = [(ROOT / "app" / day["narration"], day["story"], day["narrationVoice"]) for day in days]
    sample = "Мы вышли к озеру. Как тихо стало вокруг! Я до сих пор помню этот вечер."
    samples = media / "voice-samples"
    samples.mkdir(exist_ok=True)
    for item in voices():
        voice = item["id"]
        tracks.append((samples / (voice + ".mp3"), sample, voice))
    speeches = synthesize_batch([(plan_narration(text), voice) for _, text, voice in tracks])
    with tempfile.TemporaryDirectory(dir=media) as temporary:
        staged = []
        for (destination, _, _), speech in zip(tracks, speeches):
            target = Path(temporary) / destination.name
            subprocess.run([
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                "-f", "wav", "-i", "pipe:0", "-codec:a", "libmp3lame",
                "-b:a", "112k", str(target)
            ], input=speech, check=True)
            staged.append((target, destination))
        for target, destination in staged:
            target.replace(destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--voices-only", action="store_true",
                        help="rebuild narration and comparison samples without regenerating the music")
    args = parser.parse_args()
    source = 'import {demos} from "./app/demos.mjs"; console.log(JSON.stringify(demos));'
    days = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", source], cwd=ROOT))
    render_narrations(days)
    if not args.voices_only:
        for day in days:
            target = ROOT / "app" / day["music"]["source"]
            soundtrack(day["id"], day["music"]["analysis"]["bpm"], target)


if __name__ == "__main__":
    main()
