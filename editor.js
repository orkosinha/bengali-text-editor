'use strict';
const el = (id) => document.getElementById(id);
const editor = el('source');
const bn = /[\u0964\u0965\u0980-\u09ff\u200c\u200d]/g;
const reference =
  /<!--[^]*?(?:-->|$)|<(script|style)\b[^>]*>[^]*?(?:<\/\1\s*>|$)|&#(x[\da-f]+|\d+);/gi;
let raw = '';
let original = raw,
  originalBytes,
  charset = 'utf-8',
  bom = [],
  newline = '\n';
let entities = true,
  visible,
  offsets;
function bengaliReference(digits) {
  if (!digits) return '';
  const code = Number(digits.replace(/^x/i, '0x'));
  if (code > 0xffff) return '';
  const letter = String.fromCharCode(code);
  return letter.match(bn) ? letter : '';
}
function usesBengaliReferences(text) {
  for (const match of text.matchAll(reference)) {
    if (bengaliReference(match[2])) return true;
  }
  return false;
}
function project() {
  offsets = new Map();
  let removed = 0;
  visible =
    el('mode').value === 'raw'
      ? raw
      : raw.replace(reference, (match, tag, digits, index) => {
          const letter = bengaliReference(digits);
          if (!letter) return match;
          removed += match.length - 1;
          offsets.set(index + match.length - removed, removed);
          return letter;
        });
}
function position(index) {
  let removed = 0;
  for (const [end, count] of offsets) {
    if (end > index) break;
    removed = count;
  }
  return index + removed;
}
let past = [],
  future = [];
const highlight = el('highlight');
const lineMirror = el('line-mirror');
let numberedLines = [];
let highlightTimer;

function updateLineNumbers() {
  const lines = editor.disabled ? [] : editor.value.split('\n');
  let start = 0;
  let oldEnd = numberedLines.length;
  let end = lines.length;
  while (start < end && lines[start] === numberedLines[start]) start++;
  while (
    oldEnd > start &&
    end > start &&
    numberedLines[oldEnd - 1] === lines[end - 1]
  ) {
    oldEnd--;
    end--;
  }
  const rows = lineMirror.children;
  for (let i = oldEnd - 1; i >= start; i--) rows[i].remove();
  if (end > start) {
    const fragment = document.createDocumentFragment();
    for (let i = start; i < end; i++) {
      const row = document.createElement('div');
      row.textContent = lines[i];
      fragment.append(row);
    }
    lineMirror.insertBefore(fragment, rows[start] || null);
  }
  numberedLines = lines;
  editor
    .closest('.source-area')
    .style.setProperty(
      '--digits',
      String(Math.max(2, String(lines.length).length)),
    );
}

function syncHighlight() {
  highlight.style.width = editor.clientWidth + 'px';
  highlight.style.height = editor.clientHeight + 'px';
  lineMirror.style.width = editor.clientWidth + 'px';
  lineMirror.style.transform = 'translateY(' + -editor.scrollTop + 'px)';
  highlight.scrollTop = editor.scrollTop;
  highlight.scrollLeft = editor.scrollLeft;
}
editor.addEventListener('scroll', syncHighlight);
new ResizeObserver(syncHighlight).observe(editor);

function scheduleHighlight() {
  clearTimeout(highlightTimer);
  editor.classList.remove('highlighted');
  if (editor.disabled || !editor.value) {
    highlight.replaceChildren();
    return;
  }
  highlightTimer = setTimeout(async () => {
    try {
      await loadScript('vendor/highlight.js');
      if (editor.disabled || !editor.value) return;
      highlight.innerHTML = SourceHighlight.markup(editor.value) + '\n';
      syncHighlight();
      editor.classList.add('highlighted');
    } catch {
      highlight.replaceChildren();
    }
  }, 80);
}

