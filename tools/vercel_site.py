"""Assemble the folder that is published on Vercel: the diary and two small functions.

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
    shutil.copytree(ROOT / "app", SITE / "app")
    shutil.copy2(ROOT / "index.html", SITE / "index.html")
    shutil.copytree(ROOT / "hosted" / "api", SITE / "api", ignore=shutil.ignore_patterns("__pycache__"))
    shutil.copy2(ROOT / "hosted" / "vercel.json", SITE / "vercel.json")
    shutil.copy2(ROOT / "tools" / "story_reading.py", SITE / "api" / "_story_reading.py")
    files = [path for path in SITE.rglob("*") if path.is_file() and ".vercel" not in path.parts]
    size = sum(path.stat().st_size for path in files) / 1e6
    print(f"{SITE.relative_to(ROOT)}: {len(files)} файлов, {size:.0f} МБ")


if __name__ == "__main__":
    main()
