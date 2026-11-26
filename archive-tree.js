import { FileTree } from '@pierre/trees';

const panel = document.getElementById('archive');
const search = document.getElementById('chapter-search');
const openButton = document.getElementById('open-chapter');
let tree, entries, root, source, selected, context;
let nextFolder = 0;
const live = {
  id: 'live',
  name: 'Live archive',
  kind: 'live',
  items: new Map(),
};
const htmlPage = /\.html?$/i;

function mount(group) {
  if (!group || group === context) return;
  const { name, kind, items } = group;
  context = group;
  tree?.cleanUp();
  entries = items;
  root = group.root;
  source = kind;
  selected = [];
  openButton.textContent = 'Open selected page';
  openButton.disabled = true;
  if (kind !== 'live' || !matchMedia('(max-width:700px)').matches)
    setExplorer(true);
  panel.hidden = false;
  panel.open = true;
  document.getElementById('folder-name').textContent = name;
  search.value = '';
  tree = new FileTree({
    paths: [...items.keys()],
    initialExpansion: 'closed',
    onSelectionChange(paths) {
      selected = paths.filter(
        (path) => entries.has(path) && entries.get(path).kind !== 'directory',
      );
      openButton.disabled = !selected.length;
      openButton.textContent =
        selected.length > 1
          ? 'Open ' + selected.length + ' pages'
          : 'Open selected page';
      const item = entries.get(paths[0]);
      if (paths.length === 1 && item?.kind === 'directory')
        expand(paths[0], item);
    },
  });
  tree.render({ containerWrapper: document.getElementById('chapter-tree') });
  if (kind === 'handles')
    tree.subscribe(() => {
      const path = tree.getFocusedPath();
      const item = entries.get(path);
      if (item?.kind === 'directory' && tree.getItem(path)?.isExpanded())
        expand(path, item);
    });
}

function add(items) {
  const changes = [];
  for (const [path, item] of items) {
    if (entries.has(path)) continue;
    entries.set(path, item);
    changes.push({ type: 'add', path });
  }
  if (changes.length) tree.batch(changes);
}

const pending = new WeakSet();
async function expand(path, handle) {
  if (pending.has(handle)) return;
  pending.add(handle);
  const current = tree;
  try {
    const items = await listFolder(handle, path);
    if (tree === current) add(items);
    else pending.delete(handle);
  } catch (error) {
    pending.delete(handle);
    if (tree === current) notice(error.message);
  }
}
async function listFolder(handle, prefix) {
  const items = new Map();
  for await (const child of handle.values()) {
    if (child.kind === 'directory') items.set(prefix + child.name + '/', child);
    else if (htmlPage.test(child.name)) items.set(prefix + child.name, child);
  }
  return items;
}
async function showHandle(handle) {
  const items = await listFolder(handle, '');
  if (!beginFolder()) return;
  mount({
    id: ++nextFolder,
    name: handle.name,
    kind: 'handles',
    items,
    root: handle,
  });
}
function showFiles(files) {
  const items = new Map();
  let name;
  for (const file of files) {
    if (!htmlPage.test(file.name)) continue;
    const [folder, ...parts] = file.webkitRelativePath.split('/');
    if (!parts.length) continue;
    name = folder;
    items.set(parts.join('/'), file);
  }
  if (!items.size) return notice('This folder contains no HTML pages.');
  if (beginFolder()) mount({ id: ++nextFolder, name, kind: 'files', items });
}
function discover(urls) {
  if (source !== 'live') mount(live);
  const paths = new Map();
  for (const url of urls) {
    const { pathname, search } = new URL(url);
    const path =
      pathname.slice(1) + (pathname.endsWith('/') ? 'index.html' : '') + search;
    paths.set(path, url.split('#')[0]);
  }
  add(paths);
}
async function localFile(path) {
  const item = entries?.get(path);
  if (source === 'files') return item;
  if (!root) return;
  if (item?.kind === 'file') return item.getFile();
  const parts = path.split('/');
  let dir = root;
  try {
    for (const part of parts.slice(0, -1))
      dir = await dir.getDirectoryHandle(part);
    return await (await dir.getFileHandle(parts.at(-1))).getFile();
  } catch (error) {
    if (error.name !== 'NotFoundError' && error.name !== 'TypeMismatchError')
      throw error;
  }
}
search.oninput = () => tree.setSearch(search.value || null);
openButton.onclick = async () => {
  try {
    const group = context;
    for (const path of selected) {
      if (context !== group) break;
      if (source === 'live') {
        await openLive(entries.get(path));
        continue;
      }
      const file = await localFile(path);
      if (file && context === group)
        await openDocument(file, null, path, group);
    }
  } catch (error) {
    notice(error.message);
  }
};

window.archiveTree = {
  showHandle,
  showFiles,
  discover,
  localFile,
  mount,
  live,
  get context() {
    return context;
  },
};
