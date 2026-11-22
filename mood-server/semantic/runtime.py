"""Private server inference for Ottisk's multilingual primary-mood classifier."""
import gzip
import hashlib
import json
import os
import re
import shutil
from collections import Counter
from functools import lru_cache
from pathlib import Path
from threading import Lock
from urllib.request import urlopen
import numpy as np

MODEL = "ottisk-mood-5"
ROOT = Path(__file__).resolve().parent
CACHE = Path(os.environ.get("OTTISK_E5_DIR", "/tmp/ottisk-e5"))
CHECKPOINT = "https://huggingface.co/Xenova/multilingual-e5-small/resolve/761b726/"
ARTIFACTS = {
    "model.onnx": ("onnx/model_quantized.onnx", "f80102d3f2a1229f387d3c81909990d8945513e347b0eab049f7de3c6f98c193"),
    "tokenizer.json": ("tokenizer.json", "0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39"),
}
FOLD = str.maketrans("әғқңөүұһіё", "агкноуухие")
SEMANTIC_BLEND = .48
PAIR_WEIGHTS = [.22, .22, .22, .22, .06, .06]
LOCK = Lock()


def artifact(name):
    CACHE.mkdir(parents=True, exist_ok=True)
    target = CACHE / name
    if target.is_file():
        return target
    source, expected = ARTIFACTS[name]
    temporary = CACHE / f"{name}.{os.getpid()}.part"
    try:
        with urlopen(CHECKPOINT + source, timeout=32) as response, temporary.open("wb") as stream:
            shutil.copyfileobj(response, stream)
        with temporary.open("rb") as stream:
            if hashlib.file_digest(stream, "sha256").hexdigest() != expected:
                raise ValueError("Mood encoder checksum mismatch")
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)
    return target


@lru_cache(maxsize=1)
def load_encoder():
    import onnxruntime
    from tokenizers import Tokenizer

    settings = onnxruntime.SessionOptions()
    settings.intra_op_num_threads = 4
    settings.inter_op_num_threads = 1
    encoder = onnxruntime.InferenceSession(
        str(artifact("model.onnx")), sess_options=settings, providers=["CPUExecutionProvider"]
    )
    tokenizer = Tokenizer.from_file(str(artifact("tokenizer.json")))
    tokenizer.enable_padding(pad_id=1, pad_token="<pad>")
    tokenizer.enable_truncation(max_length=128)
    return encoder, tokenizer


def embed(texts):
    # Serialize cold initialization. Warm requests can run the read-only session together.
    with LOCK:
        encoder, tokenizer = load_encoder()
    tokens = tokenizer.encode_batch(["query: " + text for text in texts])
    ids = np.array([token.ids for token in tokens], dtype=np.int64)
    mask = np.array([token.attention_mask for token in tokens], dtype=np.int64)
    values = encoder.run(None, {
        "input_ids": ids, "attention_mask": mask, "token_type_ids": np.zeros_like(ids)
    })[0]
    if values.ndim == 3:
        values = (values * mask[..., None]).sum(1) / mask.sum(1)[:, None]
    return values / np.maximum(1e-10, np.linalg.norm(values, axis=1, keepdims=True))


def grams(text, analyzer):
    text = text.lower()
    if analyzer == "word":
        words = re.findall(r"\b\w\w+\b", text)
        yield from words
        yield from (" ".join(words[i:i + 2]) for i in range(len(words) - 1))
        return
    text = re.sub(r"\s\s+", " ", text)
    if analyzer == "char":
        for size in range(2, 6):
            yield from (text[i:i + size] for i in range(len(text) - size + 1))
        return
    for word in text.split():
        padded = " " + word + " "
        for size in range(2, 6):
            yield from (padded[i:i + size] for i in range(max(1, len(padded) - size + 1)))
            if size >= len(padded):
                break


def softmax(values):
    exponential = np.exp(values - values.max(axis=-1, keepdims=True))
    return exponential / exponential.sum(axis=-1, keepdims=True)


@lru_cache(maxsize=1)
def heads():
    with gzip.open(ROOT / "vocabulary.json.gz", "rt", encoding="utf-8") as fh:
        meta = json.load(fh)
    with np.load(ROOT / "heads.npz", allow_pickle=False) as file:
        arrays = {key: file[key] for key in file.files}
    return meta, arrays


def classify_many(texts):
    meta, arrays = heads()
    vectors = embed(texts)
    semantic = sum(softmax(vectors @ arrays[f"e{i}_coef"].T + arrays[f"e{i}_intercept"]) for i in range(3)) / 3
    lexical = np.zeros_like(semantic)
    for i, (profile, ratio) in enumerate(zip(meta["lex"], PAIR_WEIGHTS)):
        vocab, idf = profile["vocab"], arrays[f"l{i}_idf"]
        coefficients, intercept = arrays[f"l{i}_coef"], arrays[f"l{i}_intercept"]
        logits = []
        for text in texts:
            if profile["fold"]:
                text = text.lower().translate(FOLD)
            counts = Counter(vocab[gram] for gram in grams(text, profile["analyzer"]) if gram in vocab)
            indices = list(counts)
            weights = (1 + np.log(list(counts.values()))) * idf[indices]
            norm = np.linalg.norm(weights)
            logits.append(intercept + (coefficients[:, indices] @ weights / norm if norm else 0))
        lexical += ratio * softmax(np.asarray(logits) * 4)
    return meta["classes"], SEMANTIC_BLEND * semantic + (1 - SEMANTIC_BLEND) * lexical


def classify(text):
    labels, scores = classify_many([text])
    return {label: float(score) for label, score in zip(labels, scores[0])}
