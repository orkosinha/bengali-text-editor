'use strict';
const archiveHome = 'https://www.ramakrishnavivekananda.info/';
const scripts = new Map();
let documentURL,
  liveDocument = false;
let tab = 'preview',
  pageURL,
  published,
  reviewTimer,
  revision = 0;
function loadScript(src) {
  if (!scripts.has(src))
    scripts.set(
      src,
      new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => {
          scripts.delete(src);
          reject(Error('Could not load ' + src));
        };
        document.head.append(script);
      }),
    );
  return scripts.get(src);
}
function notice(message) {
  el('notice').hidden = !message;
  el('notice').textContent = message;
}
function archiveURL(value, base = archiveHome) {
  const url = new URL(value, base);
  if (
    url.origin !== new URL(archiveHome).origin ||
    url.username ||
    url.password
  )
    throw Error('Choose an HTTPS page on www.ramakrishnavivekananda.info.');
  return url.href;
}
const staticSite = location.hostname.endsWith('.github.io') || location.protocol === 'file:';
class ArchiveUnavailable extends Error {}
async function download(url) {
  let response;
  try {
    response = staticSite
      ? await fetch(url, {credentials:'omit'})
      : await fetch('./api/archive?url=' + encodeURIComponent(url));
  } catch (error) {
    if (staticSite) throw new ArchiveUnavailable('The browser could not read the published HTML. Use Open original to view it.');
    throw error;
  }
  const type = staticSite ? 'text/html' : 'application/octet-stream';
  if (!response.ok || !response.headers.get('content-type')?.startsWith(type)) {
    throw Error('The archive did not return an HTML page for this address.');
  }
  return new Uint8Array(await response.arrayBuffer());
}
const browserDialog = el('published-browser');
function browsePublished(url) {
  notice('');
  el('live-form').hidden = true;
  el('visit-original').href = url;
  browserDialog.querySelector('iframe').src = url;
  browserDialog.showModal();
}
browserDialog.onclose = () => browserDialog.querySelector('iframe').removeAttribute('src');
async function openLive(value) {
  const request = ++latestOpen;
  const start = raw;
  try {
    const url = archiveURL(value);
    const existing = documents.get(url.split('#')[0]);
    if (existing) {
      activate(existing);
      el('live-form').hidden = true;
      return;
    }
    notice('Loading published page…');
    const bytes = await download(url);
    if (request !== latestOpen || start !== raw) return;
    notice('');
    const name = decodeURIComponent(
      new URL(url).pathname.split('/').pop() || 'index.html',
    );
    await loadScript('vendor/pierre/archive-tree.js');
    if (request !== latestOpen || start !== raw) return;
    await openDocument(new File([bytes], name), url);
    el('live-form').hidden = true;
  } catch (error) {
    if (request !== latestOpen) return;
    if (error instanceof ArchiveUnavailable) browsePublished(archiveURL(value));
    else notice(error.message);
  }
}
el('browse').onclick = () => {
  el('live-form').hidden = !el('live-form').hidden;
  if (!el('live-form').hidden) el('live-url').focus();
};
el('live-form').onsubmit = (event) => {
  event.preventDefault();
  openLive(el('live-url').value);
};
el('open-folder').onclick = async () => {
  if (!window.showDirectoryPicker) return el('folder').click();
  try {
    const handle = await window.showDirectoryPicker();
    await loadScript('vendor/pierre/archive-tree.js');
    await window.archiveTree.showHandle(handle);
  } catch (error) {
    if (error.name === 'SecurityError') el('folder').click();
    else if (error.name !== 'AbortError') notice(error.message);
  }
};
el('folder').onchange = async () => {
  try {
    await loadScript('vendor/pierre/archive-tree.js');
    window.archiveTree.showFiles(el('folder').files);
  } catch (error) {
    notice(error.message);
  } finally {
    el('folder').value = '';
  }
};
function resetReview(url, baseline = null) {
  revision++;
  el('diff').replaceChildren();
  documentURL = pageURL = url;
  document.querySelector('.panes').hidden = !url;
  el('start').hidden = Boolean(url);
  el('location').textContent = url ? new URL(url).pathname : 'No open document';
  el('switch-pane').hidden = !url;
  showMobileReview(false);
  if (compact.matches) setExplorer(!url && !el('archive').hidden);
  liveDocument = baseline !== null;
  published = baseline;
  tab = 'preview';
  el('published-url').value = url || '';
  el('published-link').href = url || archiveHome;
  notice('');
  for (const button of document.querySelectorAll('[data-tab]'))
    button.disabled = !url;
}
async function loadPublished() {
  const request = ++revision;
  try {
    const url = archiveURL(el('published-url').value);
    notice('Loading comparison…');
    const bytes = await download(url);
    if (request !== revision) return;
    pageURL = url;
    published = decodePage(bytes).text.replace(/\r\n?/g, '\n');
    el('published-link').href = url;
    notice('');
    showReview();
  } catch (error) {
    if (request === revision) notice(error.message);
  }
}
el('reload').onclick = loadPublished;
for (const button of document.querySelectorAll('[data-tab]'))
  button.onclick = async () => {
    tab = button.dataset.tab;
    showReview();
    if (tab !== 'preview' && published === null) await loadPublished();
  };
