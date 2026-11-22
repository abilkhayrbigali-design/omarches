"""Assemble the public diary and the Vercel functions, including the private mood weights.

    python3 tools/vercel_site.py                      # builds .hosted/ottisk/
    npx vercel deploy --prod --yes .hosted/ottisk     # publishes it

Only the files named here are copied, so keys, local model runtimes and private
photographs cannot reach the host. The language model works on the site after
its owner adds the key to the project, in the folder .hosted/ottisk:

    npx vercel env add OPENAI_API_KEY production

and publishes again. Set a monthly budget in the OpenAI project first: the site is public.
"""
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / ".hosted" / "ottisk"


def main():
    SITE.mkdir(parents=True, exist_ok=True)
    for entry in SITE.iterdir():
        # .vercel remembers which project this folder is published to.
        if entry.name == ".vercel":
            continue
        shutil.rmtree(entry) if entry.is_dir() else entry.unlink()
    public = SITE / "public"
    shutil.copytree(ROOT / "app", public / "app")
    shutil.copy2(ROOT / "index.html", public / "index.html")
    server_model = SITE / "mood-server"
    server_model.mkdir()
    for name in ("infer.mjs", "network.mjs", "mood-text.mjs", "mood-4.json", "member-1.bin", "member-2.bin"):
        shutil.copy2(ROOT / "mood-server" / name, server_model / name)
    semantic = server_model / "semantic"
    semantic.mkdir()
    for name in ("runtime.py", "vocabulary.json.gz", "heads.npz"):
        shutil.copy2(ROOT / "mood-server" / "semantic" / name, semantic / name)
    shutil.copy2(ROOT / "mood-server" / "semantic" / "requirements.txt", SITE / "requirements.txt")
    server_app = SITE / "app"
    (server_app / "model").mkdir(parents=True)
    for name in ("own-model.mjs", "feelings.mjs", "story-scene.mjs", "i18n.mjs", "translations.mjs", "context.mjs", "context-signs.mjs", "context-page.mjs", "context-spelling.mjs", "model/mood-3.json", "model/mood-3.bin"):
        shutil.copy2(ROOT / "app" / name, server_app / name)
    shutil.copytree(ROOT / "hosted" / "api", SITE / "api", ignore=shutil.ignore_patterns("__pycache__"))
    shutil.copy2(ROOT / "hosted" / "vercel.json", SITE / "vercel.json")
    shutil.copy2(ROOT / "tools" / "story_reading.py", SITE / "api" / "_story_reading.py")
    files = [path for path in SITE.rglob("*") if path.is_file() and ".vercel" not in path.parts]
    size = sum(path.stat().st_size for path in files) / 1e6
    print(f"{SITE.relative_to(ROOT)}: {len(files)} файлов, {size:.0f} МБ")


if __name__ == "__main__":
    main()