function render() {
  updateLineNumbers();
  scheduleHighlight();
  active?.element?.classList.toggle('dirty', raw !== original);
  el('undo').disabled = !past.length;
  el('redo').disabled = !future.length;
  el('status').textContent = raw !== original ? 'Unsaved changes' : '';
  el('lines').textContent = editor.disabled
    ? ''
    : numberedLines.length + ' lines';
  el('encoding').textContent = editor.disabled
    ? ''
    : charset.toUpperCase() +
      (entities ? ' · Numeric Bengali references' : ' · Unicode Bengali');
  scheduleReview();
}
function stepHistory(from, to) {
  const edit = from.pop();
  if (!edit) return;
  const { at, remove, add } = edit;
  to.push({ at, remove: add, add: remove });
  raw = raw.slice(0, at) + add + raw.slice(at + remove.length);
  refresh();
  let caret = at + add.length;
  for (const [end, removed] of offsets) {
    if (end + removed > at + add.length) break;
    caret = at + add.length - removed;
  }
  editor.setSelectionRange(caret, caret);
  editor.focus();
}
el('undo').onclick = () => stepHistory(past, future);
el('redo').onclick = () => stepHistory(future, past);
editor.onkeydown = (event) => {
  if ((!event.metaKey && !event.ctrlKey) || event.altKey || event.isComposing)
    return;
  const key = event.key.toLowerCase();
  if (!['z', 'y'].includes(key)) return;
  event.preventDefault();
  el(key === 'y' || event.shiftKey ? 'redo' : 'undo').click();
};
editor.onbeforeinput = (event) => {
  if (
    !event.cancelable ||
    !['historyUndo', 'historyRedo'].includes(event.inputType)
  )
    return;
  event.preventDefault();
  el(event.inputType === 'historyUndo' ? 'undo' : 'redo').click();
};
function refresh() {
  project();
  editor.value = visible;
  render();
}
editor.oninput = () => {
  const value = editor.value;
  let start = 0,
    oldEnd = visible.length,
    end = value.length;
  while (start < oldEnd && start < end && visible[start] === value[start])
    start++;
  while (
    oldEnd > start &&
    end > start &&
    visible[oldEnd - 1] === value[end - 1]
  ) {
    oldEnd--;
    end--;
  }
  let insert = value.slice(start, end);
  if (entities && el('mode').value === 'read')
    insert = insert.replace(bn, (c) => '&#' + c.charCodeAt(0) + ';');
  const at = position(start),
    until = position(oldEnd);
  past.push({ at, remove: insert, add: raw.slice(at, until) });
  future.length = 0;
  raw = raw.slice(0, at) + insert + raw.slice(until);
  project();
  if (visible !== value) editor.value = visible;
  render();
};
const composer = el('phonetic');
const roman = el('roman');
const toggle = el('phonetic-toggle');
function clearComposition() {
  roman.value = '';
  el('bangla').value = '';
  el('insert').disabled = true;
}
function closeComposition() {
  clearComposition();
  composer.hidden = true;
  toggle.setAttribute('aria-expanded', 'false');
}
toggle.onclick = async () => {
  await loadScript('vendor/avro/avro-lib.js');
  if (!composer.hidden) {
    closeComposition();
    editor.focus();
    return;
  }
  composer.hidden = false;
  toggle.setAttribute('aria-expanded', 'true');
  roman.focus();
};
roman.oninput = () => {
  el('bangla').value = OmicronLab.Avro.Phonetic.parse(roman.value);
  el('insert').disabled = !el('bangla').value;
};
composer.onkeydown = (event) => {
  if (event.key === 'Escape' && !event.isComposing) {
    closeComposition();
    editor.focus();
  }
};
composer.onsubmit = (event) => {
  event.preventDefault();
  const text = el('bangla').value;
  if (!text) return;
  editor.focus();
  editor.setRangeText(text, editor.selectionStart, editor.selectionEnd, 'end');
  editor.dispatchEvent(new Event('input'));
  clearComposition();
  roman.focus();
};
el('mode').onchange = () => {
  closeComposition();
  toggle.disabled = el('mode').value === 'raw';
  refresh();
};
let latestOpen = 0;
const documents = new Map();
let active = null;

function remember() {
  if (!active) return;
  Object.assign(active, {
    raw,
    original,
    originalBytes,
    charset,
    bom,
    newline,
    entities,
    past,
    future,
    tab,
    pageURL,
    published,
    comparison: el('published-url').value,
    mode: el('mode').value,
    selection: [editor.selectionStart, editor.selectionEnd],
    scroll: editor.scrollTop,
    draft: roman.value,
    composing: !composer.hidden,
  });
}

