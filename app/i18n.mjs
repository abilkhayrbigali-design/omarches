import {messages} from './translations.mjs';

export const languages = ['ru', 'kk', 'en'];
const locales = {ru: 'ru-RU', kk: 'kk-KZ', en: 'en-GB'};
const storageKey = 'ottisk-language';
export let language = 'ru';
try {
  const saved = typeof window !== 'undefined' && window.localStorage.getItem(storageKey);
  if (languages.includes(saved)) language = saved;
} catch { /* The browser may block storage. */ }

export function setLanguage(value) {
  if (!languages.includes(value)) return;
  language = value;
  try { if (typeof window !== 'undefined') window.localStorage.setItem(storageKey, value); } catch { /* The current page still works. */ }
}

export const locale = (value = language) => locales[value] || locales.ru;
export function inLanguage(value, key) {
  const dictionary = messages[value];
  if (!dictionary) return key;
  if (Object.hasOwn(dictionary, key)) return dictionary[key];
  const core = key.trim();
  return Object.hasOwn(dictionary, core) ? key.replace(core, () => dictionary[core]) : key;
}

// Templates allow translators to move values while keeping user content out of the message keys.
export function t(key, ...values) {
  if (!Array.isArray(key)) return inLanguage(language, String(key ?? ''));
  const message = key.reduce((text, part, index) => text + part + (index < values.length ? '$' + (index + 1) : ''), '');
  const translated = inLanguage(language, message);
  return translated.replace(/\$(\d+)/g, (slot, index) => index <= values.length ? String(values[index - 1]) : slot);
}

export function serviceMessage(message, fallback) {
  if (typeof message === 'string' && (language === 'ru' || Object.hasOwn(messages[language], message))) return t(message);
  return t(fallback);
}

export function storyLanguage(story, fallback = language) {
  const text = String(story ?? '').normalize('NFC').toLowerCase();
  const latin = text.match(/[a-z]/g)?.length ?? 0;
  const cyrillic = text.match(/\p{Script=Cyrillic}/gu)?.length ?? 0;
  if (latin > cyrillic) return 'en';
  if (/[әғқңөүұһі]/u.test(text)) return 'kk';
  const words = text.match(/\p{L}+/gu) || [];
  if (words.some(word => ['мен', 'біз', 'бүгін', 'кеше', 'болды', 'еді', 'және', 'жылы', 'жолда', 'үйге', 'досым', 'бірге', 'апам', 'жоқ'].includes(word))) return 'kk';
  if (!cyrillic || (fallback === 'kk' && words.length <= 2)) return fallback;
  return 'ru';
}

const kazakhMonths = ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым',
  'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'];

export function formatDate(date) {
  if (language === 'kk') {
    const [year, month, day] = date.split('-').map(Number);
    return `${day} ${kazakhMonths[month - 1]} ${year}`;
  }
  return new Intl.DateTimeFormat(locale(), {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'})
    .format(new Date(date + 'T12:00:00Z')).replace(/ г\.$/u, '');
}

export const numberFormat = (value, options) => Number(value).toLocaleString(locale(), options);

const staticCopy = [];
export function prepareStaticCopy(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const source = node.data.trim();
    if (!node.parentElement.closest('[translate="no"]') && /[А-Яа-яЁё]/u.test(source)) staticCopy.push([node, null, node.data]);
  }
  for (const element of root.querySelectorAll('[aria-label], [alt], [placeholder], meta[name="description"]')) {
    for (const attr of ['aria-label', 'alt', 'placeholder', 'content']) {
      const source = element.getAttribute(attr);
      if (source && /[А-Яа-яЁё]/u.test(source)) staticCopy.push([element, attr, source]);
    }
  }
}

export function localizeStaticCopy() {
  document.documentElement.lang = language;
  const selected = document.querySelector('#language');
  if (selected) selected.value = language;
  for (const [node, attr, source] of staticCopy) {
    const value = t(source);
    if (attr) node.setAttribute(attr, value);
    else node.data = value;
  }
}