function scheduleReview() {
  clearTimeout(reviewTimer);
  reviewTimer = setTimeout(showReview, 100);
}
async function showReview() {
  const comparing = tab !== 'preview';
  const diffing = tab === 'diff';
  for (const button of document.querySelectorAll('[data-tab]'))
    button.setAttribute('aria-pressed', String(button.dataset.tab === tab));
  el('review-tools').hidden = !comparing;
  el('preview').hidden = diffing;
  el('diff').hidden = !diffing;
  el('pane-status').textContent = {
    preview: 'Edited preview',
    live: 'Published page',
    diff: 'Published → edited HTML',
  }[tab];
  if (diffing) {
    await loadScript('vendor/diff.js');
    if (tab !== 'diff') return;
    const output = el('diff');
    output.replaceChildren();
    if (published == null) return;
    if (published === raw) {
      output.textContent = 'No changes.';
      return;
    }
    const parts = TextDiff.diffLines(published, raw, { timeout: 200 });
    if (!parts) {
      output.textContent = 'Too many changes to compare interactively.';
      return;
    }
    for (const part of parts) {
      const block = document.createElement('pre');
      block.className = part.added ? 'added' : part.removed ? 'removed' : '';
      block.textContent = part.value
        .split(/(?<=\n)/)
        .map((line) => (part.added ? '+ ' : part.removed ? '- ' : '  ') + line)
        .join('');
      output.append(block);
    }
    return;
  }
  renderPreview(comparing ? published || '' : raw);
}
async function followPage(url) {
  try {
    if (!liveDocument && tab === 'preview') {
      const path =
        decodeURIComponent(url.pathname.slice(1)) +
        (url.pathname.endsWith('/') ? 'index.html' : '');
      const file = await window.archiveTree?.localFile(path);
      if (file) return openDocument(file, null, path);
    }
    await openLive(url.href);
  } catch (error) {
    notice(error.message);
  }
}

function editAt(rawOffset) {
  showMobileReview(false);
  if (document.fullscreenElement === reviewPane) document.exitFullscreen();
  if (reviewPane.classList.contains('is-fullscreen')) exitExpandedPane();
  const index = visiblePosition(rawOffset);
  editor.focus();
  editor.setSelectionRange(index, index);
  const prefix = visible.slice(0, index);
  const row = lineMirror.children[prefix.split('\n').length - 1];
  if (!row?.firstChild) return;
  const caret = document.createRange();
  caret.setStart(row.firstChild, index - prefix.lastIndexOf('\n') - 1);
  caret.collapse(true);
  editor.scrollTop +=
    caret.getBoundingClientRect().top -
    editor.getBoundingClientRect().top -
    editor.clientHeight / 3;
}