function paintTabs() {
  const list = el('documents');
  list.replaceChildren();
  for (const doc of documents.values()) {
    const item = document.createElement('div');
    item.className = 'file-tab';
    const button = document.createElement('button');
    button.textContent = doc.name;
    button.title = doc.path;
    button.setAttribute('aria-current', String(doc === active));
    item.classList.toggle(
      'dirty',
      doc === active ? raw !== original : doc.raw !== doc.original,
    );
    button.onclick = () => activate(doc);
    const close = document.createElement('button');
    close.className = 'close-tab';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Close ' + doc.name);
    close.onclick = () => closeDocument(doc);
    item.append(button, close);
    list.append(item);
    doc.element = item;
  }
  el('name').hidden = !!active;
  active?.element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function activate(doc) {
  latestOpen++;
  if (doc === active) return;
  remember();
  active = doc;
  closeComposition();
  window.archiveTree?.mount(doc.group);
  resetReview(doc.url, doc.live ? doc.published : null);
  ({
    raw,
    original,
    originalBytes,
    charset,
    bom,
    newline,
    entities,
    past,
    future,
    tab,
    pageURL,
    published,
  } = doc);
  el('published-url').value = doc.comparison;
  el('published-link').href = pageURL;
  el('mode').value = doc.mode;
  editor.disabled = el('mode').disabled = el('save').disabled = false;
  toggle.disabled = doc.mode === 'raw';
  if (doc.composing) {
    composer.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    roman.value = doc.draft;
    roman.oninput();
  }
  el('name').textContent = doc.name;
  refresh();
  editor.setSelectionRange(...doc.selection);
  editor.scrollTop = doc.scroll;
  paintTabs();
  if (tab !== 'preview' && published === null) loadPublished();
}

function closeDocument(doc) {
  const dirty = doc === active ? raw !== original : doc.raw !== doc.original;
  if (dirty && !confirm('Discard unsaved changes to ' + doc.name + '?')) return;
  const order = [...documents.values()];
  const neighbor =
    order[order.indexOf(doc) + 1] || order[order.indexOf(doc) - 1];
  documents.delete(doc.key);
  if (doc !== active) return paintTabs();
  active = null;
  if (neighbor) return activate(neighbor);
  beginFolder();
}

function beginFolder() {
  latestOpen++;
  remember();
  active = null;
  raw = original = '';
  originalBytes = undefined;
  past = [];
  future = [];
  editor.disabled =
    toggle.disabled =
    el('mode').disabled =
    el('save').disabled =
      true;
  closeComposition();
  resetReview(null);
  refresh();
  el('name').textContent = 'Select a page';
  paintTabs();
  return true;
}
function decodePage(bytes) {
  const prefix = new TextDecoder('windows-1252').decode(bytes.slice(0, 4096));
  const declared = prefix.match(
    /<meta\b[^>]*?charset\s*=\s*["']?\s*([\w.-]+)/i,
  )?.[1];
  const signature =
    bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191 ? 3 : 0;
  let label = signature ? 'utf-8' : declared || 'utf-8';
  if (!signature && !declared) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      label = 'windows-1252';
    }
  }
  const decoder = new TextDecoder(label, { fatal: true });
  if (!['utf-8', 'windows-1252'].includes(decoder.encoding))
    throw Error('Unsupported encoding: ' + label);
  const text = decoder.decode(bytes);
  return { text, charset: decoder.encoding, signature };
}
async function openDocument(
  file,
  liveURL = null,
  localPath = file?.webkitRelativePath?.split('/').slice(1).join('/'),
  group = liveURL ? window.archiveTree?.live : window.archiveTree?.context,
) {
  if (!file) return;
  const path = localPath || file.name;
  const key = liveURL
    ? liveURL.split('#')[0]
    : JSON.stringify([group?.id, path]);
  if (documents.has(key)) return activate(documents.get(key));
  const request = ++latestOpen;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (request !== latestOpen) return;
    const decoded = decodePage(bytes);
    const text = decoded.text.replace(/\r\n?/g, '\n');
    const url =
      liveURL ||
      new URL(path.split('/').map(encodeURIComponent).join('/'), archiveHome)
        .href;
    const doc = {
      key,
      group,
      path: liveURL || path,
      name: file.name,
      url,
      live: !!liveURL,
      raw: text,
      original: text,
      originalBytes: bytes,
      charset: decoded.charset,
      bom: bytes.slice(0, decoded.signature),
      newline: decoded.text.match(/\r\n|\r|\n/)?.[0] || '\n',
      entities:
        decoded.charset !== 'utf-8' || usesBengaliReferences(text),
      past: [],
      future: [],
      tab: 'preview',
      pageURL: url,
      comparison: url,
      published: liveURL ? text : null,
      mode: el('mode').value,
      selection: [0, 0],
      scroll: 0,
    };
    documents.set(key, doc);
    activate(doc);
  } catch (error) {
    alert('Could not open file. ' + error.message);
  }
}
el('save').onclick = () => {
  let bytes = originalBytes;
  if (!bytes || raw !== original) {
    const text = raw.replace(/\n/g, newline);
    if (charset === 'utf-8') bytes = new Blob([new Uint8Array(bom), text]);
    else {
      const lookup = new Map();
      const decoder = new TextDecoder(charset);
      for (let n = 0; n < 256; n++)
        lookup.set(decoder.decode(Uint8Array.of(n)), n);
      const out = [];
      for (const c of text) {
        if (!lookup.has(c)) {
          alert(
            'This character cannot be saved in the file encoding: ' +
              c +
              '. Use a numeric HTML reference.',
          );
          return;
        }
        out.push(lookup.get(c));
      }
      bytes = Uint8Array.from(out);
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes], { type: 'text/html' }));
  a.download = el('name').textContent;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  originalBytes = bytes;
  original = raw;
  active?.element?.classList.remove('dirty');
  el('status').textContent = 'Downloaded';
};
window.onbeforeunload = (event) => {
  if (
    raw !== original ||
    [...documents.values()].some(
      (doc) => doc !== active && doc.raw !== doc.original,
    )
  ) {
    event.preventDefault();
    event.returnValue = '';
  }
};
