"""Pack the submission: the source archive and the archive of the whole submission folder.

    python3 tools/package.py

Run it after any change to the app or to the files in submission/. Both archives
are checked against the files on disk before the script reports success.
"""
import os
import re
import zipfile
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SUBMISSION = ROOT / "submission"
ALREADY_COMPRESSED = {".mp3", ".webp", ".woff2", ".gz", ".jpg", ".png", ".mp4", ".zip", ".pdf"}
# Never part of the sources: keys, caches, local model runtimes and editor settings.
FORBIDDEN = (".ottisk-secrets", ".claude", "__pycache__", "-runtime", "submission/")


def build(target, entries):
    temporary = target.with_suffix(".zip.tmp")
    with zipfile.ZipFile(temporary, "w") as archive:
        for path, name in entries:
            stored = path.suffix.lower() in ALREADY_COMPRESSED
            archive.write(path, name, compress_type=zipfile.ZIP_STORED if stored else zipfile.ZIP_DEFLATED)
    os.replace(temporary, target)


def verify(target, base):
    archive = zipfile.ZipFile(target)
    if archive.testzip() is not None:
        raise SystemExit(f"{target.name}: повреждённый архив")
    names = archive.namelist()
    changed = [name for name in names if zlib.crc32((base / name).read_bytes()) != archive.getinfo(name).CRC]
    if changed:
        raise SystemExit(f"{target.name}: файлы отличаются от диска: {changed}")
    return names


def main():
    sources = [ROOT / "README.md", ROOT / ".gitignore", ROOT / "server.py"]
    for folder in ("tools", "app"):
        sources += sorted(path for path in (ROOT / folder).rglob("*") if path.is_file() and "__pycache__" not in path.parts)
    source_archive = SUBMISSION / "ottisk-source.zip"
    build(source_archive, [(path, path.relative_to(ROOT).as_posix()) for path in sources])
    names = verify(source_archive, ROOT)
    unwanted = [name for name in names if any(part in name for part in FORBIDDEN)]
    text = (".py", ".mjs", ".md", ".html", ".css", ".json", ".txt")
    keys = [name for name in names if name.endswith(text) and re.search(rb"sk-[A-Za-z0-9_-]{20,}", (ROOT / name).read_bytes())]
    if unwanted or keys:
        source_archive.unlink()
        raise SystemExit(f"В исходники попало лишнее: {unwanted + keys}. Архив не создан.")

    files = sorted(path for path in SUBMISSION.rglob("*") if path.is_file())
    full_archive = ROOT / "ottisk-submission.zip"
    build(full_archive, [(path, path.relative_to(SUBMISSION).as_posix()) for path in files])
    all_names = verify(full_archive, SUBMISSION)
    megabytes = lambda path: f"{path.stat().st_size / 1e6:.0f} МБ"
    print(f"{source_archive.relative_to(ROOT)}: {len(names)} файлов, {megabytes(source_archive)}")
    print(f"{full_archive.relative_to(ROOT)}: {len(all_names)} файлов, {megabytes(full_archive)}")


if __name__ == "__main__":
    main()
