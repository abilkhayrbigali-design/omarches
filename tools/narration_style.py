"""Plan a Russian diary reading. Rates are relative to the selected neural voice."""

import re

# Keep each neural inference short, including entries without punctuation.
MAX_PHRASE = 220
BOUNDARY = re.compile(
    r'[.!?…]+[»”"’)\]]*(?=\s|$)|;|,(?=\s+(?:но|зато|однако|а\s+(?:потом|теперь|затем))\b)',
    re.IGNORECASE,
)
ABBREVIATION = re.compile(
    r'(?:\b(?:гг?|ул|им|просп|руб|мин|сек|см|др|пр|напр|ок|акад|проф)\.|'
    r'\bт\.\s*[екдп]\.|\b[А-ЯЁA-Z]\.)$'
)
WORDS = re.compile(r'[а-яёa-z]+', re.IGNORECASE)
FAST = re.compile(
    r'спеш|спеша|тороп|сроч|дедлайн|аврал|опазд|опозд|помча|мчал|'
    r'бежа|побеж|бегом|ускор|рывок|запых|прыг|гонял|погна|загрем|'
    r'танц|ликова|хохот|смея|смеял|весел|весёл|ура$|побед|аплод|праздн'
)
SLOW = re.compile(
    r'тих|тишин|спокой|неспеш|медлен|шепот|шёпот|шепта|шепну|молч|'
    r'стихл|утих|затих|замира|замер|замедл|останов|выдох|отдых|поко[йеюя]|уют|какао|'
    r'нежн|обня|обним|вспомин|задум|груст|печал|тоск|одиноч|'
    r'скуча|плака|плакал|устал|уснул|дрем|засып|дожд|сумерк|туман'
)
NEGATION = {'не', 'без', 'перестал', 'перестала', 'перестали'}
MODIFIER = {'так', 'очень', 'особо', 'слишком', 'сильно', 'больше', 'вовсе'}


def _short_chunks(text):
    """Prefer a clause or word boundary when breaking a long sentence."""
    while len(text) > MAX_PHRASE:
        head = text[:MAX_PHRASE]
        natural = list(re.finditer(r'[,;:—]\s+|\s+[–-]\s+', head))
        cut = natural[-1].end() if natural else 0
        if cut < MAX_PHRASE // 2:
            spaces = list(re.finditer(r'\s+', head))
            cut = spaces[-1].end() if spaces else MAX_PHRASE
        yield text[:cut].strip(), 'continuation'
        text = text[cut:].lstrip()
    if text:
        yield text, 'end'


def _phrases(text):
    result = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        start = 0
        line_parts = []
        for mark in BOUNDARY.finditer(line):
            if mark.group() == '.' and ABBREVIATION.search(line[:mark.end()]) and mark.end() < len(line):
                continue
            piece = line[start:mark.end()].strip()
            boundary = 'clause' if mark.group() in {',', ';'} else 'sentence'
            if piece:
                line_parts.append((piece, boundary))
            start = mark.end()
        if line[start:].strip():
            line_parts.append((line[start:].strip(), 'sentence'))
        for phrase, boundary in line_parts:
            for chunk, chunk_end in _short_chunks(phrase):
                result.append((chunk, boundary if chunk_end == 'end' else chunk_end))
        if result:
            result[-1] = (result[-1][0], 'paragraph')
    # Repeated fragments such as "Да! Да! Да!" are economical as one inference.
    # The punctuation within a joined phrase still guides the neural synthesizer.
    if len(result) > 80:
        grouped = []
        for phrase, boundary in result:
            if grouped and len(grouped[-1][0]) < 65 and len(grouped[-1][0]) + len(phrase) + 1 <= MAX_PHRASE:
                grouped[-1] = (grouped[-1][0] + ' ' + phrase, boundary)
            else:
                grouped.append((phrase, boundary))
        return grouped
    return result


def _energy(phrase):
    words = WORDS.findall(phrase.lower())
    score = 0
    for i, word in enumerate(words):
        value = int(bool(FAST.match(word))) - int(bool(SLOW.match(word)))
        if value:
            before = i - 1
            while before >= max(0, i - 3) and words[before] in MODIFIER:
                before -= 1
            if before >= 0 and words[before] in NEGATION:
                value = -value
            score += value
    return max(-2, min(2, score))


def plan_narration(text, mode='auto'):
    """Return ordered {text, rate, pause_ms} dicts; the final pause is zero.

    Rates above 1 are faster. Keep the selected speaker and let the acoustic
    model voice the retained question marks, quotation marks and exclamations.
    """
    if mode not in {'auto', 'neutral'}:
        raise ValueError('Неизвестный режим чтения.')
    phrases = _phrases(text)
    plan = []
    carry = 0.0
    for index, (phrase, boundary) in enumerate(phrases):
        ending = phrase.rstrip('»”"’)] ')
        timed = _energy(phrase)
        shift = .047 * timed + .013 * carry
        pause = {'continuation':75, 'clause':155, 'sentence':235, 'paragraph':385}[boundary]
        if ending.endswith(('…', '...')):
            shift -= .045
            pause += 145
        elif ending.endswith(('?', '?!', '!?')):
            shift -= .018
            pause += 55
        elif ending.endswith('!') and timed >= 0:
            shift += .035
        if mode == 'neutral':
            rate = 1.0
        else:
            rate = round(max(.88, min(1.13, 1.0 + shift)), 3)
            pause += round((1 - rate) * 530)
        if index == len(phrases) - 1:
            pause = 0
        plan.append({'text': phrase, 'rate': rate, 'pause_ms': max(0, pause)})
        carry = 0.0 if boundary == 'paragraph' else timed * .75 + carry * .25
    return plan
