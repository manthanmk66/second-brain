(() => {
  'use strict';

  // ---------- data ----------
  let D = window.SECOND_BRAIN || window.KOSH || { folders: [], notes: [] };
  let F = {};
  let idx = [];
  let EDIT = false;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const store = {
    get(k, d) { try { const v = localStorage.getItem('second-brain:' + k) ?? localStorage.getItem('kosh:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('second-brain:' + k, JSON.stringify(v)); } catch { /* storage off */ } },
  };
  const learned = new Set(store.get('learned', []));
  let recent = store.get('recent', []);
  const openFolders = new Set(store.get('open', []));
  const saveOpen = () => store.set('open', [...openFolders]);

  const key = (n) => n.folder + '/' + n.slug;
  const notesIn = (id) => D.notes.filter((n) => n.folder === id);
  const findNote = (folder, slug) => D.notes.find((x) => x.folder === folder && x.slug === slug);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const fmtDate = (s) => { const d = new Date(s + 'T00:00:00'); return isNaN(d) ? s : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const noteHref = (n) => `#/n/${n.folder}/${n.slug}`;

  function setData(d) {
    D = d;
    F = Object.fromEntries(D.folders.map((f) => [f.id, f]));
    idx = D.notes.map((n) => ({
      n,
      t: n.title.toLowerCase(),
      s: (n.summary || '').toLowerCase(),
      g: n.tags.join(' ').toLowerCase(),
      f: (F[n.folder] ? F[n.folder].name : '').toLowerCase(),
      x: n.text.toLowerCase(),
    }));
  }

  async function api(method, url, body, opts = {}) {
    const r = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      keepalive: !!opts.keepalive,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `${r.status} ${r.statusText}`);
    return j;
  }
  async function refresh() { setData(await api('GET', '/api/data')); }

  function migrateKey(from, to) {
    if (from === to) return;
    if (learned.delete(from)) learned.add(to);
    store.set('learned', [...learned]);
    recent = recent.map((k) => (k === from ? to : k));
    store.set('recent', recent);
  }

  // ---------- icons ----------
  const sv = (inner) => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const I = {
    neural: sv('<circle cx="5" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="12" cy="12" r="2.3"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M6.6 7.2 10.3 10.6M6.6 16.8l3.7-3.4M13.7 10.6l3.7-3.4M13.7 13.4l3.7 3.4"/>'),
    blocks: sv('<rect x="3" y="4" width="8" height="7" rx="1.6"/><rect x="13" y="4" width="8" height="7" rx="1.6"/><rect x="8" y="13" width="8" height="7" rx="1.6"/><path d="M11 7.5h2M9.5 11l1.5 2M14.5 11 13 13"/>'),
    boxes: sv('<rect x="3" y="3" width="7" height="6" rx="1.5"/><rect x="14" y="3" width="7" height="6" rx="1.5"/><rect x="8.5" y="15" width="7" height="6" rx="1.5"/><path d="M6.5 9v3h11V9M12 12v3"/>'),
    cube: sv('<path d="M12 2.8 20 7.3v9.4L12 21.2 4 16.7V7.3z"/><path d="M4 7.3 12 12l8-4.7M12 12v9.2"/>'),
    phone: sv('<rect x="6.5" y="2.5" width="11" height="19" rx="2.6"/><path d="M10.5 18.3h3"/>'),
    play: sv('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.2v5.6l4.8-2.8z"/>'),
    folder: sv('<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>'),
    book: sv('<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>'),
    code: sv('<path d="m8.5 7-5 5 5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15"/>'),
    spark: sv('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'),
    globe: sv('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.4 3.6 5.2 3.6 8.5s-1.1 6.1-3.6 8.5c-2.5-2.4-3.6-5.2-3.6-8.5S9.5 5.9 12 3.5z"/>'),
    chart: sv('<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>'),
    search: sv('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
    menu: sv('<path d="M4 7h16M4 12h16M4 17h10"/>'),
    sun: sv('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>'),
    moon: sv('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
    arrow: sv('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    back: sv('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
    check: sv('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
    clock: sv('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    cal: sv('<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
    shelf: sv('<path d="M3.5 20h17M6 20V6h3v14M11 20V4h3v16M16.3 20l-1.3-11.8 2.9-.4 1.4 12.2"/>'),
    chev: sv('<path d="m9.5 6 6 6-6 6"/>'),
    dots: sv('<circle cx="5.5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor"/>'),
    noteNew: sv('<path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z"/><path d="M13.5 3.5V9H19M12 12.5v5M9.5 15h5"/>'),
    folderNew: sv('<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M12 11v5M9.5 13.5h5"/>'),
    collapse: sv('<path d="M7 9.5 12 5l5 4.5M7 14.5l5 4.5 5-4.5"/>'),
    pencil: sv('<path d="M14.5 5.5l4 4L9 19H5v-4z"/><path d="m12.5 7.5 4 4"/>'),
    trash: sv('<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>'),
    copy: sv('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
    link: sv('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
    moveTo: sv('<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M9 13.5h6M13 11l2.5 2.5L13 16"/>'),
    text: sv('<path d="M5 6h14M5 11h14M5 16h9"/>'),
    up: sv('<path d="M12 19V5M6 11l6-6 6 6"/>'),
    down: sv('<path d="M12 5v14M6 13l6 6 6-6"/>'),
    open: sv('<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>'),
  };
  const FOLDER_ICONS = ['folder', 'book', 'neural', 'blocks', 'boxes', 'cube', 'phone', 'play', 'code', 'spark', 'globe', 'chart'];
  const PALETTE = ['#7c5cff', '#14a67c', '#e07a2e', '#2f86e0', '#e0457a', '#c99510', '#0e9aa7', '#8a6a4f', '#d14b3a', '#5b7a2e'];
  const icon = (name) => I[name] || I.folder;

  // ---------- toast + modal ----------
  function toast(msg, action, onAction) {
    let host = $('#toasts');
    if (!host) { host = document.createElement('div'); host.id = 'toasts'; host.className = 'toasts'; host.setAttribute('role', 'status'); document.body.append(host); }
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action)}</button>` : ''}`;
    host.append(t);
    const kill = () => { t.classList.add('out'); setTimeout(() => t.remove(), 250); };
    const timer = setTimeout(kill, action ? 8000 : 3500);
    if (action) t.querySelector('button').addEventListener('click', () => { clearTimeout(timer); kill(); onAction(); });
  }
  const fail = (e) => toast(e.message || 'Something went wrong');

  function modal({ title, body, confirm = 'Save', danger = false, wide = false, onOpen, onConfirm }) {
    closeMenu();
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.innerHTML = `<div class="modal-backdrop" data-close></div>
      <form class="modal-panel${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <h2>${esc(title)}</h2><div class="modal-body">${body}</div>
        <div class="modal-actions"><button type="button" class="btn ghost small" data-close>Cancel</button><button type="submit" class="btn small ${danger ? 'danger' : 'primary'}">${esc(confirm)}</button></div>
      </form>`;
    document.body.append(wrap);
    document.body.classList.add('lock');
    const close = () => { wrap.remove(); if (!document.querySelector('.modal')) document.body.classList.toggle('lock', document.body.classList.contains('drawer')); };
    wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
    wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    wrap.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try { if ((await onConfirm(wrap)) !== false) close(); } catch (err) { fail(err); }
    });
    if (onOpen) onOpen(wrap);
    const first = wrap.querySelector('textarea, input, select') || wrap.querySelector('[type=submit]');
    setTimeout(() => first && first.focus(), 20);
    return close;
  }

  // ---------- context menu ----------
  let menuEl = null;
  function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }
  function openMenu(at, items) {
    closeMenu();
    const m = document.createElement('div');
    m.className = 'menu';
    m.setAttribute('role', 'menu');
    const render = (list) => {
      m.innerHTML = list.map((it, i) => {
        if (it.sep) return '<div class="menu-sep" role="separator"></div>';
        if (it.label && it.head) return `<div class="menu-head">${esc(it.label)}</div>`;
        if (it.swatches) return `<div class="menu-swatches" role="group" aria-label="Colour">${PALETTE.map((c) => `<button type="button" class="sw${c === it.value ? ' on' : ''}" data-sw="${c}" style="--c:${c}" aria-label="Colour ${c}"></button>`).join('')}</div>`;
        if (it.icons) return `<div class="menu-icons" role="group" aria-label="Icon">${FOLDER_ICONS.map((n) => `<button type="button" class="ic${n === it.value ? ' on' : ''}" data-ic="${n}" aria-label="Icon ${n}">${icon(n)}</button>`).join('')}</div>`;
        return `<button type="button" role="menuitem" class="menu-item${it.danger ? ' danger' : ''}" data-i="${i}"${it.disabled ? ' disabled' : ''}>${it.icon ? I[it.icon] : '<span class="ico"></span>'}<span>${esc(it.label)}</span>${it.sub ? `<span class="menu-sub">${I.chev}</span>` : it.hint ? `<kbd>${esc(it.hint)}</kbd>` : ''}</button>`;
      }).join('');
      m.onclick = (e) => {
        const sw = e.target.closest('[data-sw]');
        if (sw) { const it = list.find((x) => x.swatches); closeMenu(); it.pick(sw.dataset.sw); return; }
        const ic = e.target.closest('[data-ic]');
        if (ic) { const it = list.find((x) => x.icons); closeMenu(); it.pick(ic.dataset.ic); return; }
        const b = e.target.closest('[data-i]');
        if (!b) return;
        const it = list[+b.dataset.i];
        if (it.sub) { render([{ label: '← Back', icon: 'back', run: () => render(items) }, { sep: true }, ...it.sub]); place(); focusFirst(); return; }
        if (it.run && it.keepOpen) { it.run(); return; }
        closeMenu();
        if (it.run) it.run();
      };
    };
    const focusFirst = () => { const b = m.querySelector('.menu-item:not([disabled])'); if (b) b.focus(); };
    const place = () => {
      const r = at.getBoundingClientRect ? at.getBoundingClientRect() : { left: at.x, right: at.x, top: at.y, bottom: at.y };
      const w = m.offsetWidth;
      const h = m.offsetHeight;
      let x = at.getBoundingClientRect ? r.right - w : r.left;
      let y = r.bottom + 4;
      x = Math.max(8, Math.min(x, innerWidth - w - 8));
      if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 4);
      m.style.left = x + 'px';
      m.style.top = y + 'px';
    };
    render(items);
    document.body.append(m);
    menuEl = m;
    place();
    focusFirst();
    m.addEventListener('keydown', (e) => {
      const btns = $$('.menu-item:not([disabled]), .sw, .ic', m);
      const i = btns.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (btns[i + 1] || btns[0]).focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (btns[i - 1] || btns[btns.length - 1]).focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); closeMenu(); }
    });
  }
  document.addEventListener('pointerdown', (e) => { if (menuEl && !menuEl.contains(e.target) && !e.target.closest('.tr-more')) closeMenu(); });
  window.addEventListener('resize', closeMenu);

  // ---------- explorer actions ----------
  async function act(fn, okMsg) {
    try { const r = await fn(); await refresh(); if (okMsg) toast(okMsg); return r; } catch (e) { fail(e); return null; }
  }

  function inlineInput({ container, before = null, value = '', iconHtml = '', placeholder = '', onCommit }) {
    const row = document.createElement('div');
    row.className = 'tr-row tr-editing';
    row.innerHTML = `<span class="tr-ico-sm">${iconHtml}</span><input class="tr-input" type="text" value="${esc(value)}" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder || 'Name')}">`;
    container.insertBefore(row, before);
    const input = row.querySelector('input');
    input.focus();
    input.select();
    let done = false;
    const finish = async (commit) => {
      if (done) return;
      done = true;
      const v = input.value.trim();
      if (commit && v && v !== value) { input.disabled = true; await onCommit(v); }
      row.remove();
      renderSidebar();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
    return row;
  }

  function targetFolder() {
    return (cur.folder && F[cur.folder]) ? cur.folder : (D.folders[0] && D.folders[0].id);
  }

  function newNote(folderId = targetFolder()) {
    if (!folderId) { toast('Make a folder first'); return; }
    openFolders.add(folderId); saveOpen();
    renderSidebar();
    const list = $(`.tr-folder[data-folder="${folderId}"] .tr-children`);
    if (!list) return;
    inlineInput({
      container: list, before: list.firstChild, placeholder: 'Note title', iconHtml: '<span class="tick"></span>',
      onCommit: async (title) => {
        const r = await act(() => api('POST', '/api/note', { folder: folderId, title }));
        if (r) location.hash = `#/e/${r.folder}/${r.slug}`;
      },
    });
  }

  function newFolder() {
    const tree = $('.tree');
    if (!tree) return;
    inlineInput({
      container: tree, before: tree.firstChild, placeholder: 'Folder name', iconHtml: I.folder,
      onCommit: async (name) => {
        const r = await act(() => api('POST', '/api/folder', { name }));
        if (r) { openFolders.add(r.id); saveOpen(); location.hash = `#/f/${r.id}`; renderSidebar(); }
      },
    });
  }

  function renameNote(n) {
    const row = $(`.tr-note[data-key="${CSS.escape(key(n))}"]`);
    if (!row) return;
    const list = row.parentNode;
    const before = row.nextSibling;
    row.remove();
    inlineInput({
      container: list, before, value: n.title, placeholder: 'Note title', iconHtml: '<span class="tick"></span>',
      onCommit: async (title) => {
        const r = await act(() => api('POST', '/api/note/rename', { folder: n.folder, slug: n.slug, title }));
        if (r) {
          migrateKey(key(n), `${r.folder}/${r.slug}`);
          if (cur.note === key(n)) location.hash = `#/${cur.mode === 'edit' ? 'e' : 'n'}/${r.folder}/${r.slug}`;
          else rerender();
        }
      },
    });
  }

  function renameFolder(f) {
    const row = $(`.tr-folder[data-folder="${f.id}"] > .tr-row`);
    if (!row) return;
    const label = row.querySelector('.tr-name');
    const input = document.createElement('input');
    input.className = 'tr-input';
    input.value = f.name;
    input.setAttribute('aria-label', 'Folder name');
    label.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const finish = async (commit) => {
      if (done) return;
      done = true;
      const v = input.value.trim();
      if (commit && v && v !== f.name) { await act(() => api('POST', '/api/folder/update', { id: f.id, name: v })); rerender(); }
      else renderSidebar();
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') { e.preventDefault(); finish(false); } });
    input.addEventListener('blur', () => finish(true));
  }

  async function deleteNote(n) {
    const r = await act(() => api('POST', '/api/note/delete', { folder: n.folder, slug: n.slug }));
    if (!r) return;
    if (cur.note === key(n)) location.hash = `#/f/${n.folder}`; else rerender();
    toast(`Deleted “${n.title}”`, 'Undo', async () => {
      const back = await act(() => api('POST', '/api/restore', { trash: r.trash }));
      if (back) { migrateKey(key(n), `${back.folder}/${back.slug}`); rerender(); }
    });
  }

  function deleteFolder(f) {
    const count = notesIn(f.id).length;
    modal({
      title: `Delete “${f.name}”?`,
      body: `<p>${count ? `Its ${plural(count, 'note')} go with it.` : 'The folder is empty.'} You can undo this for a few seconds afterwards, and the files stay in <code>content/.trash</code>.</p>`,
      confirm: 'Delete folder',
      danger: true,
      onConfirm: async () => {
        const r = await act(() => api('POST', '/api/folder/delete', { id: f.id }));
        if (!r) return;
        if (cur.folder === f.id) location.hash = '#/'; else rerender();
        toast(`Deleted “${f.name}”`, 'Undo', async () => { if (await act(() => api('POST', '/api/restore', { trash: r.trash }))) rerender(); });
      },
    });
  }

  function editFolderDetails(f) {
    modal({
      title: `About “${f.name}”`,
      body: `<label class="field"><span>Description</span><textarea name="blurb" rows="3" maxlength="300" placeholder="What this folder is for">${esc(f.blurb || '')}</textarea></label>
        <label class="field"><span>Coming next <small>one topic per line</small></span><textarea name="next" rows="5" placeholder="Topics you want notes on">${esc((f.next || []).join('\n'))}</textarea></label>`,
      onConfirm: async (w) => {
        const blurb = w.querySelector('[name=blurb]').value;
        const next = w.querySelector('[name=next]').value.split('\n').map((s) => s.trim()).filter(Boolean);
        if (await act(() => api('POST', '/api/folder/update', { id: f.id, blurb, next }))) rerender();
      },
    });
  }

  function moveNote(n, to) {
    if (to === n.folder) return;
    act(() => api('POST', '/api/note/move', { folder: n.folder, slug: n.slug, to })).then((r) => {
      if (!r) return;
      migrateKey(key(n), `${r.folder}/${r.slug}`);
      openFolders.add(to); saveOpen();
      toast(`Moved to ${F[to] ? F[to].name : 'folder'}`);
      if (cur.note === key(n)) location.hash = `#/${cur.mode === 'edit' ? 'e' : 'n'}/${r.folder}/${r.slug}`; else rerender();
    });
  }

  function noteMenu(n, at) {
    openMenu(at, [
      { label: 'Open', icon: 'open', run: () => { location.hash = noteHref(n); } },
      { label: 'Edit', icon: 'pencil', run: () => { location.hash = `#/e/${n.folder}/${n.slug}`; } },
      { sep: true },
      { label: 'Rename', icon: 'text', hint: 'F2', run: () => renameNote(n) },
      { label: 'Move to', icon: 'moveTo', sub: D.folders.filter((f) => f.id !== n.folder).map((f) => ({ label: f.name, icon: f.icon in I ? f.icon : 'folder', run: () => moveNote(n, f.id) })) },
      { label: 'Duplicate', icon: 'copy', run: async () => { const r = await act(() => api('POST', '/api/note/duplicate', { folder: n.folder, slug: n.slug }), 'Duplicated'); if (r) rerender(); } },
      { label: 'Copy link', icon: 'link', run: () => { navigator.clipboard && navigator.clipboard.writeText(location.origin + location.pathname + noteHref(n)).then(() => toast('Link copied'), () => {}); } },
      { sep: true },
      { label: 'Delete', icon: 'trash', danger: true, hint: '⌫', run: () => deleteNote(n) },
    ]);
  }

  function folderMenu(f, at) {
    const i = D.folders.indexOf(f);
    openMenu(at, [
      { label: 'New note here', icon: 'noteNew', run: () => newNote(f.id) },
      { sep: true },
      { label: 'Rename', icon: 'text', hint: 'F2', run: () => renameFolder(f) },
      { label: 'Description & queue', icon: 'pencil', run: () => editFolderDetails(f) },
      { label: 'Move up', icon: 'up', disabled: i === 0, run: async () => { if (await act(() => api('POST', '/api/folder/move', { id: f.id, dir: -1 }))) rerender(); } },
      { label: 'Move down', icon: 'down', disabled: i === D.folders.length - 1, run: async () => { if (await act(() => api('POST', '/api/folder/move', { id: f.id, dir: 1 }))) rerender(); } },
      { sep: true },
      { label: 'Colour', head: true },
      { swatches: true, value: f.color, pick: async (c) => { if (await act(() => api('POST', '/api/folder/update', { id: f.id, color: c }))) rerender(); } },
      { label: 'Icon', head: true },
      { icons: true, value: f.icon, pick: async (ic) => { if (await act(() => api('POST', '/api/folder/update', { id: f.id, icon: ic }))) rerender(); } },
      { sep: true },
      { label: 'Delete folder', icon: 'trash', danger: true, run: () => deleteFolder(f) },
    ]);
  }

  // ---------- views ----------
  function heroArt() {
    const xs = [-150, -90, -30, 40, 100, 160];
    const rs = [-40, 30, -20, 25, -35, 45];
    const sparks = D.folders.slice(0, 6).map((f, i) =>
      `<rect class="spark" x="-9" y="-9" width="18" height="18" rx="5" style="--c:${f.color};--d:${i}s;--x:${xs[i]}px;--r:${rs[i]}deg"/>`).join('');
    const lines = (side) => [0, 1, 2, 3, 4, 5].map((k) => {
      const y = 116 + k * 20;
      const d = side === 'l' ? `M62 ${y} C98 ${y - 6} 134 ${y - 6} 162 ${y + 2}` : `M198 ${y + 2} C226 ${y - 6} 262 ${y - 6} 298 ${y}`;
      return `<path class="ln" d="${d}" style="animation-delay:${0.25 + k * 0.09 + (side === 'r' ? 0.5 : 0)}s"/>`;
    }).join('');
    return `<svg class="book-art" viewBox="0 0 360 290" aria-hidden="true">
      <ellipse class="shadow" cx="180" cy="266" rx="150" ry="12"/>
      <path class="page" d="M180 96 C140 76 80 76 36 90 V250 C80 236 140 236 180 256 Z"/>
      <path class="page" d="M180 96 C220 76 280 76 324 90 V250 C280 236 220 236 180 256 Z"/>
      ${lines('l')}${lines('r')}
      <path class="flip" d="M180 96 C220 76 280 76 324 90 V250 C280 236 220 236 180 256 Z"/>
      <path class="spine" d="M180 96 V256"/>
      ${sparks}
    </svg>`;
  }

  function folderStats(f) {
    const list = notesIn(f.id);
    const done = list.filter((n) => learned.has(key(n))).length;
    return { list, done, pct: list.length ? Math.round((done / list.length) * 100) : 0 };
  }

  function folderCard(f, i) {
    const s = folderStats(f);
    const q = (f.next || []).length;
    return `<a class="folder-card" href="#/f/${f.id}" style="--fc:${f.color};--i:${i}">
      <span class="card-icon">${icon(f.icon)}</span>
      <h3>${esc(f.name)}</h3>
      <p>${esc(f.blurb || 'No description yet.')}</p>
      <div class="card-foot"><span>${plural(s.list.length, 'note')}${q ? ` · ${q} queued` : ''}</span><span class="meter" title="${s.pct}% learned"><i style="width:${Math.max(s.pct, s.list.length ? 4 : 0)}%"></i></span></div>
    </a>`;
  }

  function noteRow(n, i, showFolder) {
    const f = F[n.folder];
    const done = learned.has(key(n));
    const pos = notesIn(n.folder).indexOf(n) + 1;
    return `<a class="note-row" href="${noteHref(n)}" style="--fc:${f.color};--i:${i}">
      <span class="note-num${done ? ' done' : ''}">${done ? I.check : String(pos).padStart(2, '0')}</span>
      <span><h3>${esc(n.title)}</h3><p>${esc(showFolder ? f.name + (n.summary ? ' · ' + n.summary : '') : (n.summary || 'No summary yet.'))}</p></span>
      <span class="row-meta"><small>${n.minutes} min</small><span class="arrow">${I.arrow}</span></span>
    </a>`;
  }

  function ring(pct) {
    const c = 2 * Math.PI * 18;
    return `<svg class="ring" viewBox="0 0 46 46" aria-hidden="true"><circle class="track" cx="23" cy="23" r="18"/><circle class="val" cx="23" cy="23" r="18" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${c.toFixed(1)}" data-to="${(c * (1 - pct / 100)).toFixed(1)}"/></svg>`;
  }

  function home() {
    const total = D.notes.length;
    const done = D.notes.filter((n) => learned.has(key(n))).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const mins = D.notes.reduce((a, n) => a + n.minutes, 0);
    const queued = D.folders.reduce((a, f) => a + (f.next || []).length, 0);
    const resume = recent.map((k) => D.notes.find((n) => key(n) === k)).filter(Boolean).slice(0, 3);
    const firstUnread = D.notes.find((n) => !learned.has(key(n))) || D.notes[0];
    return `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Manthan's learn book</p>
        <h1>Second Brain<span class="dot">.</span></h1>
        <p class="lede">One folder per subject, one note per idea. Each note gives you a diagram, the idea in plain words, then flashcards and a quick check so it actually sticks.</p>
        <div class="hero-actions">
          ${firstUnread ? `<a class="btn primary" href="${noteHref(firstUnread)}">${done ? 'Continue learning' : 'Start the first note'} ${I.arrow}</a>` : ''}
          ${EDIT ? `<button class="btn ghost" type="button" data-action="new-note">${I.noteNew} New note</button>` : `<button class="btn ghost" type="button" data-action="search">${I.search} Search</button>`}
        </div>
      </div>
      <div class="hero-art">${heroArt()}</div>
    </section>

    <section class="stats">
      <div class="stat"><div><b>${D.folders.length}</b><span>folders</span></div></div>
      <div class="stat"><div><b>${total}</b><span>notes written</span></div></div>
      <div class="stat">${ring(pct)}<div><b>${done}</b><span>learned · ${pct}%</span></div></div>
      <div class="stat"><div><b>${queued}</b><span>topics queued</span></div></div>
    </section>

    ${resume.length ? `<section><div class="sec-head"><h2>Pick up where you left off</h2><span>recent</span></div><div class="row-list">${resume.map((n, i) => noteRow(n, i, true)).join('')}</div></section>` : ''}

    <section>
      <div class="sec-head"><h2>The shelf</h2><span>${plural(D.folders.length, 'folder')} · ${mins} min of reading</span></div>
      <div class="folder-grid">${D.folders.map(folderCard).join('')}</div>
    </section>

    <section>
      <div class="sec-head"><h2>How a note gets here</h2><span>the loop</span></div>
      <ol class="how">
        <li><b>You send a topic</b>A link, a thread, a screenshot, or just "teach me Solana rent". Or write it yourself with <b class="inline">New note</b>.</li>
        <li><b>It becomes a note</b>Each note is a markdown file in <code>content/&lt;folder&gt;/</code> with a diagram, plain-English sections, flashcards and a check.</li>
        <li><b>The site updates</b>${EDIT ? 'Edits save as you type, straight to the file.' : '<code>node build.mjs</code> folds new files in. Refresh and the note is on the shelf.'}</li>
        <li><b>You read and test</b>Flip the cards, answer the check, then mark it learned. The shelf keeps score.</li>
      </ol>
    </section>`;
  }

  function folderView(f) {
    const s = folderStats(f);
    const next = f.next || [];
    return `
    <header class="folder-head" style="--fc:${f.color}">
      <nav class="crumb"><a href="#/">Shelf</a><span>/</span><span>${esc(f.name)}</span></nav>
      <div class="fh-row">
        <span class="fh-icon">${icon(f.icon)}</span>
        <div><h1>${esc(f.name)}</h1><p>${esc(f.blurb || 'No description yet.')}</p></div>
      </div>
      <div class="fh-meta"><span>${plural(s.list.length, 'note')}</span><span>${s.done} learned</span><span class="meter"><i style="width:${s.pct}%"></i></span><span>${s.pct}%</span>
        ${EDIT ? `<span class="fh-actions"><button class="btn small primary" type="button" data-action="new-note" data-folder="${f.id}">${I.noteNew} New note</button><button class="icon-btn" type="button" data-action="folder-menu" data-folder="${f.id}" aria-label="Folder settings">${I.dots}</button></span>` : ''}</div>
      <span class="fh-blob">${icon(f.icon)}</span>
    </header>
    ${s.list.length
      ? `<div class="row-list" style="--fc:${f.color}">${s.list.map((n, i) => noteRow(n, i, false)).join('')}</div>`
      : `<div class="empty"><b>Nothing here yet</b>${EDIT ? `<p>Start the first note in ${esc(f.name)}.</p><button class="btn small primary" type="button" data-action="new-note" data-folder="${f.id}">${I.noteNew} New note</button>` : `Send a topic for ${esc(f.name)} and it lands in this folder.`}</div>`}
    ${next.length ? `<section class="queue" style="--fc:${f.color}"><div class="sec-head"><h2>Coming next</h2><span>${next.length} queued</span></div>
      <p>Topics lined up for this folder.${EDIT ? ' Tap one to start writing it.' : ' Ask for any of them and it becomes a note.'}</p>
      <ul class="queue-list">${next.map((t, i) => EDIT ? `<li style="--i:${i}"><button type="button" data-action="queue-note" data-folder="${f.id}" data-title="${esc(t)}">${esc(t)}</button></li>` : `<li style="--i:${i}">${esc(t)}</li>`).join('')}</ul></section>` : ''}`;
  }

  const tocList = (n) => n.toc.map((t) => `<li><a href="#" data-to="${t.id}" class="l${t.lv}">${esc(t.text)}</a></li>`).join('');

  function noteView(n) {
    const f = F[n.folder];
    const sib = notesIn(n.folder);
    const i = sib.indexOf(n);
    const prev = sib[i - 1];
    const next = sib[i + 1];
    const done = learned.has(key(n));
    const empty = !n.html.trim();
    return `
    <div class="note-layout" style="--fc:${f.color}">
      <article class="note">
        <nav class="crumb"><a href="#/">Shelf</a><span>/</span><a href="#/f/${f.id}" class="chip">${esc(f.name)}</a>
          ${EDIT ? `<a class="btn small ghost crumb-edit" href="#/e/${n.folder}/${n.slug}">${I.pencil} Edit</a>` : ''}</nav>
        <h1>${esc(n.title)}</h1>
        ${n.summary ? `<p class="note-summary">${esc(n.summary)}</p>` : ''}
        <div class="note-meta">
          <span>${I.clock}${n.minutes} min read</span>
          <span>${I.cal}${fmtDate(n.updated)}</span>
          ${n.tags.map((t) => `<span>#${esc(t)}</span>`).join('')}
        </div>
        ${n.toc.length > 1 ? `<details class="toc-mobile"><summary>On this page</summary><ol>${tocList(n)}</ol></details>` : ''}
        <div class="prose">${empty ? `<div class="empty"><b>This note is empty</b>${EDIT ? `<a class="btn small primary" href="#/e/${n.folder}/${n.slug}">${I.pencil} Start writing</a>` : ''}</div>` : n.html}</div>
        <div class="note-end">
          <button class="learn-toggle${done ? ' on' : ''}" type="button" data-learn="${key(n)}">
            <span class="lt-box">${I.check}</span>
            <span><b>${done ? 'Learned' : 'Mark as learned'}</b><small>${done ? 'Nice. Tap again to undo.' : 'Flip the cards first. Can you answer all of them?'}</small></span>
          </button>
          ${prev || next ? `<nav class="pager">${prev ? `<a href="${noteHref(prev)}"><small>Previous</small><span>${esc(prev.title)}</span></a>` : ''}${next ? `<a class="next" href="${noteHref(next)}"><small>Next</small><span>${esc(next.title)}</span></a>` : ''}</nav>` : ''}
        </div>
      </article>
      <aside class="toc">${n.toc.length ? `<p>On this page</p><ol>${tocList(n)}</ol>` : ''}</aside>
    </div>`;
  }

  const notFound = () => `<div class="empty" style="margin-top:40px"><b>That page isn't on the shelf</b><a href="#/">Back to the shelf</a></div>`;

  // ---------- explorer sidebar ----------
  let cur = {};
  function renderSidebar() {
    const tree = D.folders.map((f) => {
      const list = notesIn(f.id);
      const on = cur.folder === f.id;
      const isOpen = openFolders.has(f.id);
      return `<div class="tr-folder${isOpen ? ' open' : ''}${on && !cur.note ? ' on' : ''}" data-folder="${f.id}" style="--fc:${f.color}" role="treeitem" aria-expanded="${isOpen}">
        <div class="tr-row" data-drop="${f.id}">
          <button class="tr-twist" type="button" data-act="toggle" aria-label="${isOpen ? 'Collapse' : 'Expand'} ${esc(f.name)}">${I.chev}</button>
          <a class="tr-name" href="#/f/${f.id}"><span class="sf-ico">${icon(f.icon)}</span><span class="tr-label">${esc(f.name)}</span></a>
          <em class="tr-count">${list.length}</em>
          ${EDIT ? `<button class="tr-more" type="button" data-act="folder-menu" aria-label="Actions for ${esc(f.name)}">${I.dots}</button>` : ''}
        </div>
        <ul class="tr-children" role="group">${list.map((n) => {
          const k = key(n);
          const d = learned.has(k);
          return `<li class="tr-row tr-note${cur.note === k ? ' on' : ''}" data-key="${esc(k)}"${EDIT ? ' draggable="true"' : ''}>
            <a class="tr-name" href="${noteHref(n)}" title="${esc(n.title)}"><span class="tick${d ? ' done' : ''}">${d ? I.check : ''}</span><span class="tr-label">${esc(n.title)}</span></a>
            ${EDIT ? `<button class="tr-more" type="button" data-act="note-menu" aria-label="Actions for ${esc(n.title)}">${I.dots}</button>` : ''}
          </li>`;
        }).join('') || `<li class="tr-empty">${EDIT ? `<button type="button" data-action="new-note" data-folder="${f.id}">+ New note</button>` : 'No notes yet'}</li>`}</ul>
      </div>`;
    }).join('');
    const built = D.built ? new Date(D.built).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    $('#sidebar').innerHTML = `
      <a class="side-home${cur.home ? ' on' : ''}" href="#/">${I.shelf} Shelf</a>
      <div class="ex-head">
        <span>Notes</span>
        ${EDIT ? `<span class="ex-actions">
          <button class="ex-btn" type="button" data-action="new-note" title="New note" aria-label="New note">${I.noteNew}</button>
          <button class="ex-btn" type="button" data-action="new-folder" title="New folder" aria-label="New folder">${I.folderNew}</button>
          <button class="ex-btn" type="button" data-action="collapse" title="Collapse all" aria-label="Collapse all folders">${I.collapse}</button>
        </span>` : ''}
      </div>
      <div class="tree" role="tree" aria-label="Folders and notes">${tree}</div>
      <div class="side-foot">${plural(D.notes.length, 'note')} · ${learned.size} learned${EDIT ? '<br>editing on · saves to content/' : `<br>read-only · run <code>node server.mjs</code> to edit${built ? `<br>built ${built}` : ''}`}</div>`;
  }

  const sidebar = $('#sidebar');
  sidebar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    e.preventDefault();
    const folderEl = b.closest('.tr-folder');
    const noteEl = b.closest('.tr-note');
    if (b.dataset.act === 'toggle') {
      const id = folderEl.dataset.folder;
      if (openFolders.has(id)) openFolders.delete(id); else openFolders.add(id);
      saveOpen();
      folderEl.classList.toggle('open');
      folderEl.setAttribute('aria-expanded', String(openFolders.has(id)));
    } else if (b.dataset.act === 'folder-menu') folderMenu(F[folderEl.dataset.folder], b);
    else if (b.dataset.act === 'note-menu') { const [fo, sl] = noteEl.dataset.key.split('/'); noteMenu(findNote(fo, sl), b); }
  });
  sidebar.addEventListener('contextmenu', (e) => {
    if (!EDIT) return;
    const noteEl = e.target.closest('.tr-note');
    const folderRow = e.target.closest('.tr-folder > .tr-row');
    if (!noteEl && !folderRow) return;
    e.preventDefault();
    const at = { x: e.clientX, y: e.clientY };
    if (noteEl) { const [fo, sl] = noteEl.dataset.key.split('/'); noteMenu(findNote(fo, sl), at); }
    else folderMenu(F[folderRow.parentNode.dataset.folder], at);
  });
  sidebar.addEventListener('keydown', (e) => {
    if (!EDIT || e.target.tagName === 'INPUT') return;
    const noteEl = e.target.closest('.tr-note');
    const folderRow = e.target.closest('.tr-folder > .tr-row');
    if (e.key === 'F2' || (e.key === 'Enter' && e.altKey)) {
      e.preventDefault();
      if (noteEl) { const [fo, sl] = noteEl.dataset.key.split('/'); renameNote(findNote(fo, sl)); }
      else if (folderRow) renameFolder(F[folderRow.parentNode.dataset.folder]);
    } else if ((e.key === 'Delete' || (e.key === 'Backspace' && e.metaKey)) && noteEl) {
      e.preventDefault();
      const [fo, sl] = noteEl.dataset.key.split('/');
      deleteNote(findNote(fo, sl));
    }
  });
  // drag a note onto a folder to move it
  let dragKey = null;
  sidebar.addEventListener('dragstart', (e) => {
    const n = e.target.closest && e.target.closest('.tr-note');
    if (!n) return;
    dragKey = n.dataset.key;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragKey);
    n.classList.add('dragging');
  });
  sidebar.addEventListener('dragend', () => { dragKey = null; $$('.dragging, .drop-on', sidebar).forEach((x) => x.classList.remove('dragging', 'drop-on')); });
  sidebar.addEventListener('dragover', (e) => {
    if (!dragKey) return;
    const t = e.target.closest('[data-drop], .tr-folder');
    if (!t) return;
    e.preventDefault();
    $$('.drop-on', sidebar).forEach((x) => x.classList.remove('drop-on'));
    (t.matches('.tr-folder') ? t : t.closest('.tr-folder')).classList.add('drop-on');
  });
  sidebar.addEventListener('drop', (e) => {
    if (!dragKey) return;
    const fEl = e.target.closest('.tr-folder');
    if (!fEl) return;
    e.preventDefault();
    const [fo, sl] = dragKey.split('/');
    const n = findNote(fo, sl);
    if (n) moveNote(n, fEl.dataset.folder);
  });

  // ---------- router ----------
  let cleanups = [];
  function route() {
    cleanups.forEach((fn) => fn());
    cleanups = [];
    closeMenu();
    const [kind, a, b] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    cur = {};
    let html = null;
    let title = 'Second Brain';
    let note = null;
    let editor = null;
    if (!kind) { html = home(); cur.home = true; }
    else if (kind === 'f' && F[a]) { html = folderView(F[a]); title = `${F[a].name} · Second Brain`; cur.folder = a; }
    else if ((kind === 'n' || kind === 'e') && (note = findNote(a, b))) {
      cur.folder = a;
      cur.note = key(note);
      if (kind === 'e' && EDIT && (window.SecondBrainEditor || window.KoshEditor)) {
        cur.mode = 'edit';
        html = '<div id="editorMount" class="ed-loading">Opening…</div>';
        title = `Editing ${note.title} · Second Brain`;
        editor = note;
      } else {
        html = noteView(note);
        title = `${note.title} · Second Brain`;
        recent = [key(note), ...recent.filter((k) => k !== key(note))].slice(0, 8);
        store.set('recent', recent);
      }
    }
    if (cur.folder) openFolders.add(cur.folder);
    const v = $('#view');
    v.classList.remove('enter');
    void v.offsetWidth;
    v.innerHTML = html || notFound();
    v.classList.add('enter');
    document.title = title;
    document.documentElement.style.setProperty('--fc', note ? F[note.folder].color : 'var(--accent)');
    window.scrollTo(0, 0);
    renderSidebar();
    setDrawer(false);
    closeSearch();
    if (editor) {
      const f = F[editor.folder];
      const editorLib = window.SecondBrainEditor || window.KoshEditor;
      const stop = editorLib.mount($('#editorMount'), {
        folder: editor.folder,
        slug: editor.slug,
        folderName: f.name,
        color: f.color,
        api,
        ui: UI,
        onSaved: async (info) => {
          try {
            await refresh();
            // the editor was closed before its last save landed: repaint whatever is showing now
            if (info && info.unmounted && cur.mode !== 'edit') rerender(); else renderSidebar();
          } catch { /* offline */ }
        },
      });
      cleanups.push(stop);
    } else afterRender(note);
  }
  const rerender = () => route();

  function afterRender(note) {
    requestAnimationFrame(() => $$('.ring .val').forEach((c) => { c.style.strokeDashoffset = c.dataset.to; }));
    const targets = $$('.prose .dg, .prose .callout, .prose .flashcards, .prose .quiz, .prose .steps, .prose .table-wrap, .prose figure.code');
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => es.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      }), { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
      targets.forEach((t) => { if (!t.classList.contains('dg')) t.classList.add('reveal'); io.observe(t); });
      cleanups.push(() => io.disconnect());
      if (note) {
        const links = $$('.toc a');
        const spy = new IntersectionObserver((es) => es.forEach((e) => {
          if (e.isIntersecting) links.forEach((l) => l.classList.toggle('on', l.dataset.to === e.target.id));
        }), { rootMargin: '-80px 0px -70% 0px' });
        $$('.prose h2, .prose h3').forEach((h) => spy.observe(h));
        cleanups.push(() => spy.disconnect());
      }
    } else targets.forEach((t) => t.classList.add('in'));
    updateProgress();
  }

  function updateProgress() {
    const bar = $('#readProgress');
    const art = $('.note') || $('.ed-page');
    if (!art) { bar.classList.remove('show'); return; }
    bar.classList.add('show');
    const r = art.getBoundingClientRect();
    const total = Math.max(1, r.height - innerHeight + 140);
    const p = Math.min(1, Math.max(0, (60 - r.top) / total));
    bar.firstElementChild.style.transform = `scaleX(${p})`;
  }

  // ---------- drawer, theme ----------
  function setDrawer(open) {
    document.body.classList.toggle('drawer', open);
    document.body.classList.toggle('lock', open || !$('#search').hidden || !!$('.modal'));
  }
  const isDark = () => (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
  function paintTheme() { $('#themeBtn').innerHTML = isDark() ? I.sun : I.moon; }
  function toggleTheme() {
    const t = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    store.set('theme', t);
    paintTheme();
  }

  // ---------- search ----------
  let active = 0;
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function snippet(o, terms) {
    const pos = terms.map((w) => o.x.indexOf(w)).filter((p) => p >= 0).sort((a, b) => a - b)[0];
    let txt = pos == null ? o.n.summary : o.n.text.slice(Math.max(0, pos - 50), pos + 100);
    if (pos > 50) txt = '…' + txt;
    let out = esc(txt);
    terms.forEach((w) => { if (w.length > 1) out = out.replace(new RegExp(`(${reEsc(esc(w))})`, 'gi'), '<mark>$1</mark>'); });
    return out;
  }
  function runSearch(q) {
    const res = $('#results');
    q = q.trim().toLowerCase();
    active = 0;
    if (!q) {
      res.innerHTML = `<div class="sr-label">Jump to a folder</div>${D.folders.map((f) =>
        `<a class="result" href="#/f/${f.id}" style="--fc:${f.color}"><span class="r-dot"></span><span class="r-body"><b>${esc(f.name)}</b><small>${esc(f.blurb || '')}</small></span></a>`).join('')}`;
      markActive();
      return;
    }
    const terms = q.split(/\s+/);
    const hits = idx.map((o) => {
      let sc = 0;
      for (const w of terms) {
        let s = 0;
        if (o.t.includes(w)) s += 6;
        if (o.g.includes(w)) s += 4;
        if (o.f.includes(w)) s += 3;
        if (o.s.includes(w)) s += 2;
        if (o.x.includes(w)) s += 1;
        if (!s) return null;
        sc += s;
      }
      return { o, sc };
    }).filter(Boolean).sort((a, b) => b.sc - a.sc).slice(0, 12);
    res.innerHTML = hits.length
      ? `<div class="sr-label">${plural(hits.length, 'note')}</div>${hits.map(({ o }) =>
        `<a class="result" href="${noteHref(o.n)}" style="--fc:${F[o.n.folder].color}"><span class="r-dot"></span><span class="r-body"><b>${esc(o.n.title)}</b><small>${esc(F[o.n.folder].name)} · ${snippet(o, terms)}</small></span></a>`).join('')}`
      : `<div class="sr-empty">Nothing on "${esc(q)}" yet. That's a good next note.</div>`;
    markActive();
  }
  function markActive() {
    const rs = $$('#results .result');
    rs.forEach((r, i) => r.classList.toggle('active', i === active));
    if (rs[active]) rs[active].scrollIntoView({ block: 'nearest' });
  }
  function openSearch() {
    $('#search').hidden = false;
    document.body.classList.add('lock');
    const q = $('#q');
    q.value = '';
    runSearch('');
    setTimeout(() => q.focus(), 30);
  }
  function closeSearch() {
    const s = $('#search');
    if (s.hidden) return;
    s.hidden = true;
    document.body.classList.toggle('lock', document.body.classList.contains('drawer'));
  }

  // ---------- global events ----------
  document.addEventListener('click', (e) => {
    const actEl = e.target.closest('[data-action]');
    if (actEl) {
      const a = actEl.dataset.action;
      if (a === 'search') openSearch();
      else if (a === 'close-search') closeSearch();
      else if (a === 'menu') setDrawer(!document.body.classList.contains('drawer'));
      else if (a === 'close-menu') setDrawer(false);
      else if (a === 'theme') toggleTheme();
      else if (a === 'new-note') { if (window.innerWidth <= 900) setDrawer(true); newNote(actEl.dataset.folder || targetFolder()); }
      else if (a === 'new-folder') newFolder();
      else if (a === 'collapse') { openFolders.clear(); saveOpen(); renderSidebar(); }
      else if (a === 'folder-menu') folderMenu(F[actEl.dataset.folder], actEl);
      else if (a === 'queue-note') {
        const fo = actEl.dataset.folder;
        const t = actEl.dataset.title;
        act(() => api('POST', '/api/note', { folder: fo, title: t })).then(async (r) => {
          if (!r) return;
          const f = F[fo];
          await act(() => api('POST', '/api/folder/update', { id: fo, next: (f.next || []).filter((x) => x !== t) }));
          location.hash = `#/e/${r.folder}/${r.slug}`;
        });
      }
      return;
    }
    const to = e.target.closest('[data-to]');
    if (to && to.tagName === 'A') {
      e.preventDefault();
      const el = document.getElementById(to.dataset.to);
      if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      const det = to.closest('details');
      if (det) det.open = false;
      return;
    }
    const card = e.target.closest('.flash');
    if (card) {
      const on = card.classList.toggle('flipped');
      card.setAttribute('aria-pressed', String(on));
      return;
    }
    const opt = e.target.closest('.quiz-opt');
    if (opt && !opt.disabled) {
      const q = opt.closest('.quiz-q');
      $$('.quiz-opt', q).forEach((b) => { b.disabled = true; if (b.dataset.ok === '1') b.classList.add('right'); });
      if (opt.dataset.ok !== '1') opt.classList.add('wrong');
      const why = $('.quiz-why', q);
      if (why && why.textContent.trim()) why.hidden = false;
      return;
    }
    const copy = e.target.closest('.copy');
    if (copy) {
      const code = copy.closest('figure').querySelector('code').textContent;
      const done = () => { copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy'; }, 1400); };
      if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, () => {});
      return;
    }
    const lt = e.target.closest('[data-learn]');
    if (lt) {
      const k = lt.dataset.learn;
      if (learned.has(k)) learned.delete(k); else learned.add(k);
      store.set('learned', [...learned]);
      const on = learned.has(k);
      lt.classList.toggle('on', on);
      lt.querySelector('b').textContent = on ? 'Learned' : 'Mark as learned';
      lt.querySelector('small').textContent = on ? 'Nice. Tap again to undo.' : 'Flip the cards first. Can you answer all of them?';
      renderSidebar();
    }
  });

  $('#q').addEventListener('input', (e) => runSearch(e.target.value));
  $('#q').addEventListener('keydown', (e) => {
    const rs = $$('#results .result');
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(rs.length - 1, active + 1); markActive(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); markActive(); }
    else if (e.key === 'Enter' && rs[active]) { e.preventDefault(); location.hash = rs[active].getAttribute('href'); closeSearch(); }
  });
  $('#results').addEventListener('click', (e) => { if (e.target.closest('.result')) closeSearch(); });

  document.addEventListener('keydown', (e) => {
    const el = document.activeElement;
    const typing = /INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !el.isContentEditable) { e.preventDefault(); $('#search').hidden ? openSearch() : closeSearch(); }
    else if (e.key === '/' && !typing) { e.preventDefault(); openSearch(); }
    else if (e.key === 'Escape' && !$('.modal')) { closeMenu(); closeSearch(); setDrawer(false); }
    else if (EDIT && !typing && e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); newNote(); }
  });

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { updateProgress(); ticking = false; });
  }, { passive: true });
  window.addEventListener('hashchange', route);
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paintTheme); } catch { /* old Safari */ }

  const UI = { toast, modal, openMenu, closeMenu, icons: I, esc };
  window.SecondBrainUI = window.KoshUI = UI;

  // ---------- start ----------
  $$('[data-icon]').forEach((el) => { el.innerHTML = I[el.dataset.icon] || ''; });
  if (!/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) $$('.search-trigger kbd').forEach((k) => { k.textContent = 'Ctrl K'; });
  paintTheme();
  setData(D);
  (async () => {
    if (location.protocol.startsWith('http')) {
      try { setData(await api('GET', '/api/data')); EDIT = true; } catch { /* static hosting: read-only */ }
    }
    document.body.classList.toggle('can-edit', EDIT);
    route();
  })();
})();
