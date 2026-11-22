"""Fit Ottisk's primary mood head, using only the training split.

Run prepare-primary.mjs first. The public E5 checkpoint is frozen.
"""
from collections import Counter
from pathlib import Path
import argparse
import gzip
import json
import sys
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression, RidgeClassifier

REPO = Path(__file__).resolve().parents[2]
DESTINATION = REPO / "mood-server" / "semantic"
sys.path.insert(0, str(DESTINATION))
from runtime import FOLD, embed  # noqa: E402

parser = argparse.ArgumentParser()
parser.add_argument("training_jsonl", type=Path)
args = parser.parse_args()
rows = [json.loads(line) for line in args.training_jsonl.read_text().splitlines()]
labels = np.asarray([row["label"] for row in rows])
texts = [row["text"] for row in rows]
focused = np.asarray([row["group"] == "focused" for row in rows])
gap = np.clip([row["gap"] for row in rows], .05, 1)
freq = Counter(row["lang"] for row in rows)
language_weight = np.asarray([1 / freq[row["lang"]] ** .45 for row in rows])
language_weight /= language_weight.mean()


def weights(multiplier):
    return language_weight * np.where(focused, multiplier, gap)


metadata = {"classes": np.unique(labels).tolist(), "lex": [], "training": len(rows)}
arrays = {}
for analyzer in ("char_wb", "char", "word"):
    for fold in (False, True):
        i = len(metadata["lex"])
        vectorizer = TfidfVectorizer(analyzer=analyzer, ngram_range=(1, 2) if analyzer == "word" else (2, 5),
                                    min_df=2, sublinear_tf=True)
        training = vectorizer.fit_transform([text.lower().translate(FOLD) for text in texts] if fold else texts)
        model = RidgeClassifier(alpha=.30).fit(training, labels, sample_weight=weights(4))
        metadata["lex"].append({"analyzer": analyzer, "fold": fold,
                                "vocab": {feature: int(index) for feature,index in vectorizer.vocabulary_.items()}})
        arrays[f"l{i}_idf"] = vectorizer.idf_.astype(np.float32)
        arrays[f"l{i}_coef"] = model.coef_.astype(np.float32)
        arrays[f"l{i}_intercept"] = model.intercept_.astype(np.float32)

vectors = np.asarray([vector for i in range(0, len(texts), 32) for vector in embed(texts[i:i+32])], dtype=np.float32)
for i, multiplier in enumerate((1, 4, 10)):
    model = LogisticRegression(C=15, max_iter=300).fit(vectors, labels, sample_weight=weights(multiplier))
    arrays[f"e{i}_coef"] = model.coef_.astype(np.float32)
    arrays[f"e{i}_intercept"] = model.intercept_.astype(np.float32)

with (DESTINATION / "vocabulary.json.gz").open("wb") as raw:
    with gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as fh:
        fh.write(json.dumps(metadata, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
np.savez_compressed(DESTINATION / "heads.npz", **arrays)
print(f"Trained primary mood classifier with {len(rows)} entries.")