function renderPreview(source) {
  const template = document.createElement('template');
  const editable = tab === 'preview' && !editor.disabled;
  const base = tab === 'preview' ? documentURL : pageURL;
  const pages = new Set();
  if (liveDocument && base) pages.add(base);
  // Mark text runs before the HTML parser decodes character references.
  const markup =
    /<!--[\s\S]*?(?:-->|$)|<(script|style|textarea|title)\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?(?:<\/\1\s*>|$)|<(?:!|\/?[a-z])(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
  const marker = 'source-offset:';
  template.innerHTML = editable
    ? '<!--' +
      marker +
      '0-->' +
      source.replace(
        markup,
        (tag, _, at) => tag + '<!--' + marker + (at + tag.length) + '-->',
      )
    : source;
  const positions = new WeakMap();
  const allowed = new Set(
    'div section article header footer main p span h1 h2 h3 h4 h5 h6 br hr b big small strong i em ol ul li blockquote pre table thead tbody tr td th a img center sup sub font'.split(
      ' ',
    ),
  );
  const doc = el('preview').contentDocument;
  const fragment = doc.createDocumentFragment();
  function copy(node, parent) {
    if (node.nodeType === 3) {
      const text = doc.createTextNode(node.data);
      parent.append(text);
      const previous = node.previousSibling;
      if (
        editable &&
        previous?.nodeType === 8 &&
        previous.data.startsWith(marker)
      ) {
        positions.set(text, Number(previous.data.slice(marker.length)));
      }
      return;
    }
    if (
      node.nodeType !== 1 ||
      /^(script|style|title|noscript|template|iframe|object|svg)$/i.test(
        node.localName,
      )
    )
      return;
    if (allowed.has(node.localName)) {
      const element = doc.createElement(node.localName);
      parent.append(element);
      parent = element;
      if (node.id) element.id = node.id;
      if (node.localName === 'a' && node.hasAttribute('href')) {
        try {
          element.href = archiveURL(
            node.getAttribute('href'),
            base || archiveHome,
          );
          const url = new URL(element.href);
          if (
            liveDocument &&
            tab === 'preview' &&
            /(?:\.html?|\/)$/i.test(url.pathname)
          )
            pages.add(url.href);
        } catch {}
      }
      if (node.localName === 'img') {
        element.alt = node.getAttribute('alt') || '';
        try {
          element.src = archiveURL(
            node.getAttribute('src'),
            base || archiveHome,
          );
        } catch {}
      }
    }
    for (const child of node.childNodes) copy(child, parent);
  }
  for (const child of template.content.childNodes) copy(child, fragment);
  if (pages.size && liveDocument && tab === 'preview')
    window.archiveTree?.discover(pages);
  doc.body.replaceChildren(fragment);
  doc.body.onclick = (event) => {
    const link = event.target.closest('a[href]');
    if (!link) {
      if (!editable || source !== raw || !doc.getSelection().isCollapsed)
        return;
      const caret = doc.caretPositionFromPoint?.(event.clientX, event.clientY);
      const range = caret
        ? null
        : doc.caretRangeFromPoint?.(event.clientX, event.clientY);
      const text = caret?.offsetNode || range?.startContainer;
      const start = positions.get(text);
      if (start === undefined) return;
      const offset = caret?.offset ?? range.startOffset;
      let index = start;
      const decoder = doc.createElement('textarea');
      const refs = /&(?:#(?:x[\da-f]+|\d+)|[a-z][\da-z]*);/iy;
      for (let i = 0; i < offset; i++) {
        if (source[index] === '&') {
          refs.lastIndex = index;
          const match = refs.exec(source);
          if (match) {
            decoder.innerHTML = match[0];
            index += match[0].length;
            i += decoder.value.length - 1;
            continue;
          }
        }
        index++;
      }
      editAt(index);
      return;
    }
    event.preventDefault();
    const url = new URL(link.href);
    if (url.hash && url.href.split('#')[0] === base?.split('#')[0]) {
      doc
        .getElementById(decodeURIComponent(url.hash.slice(1)))
        ?.scrollIntoView();
    } else followPage(url);
  };
}
const frame = el('preview').contentDocument;
const style = frame.createElement('style');
style.textContent =
  '@font-face{font-family:Bengali;src:url("' +
  new URL('fonts/NotoSerifBengali.woff2', location.href).href +
  '")}body{margin:1.5rem;font:17px/1.7 Georgia,Bengali,serif;overflow-wrap:anywhere;color:#242731}img{max-width:100%;height:auto}a{color:#385fa8}';
frame.head.append(style);
const divider = el('divider');
const panes = divider.parentElement;
const compact = matchMedia(
  '(max-width: 760px), (max-width: 960px) and (max-height: 520px)',
);
function showMobileReview(show) {
  panes.classList.toggle('show-review', show);
  el('switch-pane').textContent = show ? 'Edit source' : 'Preview';
}
el('switch-pane').onclick = () =>
  showMobileReview(!panes.classList.contains('show-review'));
function resize(value) {
  const percent = Math.min(80, Math.max(20, value));
  panes.style.setProperty('--split', percent + '%');
  divider.setAttribute('aria-valuenow', String(Math.round(percent)));
  divider.setAttribute('aria-orientation', 'vertical');
}
resize(50);
compact.onchange = () => setExplorer(!compact.matches);
divider.onpointerdown = (event) => {
  divider.setPointerCapture(event.pointerId);
  panes.classList.add('resizing');
};
divider.onlostpointercapture = () => panes.classList.remove('resizing');
divider.onpointermove = (event) => {
  if (!divider.hasPointerCapture(event.pointerId)) return;
  const box = panes.getBoundingClientRect();
  resize((100 * (event.clientX - box.left)) / box.width);
};
divider.onkeydown = (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key))
    return;
  event.preventDefault();
  resize(
    Number(divider.getAttribute('aria-valuenow')) +
      (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -5 : 5),
  );
};
function setExplorer(open) {
  const drawer = compact.matches && open;
  el('explorer').hidden = !open;
  el('drawer-backdrop').hidden = !drawer;
  document.querySelector('.workspace').inert = drawer;
  el('explorer-toggle').setAttribute('aria-expanded', String(open));
}
function closeDrawer() {
  setExplorer(false);
  el('explorer-toggle').focus();
}
el('drawer-backdrop').onclick = closeDrawer;
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !el('drawer-backdrop').hidden) closeDrawer();
});
el('explorer-toggle').onclick = () => setExplorer(el('explorer').hidden);
for (const button of document.querySelectorAll('[data-action]')) {
  button.onclick = () => el(button.dataset.action).click();
}
const reviewPane = el('review-pane');
const fullButton = el('fullscreen');
function syncFullscreen() {
  const active =
    document.fullscreenElement === reviewPane ||
    reviewPane.classList.contains('is-fullscreen');
  fullButton.setAttribute('aria-pressed', String(active));
  fullButton.setAttribute(
    'aria-label',
    active ? 'Exit full screen' : 'Full screen',
  );
  fullButton.title = fullButton.getAttribute('aria-label');
}
function exitExpandedPane() {
  reviewPane.classList.remove('is-fullscreen');
  syncFullscreen();
  fullButton.focus();
}
fullButton.onclick = async () => {
  if (document.fullscreenElement === reviewPane)
    return document.exitFullscreen();
  if (reviewPane.classList.contains('is-fullscreen')) return exitExpandedPane();
  try {
    await reviewPane.requestFullscreen();
  } catch {
    reviewPane.classList.add('is-fullscreen');
  }
  syncFullscreen();
};
document.addEventListener('fullscreenchange', syncFullscreen);
function escapeExpandedPane(event) {
  if (event.key === 'Escape' && reviewPane.classList.contains('is-fullscreen'))
    exitExpandedPane();
}
document.addEventListener('keydown', escapeExpandedPane);
frame.addEventListener('keydown', escapeExpandedPane);
setExplorer(!compact.matches);
resetReview(null);
refresh();
