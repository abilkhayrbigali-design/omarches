"""Score audit JSON lines with the exact server inference code."""
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "mood-server" / "semantic"))
from runtime import classify_many  # noqa: E402

rows = [json.loads(line) for line in sys.stdin if line.strip()]
for i in range(0, len(rows), 32):
    batch = rows[i:i + 32]
    names, scores = classify_many([row["focus"] for row in batch])
    for row, score in zip(batch, scores, strict=True):
        print(json.dumps({"lang": row["lang"], "index": row["index"], "lead": names[score.argmax()]}))
