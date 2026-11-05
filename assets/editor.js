/* Second Brain editor — a Medium/Confluence-style writing surface that saves to markdown.
 * window.SecondBrainEditor.mount(el, { folder, slug, folderName, color, api, ui, onSaved }) → cleanup()
 */
(() => {
  'use strict';
  const mdLib = window.SecondBrainMD || window.KoshMD;
  const { md, esc } = mdLib;

  const LABEL = { flashcards: 'Flashcards', quiz: 'Quiz', steps: 'Steps', table: 'Table', html: 'Diagram / HTML' };
  const TEMPLATES = {
    flashcards: '```flashcards\nQ: First question?\nA: Its answer.\nQ: Second question?\nA: Its answer.\n```',
    quiz: '```quiz\n? The question\n- A wrong answer\n+ The right answer\n- Another wrong answer\n= Why the right answer is right.\n```',
    steps: '```steps\nFirst step :: What happens here.\nSecond step :: What happens next.\n```',
    table: '| Column | Column |\n|---|---|\n| Cell | Cell |\n| Cell | Cell |',
    html: '<figure class="dg"><svg viewBox="0 0 420 120" role="img" aria-label="Describe the diagram">\n<rect class="box hot" x="20" y="34" width="140" height="52" rx="10"/><text x="90" y="65" text-anchor="middle" class="b">Input</text>\n<path class="flow" d="M164 60 H252"/>\n<rect class="box" x="256" y="34" width="140" height="52" rx="10"/><text x="326" y="65" text-anchor="middle" class="b">Output</text>\n</svg><figcaption>What the diagram shows.</figcaption></figure>',
  };
  const HELP = {
    flashcards: 'One card per pair: a line starting <code>Q:</code>, then a line starting <code>A:</code>.',
    quiz: '<code>?</code> the question · <code>+</code> the right answer · <code>-</code> wrong answers · <code>=</code> why.',
    steps: 'One step per line: <code>Title :: what happens</code>.',
    table: 'Pipe table. The first row is the header; the second row is the <code>---</code> divider.',
    html: 'Inline SVG or HTML. Diagram classes: <code>box</code>, <code>box hot</code>, <code>flow</code>, <code>bar</code>, <code>pop</code>; text classes <code>b</code>, <code>m</code>, <code>s</code>. Blank lines are removed.',
  };
  const CALLOUT = { tip: 'Tip', note: 'Note', warn: 'Watch out', idea: 'Idea' };
  const BLOCKS = [
    { id: 'p', label: 'Text', hint: 'Plain paragraph', glyph: '¶', kw: 'text paragraph plain' },
    { id: 'h2', label: 'Heading', hint: 'Section title · ##', glyph: 'H2', kw: 'heading title h2 section' },
    { id: 'h3', label: 'Subheading', hint: 'Smaller title · ###', glyph: 'H3', kw: 'subheading h3' },
    { id: 'ul', label: 'Bulleted list', hint: '- item', glyph: '•', kw: 'list bullet unordered ul' },
    { id: 'ol', label: 'Numbered list', hint: '1. item', glyph: '1.', kw: 'list numbered ordered ol' },
    { id: 'blockquote', label: 'Quote', hint: '> text', glyph: '❝', kw: 'quote blockquote' },
    { id: 'tip', label: 'Callout · Tip', hint: 'Green box', glyph: '✓', kw: 'callout tip box' },
    { id: 'note', label: 'Callout · Note', hint: 'Blue box', glyph: 'i', kw: 'callout note info box' },
    { id: 'warn', label: 'Callout · Watch out', hint: 'Amber box', glyph: '!', kw: 'callout warn warning caution box' },
    { id: 'idea', label: 'Callout · Idea', hint: 'Accent box', glyph: '✦', kw: 'callout idea box' },
    { id: 'code', label: 'Code block', hint: '```', glyph: '{ }', kw: 'code snippet pre' },
    { id: 'hr', label: 'Divider', hint: '---', glyph: '—', kw: 'divider rule line hr separator' },
    { id: 'image', label: 'Image', hint: 'Upload or paste', glyph: '▣', kw: 'image picture photo screenshot' },
    { id: 'flashcards', label: 'Flashcards', hint: 'Q and A cards', glyph: 'Q', kw: 'flashcards cards revise memory' },
    { id: 'quiz', label: 'Quiz question', hint: 'Check yourself', glyph: '?', kw: 'quiz question check test' },
    { id: 'steps', label: 'Steps', hint: 'Numbered timeline', glyph: '→', kw: 'steps timeline process' },
    { id: 'table', label: 'Table', hint: 'Rows and columns', glyph: '▦', kw: 'table grid columns' },
    { id: 'html', label: 'Diagram', hint: 'SVG or HTML', glyph: '◇', kw: 'diagram svg html figure drawing' },
  ];

  // ---------- HTML → markdown ----------
  const escMd = (t) => t.replace(/\\/g, '\\\\').replace(/([*`])/g, '\\$1').replace(/\[/g, '\\[').replace(/==/g, '\\==');
  function inl(node) {
    let out = '';
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) { out += escMd(c.textContent.replace(/\u200b/g, '').replace(/\u00a0/g, ' ')); return; }
      if (c.nodeType !== 1 || c.classList.contains('img-del')) return;
      const t = c.tagName;
      const wrap = (m) => {
        const s = inl(c);
        if (!s.trim()) { out += s; return; }
        const lead = s.match(/^\s*/)[0];
        const trail = s.match(/\s*$/)[0];
        out += lead + m + s.trim() + m + trail;
      };
      if (t === 'BR') out += ' ';
      else if (t === 'STRONG' || t === 'B') wrap('**');
      else if (t === 'EM' || t === 'I') wrap('*');
      else if (t === 'MARK') wrap('==');
      else if (t === 'CODE') out += '`' + c.textContent.replace(/`/g, '') + '`';
      else if (t === 'A') { const h = c.getAttribute('href') || ''; const s = inl(c).trim(); out += h && s ? `[${s}](${h.replace(/[\s)]/g, encodeURIComponent)})` : s; }
      else if (t === 'IMG') out += `![${(c.alt || '').replace(/[[\]]/g, '')}](${c.getAttribute('src')})`;
      else if (/^(SCRIPT|STYLE|BUTTON|svg)$/i.test(t)) { /* drop */ }
      else out += inl(c);
    });
    return out;
  }
  const BLOCK_TAGS = /^(P|DIV|H[1-6]|UL|OL|LI|BLOCKQUOTE|PRE|ASIDE|FIGURE|TABLE|HR|SECTION|ARTICLE|HEADER|FOOTER|MAIN)$/;
  const hasBlocks = (n) => [...n.children].some((c) => BLOCK_TAGS.test(c.tagName) || c.classList.contains('blk'));
  const para = (s) => (/^(#{1,4}\s|[-*+]\s|>|```|\||---)/.test(s) ? '\\' + s : s);

  function list(n, ordered) {
    const lines = [];
    let i = 1;
    const walk = (ul, ord) => {
      [...ul.children].forEach((li) => {
        if (li.tagName !== 'LI') return;
        const clone = li.cloneNode(true);
        clone.querySelectorAll('ul, ol').forEach((x) => x.remove());
        const text = inl(clone).replace(/\s+/g, ' ').trim();
        if (text) lines.push(`${ord ? `${i++}.` : '-'} ${text}`);
        li.querySelectorAll(':scope > ul, :scope > ol').forEach((sub) => walk(sub, sub.tagName === 'OL'));
      });
    };
    walk(n, ordered);
    return lines.join('\n');
  }

  function table(n) {
    const rows = [...n.querySelectorAll('tr')].map((tr) => [...tr.children].map((td) => inl(td).replace(/\|/g, '/').replace(/\s+/g, ' ').trim()));
    if (!rows.length) return '';
    const w = Math.max(...rows.map((r) => r.length));
    const fmt = (r) => `| ${Array.from({ length: w }, (_, i) => r[i] || '').join(' | ')} |`;
    return [fmt(rows[0]), `|${'---|'.repeat(w)}`, ...rows.slice(1).map(fmt)].join('\n');
  }

  function block(n) {
    if (n.nodeType === 3) { const t = n.textContent.trim(); return t ? para(escMd(t)) : ''; }
    if (n.nodeType !== 1) return '';
    if (n.classList.contains('blk')) return n.dataset.md || '';
    const t = n.tagName;
    switch (t) {
      case 'H1': case 'H2': return '## ' + inl(n).trim();
      case 'H3': return '### ' + inl(n).trim();
      case 'H4': case 'H5': case 'H6': return '#### ' + inl(n).trim();
      case 'UL': return list(n, false);
      case 'OL': return list(n, true);
      case 'HR': return '---';
      case 'BR': return '';
      case 'PRE': {
        const lang = n.dataset.lang || ((n.querySelector('code') || {}).className || '').replace(/^.*language-(\w+).*$/, '$1') || '';
        const code = n.textContent.replace(/\u200b/g, '').replace(/\n+$/, '');
        return '```' + (/^\w+$/.test(lang) ? lang : '') + '\n' + code + '\n```';
      }
      case 'BLOCKQUOTE': {
        const inner = hasBlocks(n) ? blocks(n) : inl(n).trim();
        return inner ? inner.split('\n').map((l) => (l ? '> ' + l : '>')).join('\n') : '';
      }
      case 'ASIDE': {
        const kind = n.dataset.kind || ((n.className.match(/callout-(\w+)/) || [])[1]) || 'note';
        const titleEl = n.querySelector(':scope > .callout-title');
        const title = titleEl ? inl(titleEl).trim() : '';
        const tmp = document.createElement('div');
        [...n.childNodes].forEach((c) => { if (c !== titleEl) tmp.appendChild(c.cloneNode(true)); });
        const inner = hasBlocks(tmp) ? blocks(tmp) : inl(tmp).trim();
        return [`> [!${kind}] ${title}`.trim(), ...(inner ? inner.split('\n').map((l) => (l ? '> ' + l : '>')) : [])].join('\n');
      }
      case 'FIGURE': {
        const img = n.querySelector('img');
        if (img && !n.querySelector('svg')) return `![${(img.alt || '').replace(/[[\]]/g, '')}](${img.getAttribute('src')})`;
        return n.outerHTML.replace(/\n\s*\n/g, '\n');
      }
      case 'IMG': return `![${(n.alt || '').replace(/[[\]]/g, '')}](${n.getAttribute('src')})`;
      case 'TABLE': return table(n);
      default:
        if (hasBlocks(n)) return blocks(n);
        return para(inl(n).replace(/\s+/g, ' ').trim());
    }
  }
  function blocks(container) {
    const out = [];
    container.childNodes.forEach((c) => { const s = block(c); if (s && s.trim()) out.push(s); });
    return out.join('\n\n');
  }
  const toMD = (root) => blocks(root) + '\n';

  // ---------- editor ----------
  function mount(el, o) {
    const ui = o.ui;
    const I = ui.icons;
    let alive = true;
    let tags = [];
    const off = [];
    const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); off.push(() => t.removeEventListener(ev, fn, opt)); };
    const state = { dirty: false, saving: false, again: false, timer: 0 };
    let titleEl, sumEl, body, statusEl, countEl, tool, slashEl, plus, tagsEl;

    el.classList.remove('ed-loading');
    el.innerHTML = '<p class="ed-wait">Opening…</p>';
    o.api('GET', `/api/note?folder=${encodeURIComponent(o.folder)}&slug=${encodeURIComponent(o.slug)}`)
      .then((n) => { if (alive) build(n); })
      .catch((e) => { if (alive) el.innerHTML = `<div class="empty"><b>Couldn't open this note</b>${esc(e.message)}</div>`; });

    function build(n) {
      tags = Array.isArray(n.meta.tags) ? n.meta.tags.slice() : [];
      el.innerHTML = `<div class="ed" style="--fc:${o.color}">
        <div class="ed-bar">
          <nav class="crumb"><a href="#/">Shelf</a><span>/</span><a class="chip" href="#/f/${o.folder}">${esc(o.folderName)}</a></nav>
          <span class="ed-status" data-s="saved" aria-live="polite">Saved</span>
          <span class="ed-count"></span>
          <button type="button" class="btn small primary ed-done">Done</button>
        </div>
        <div class="ed-page">
          <h1 class="ed-title" contenteditable="true" spellcheck="true" data-ph="Title" role="textbox" aria-label="Title">${esc(n.meta.title || '')}</h1>
          <p class="ed-summary" contenteditable="true" spellcheck="true" data-ph="Add a one-line summary" role="textbox" aria-label="Summary">${esc(n.meta.summary || '')}</p>
          <div class="ed-tags"></div>
          <div class="ed-body prose" contenteditable="true" spellcheck="true" role="textbox" aria-multiline="true" aria-label="Note body"></div>
          <p class="ed-help">Type <kbd>/</kbd> for blocks · <kbd>##</kbd> heading · <kbd>-</kbd> list · <kbd>&gt;</kbd> quote · <kbd>\`\`\`</kbd> code · select text to format · <kbd>⌘S</kbd> saves</p>
        </div>
        <div class="ed-tool" role="toolbar" aria-label="Format text" hidden></div>
        <div class="ed-slash" role="listbox" aria-label="Insert a block" hidden></div>
        <button type="button" class="ed-plus" aria-label="Insert a block" title="Insert a block" hidden>+</button>
      </div>`;
      titleEl = el.querySelector('.ed-title');
      sumEl = el.querySelector('.ed-summary');
      body = el.querySelector('.ed-body');
      statusEl = el.querySelector('.ed-status');
      countEl = el.querySelector('.ed-count');
      tool = el.querySelector('.ed-tool');
      slashEl = el.querySelector('.ed-slash');
      plus = el.querySelector('.ed-plus');
      // floating UI lives on <body>: an animated ancestor would otherwise become its containing block
      [tool, slashEl, plus].forEach((x) => { x.style.setProperty('--fc', o.color); document.body.appendChild(x); });
      tagsEl = el.querySelector('.ed-tags');

      body.innerHTML = md(n.body, { edit: true }).html;
      decorate();
      ensureTrailing();
      renderTags();
      renderTool();
      updateCount();

      try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* old browser */ }

      // title + summary: plain single-line fields
      [titleEl, sumEl].forEach((f) => {
        on(f, 'keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (f === titleEl) sumEl.focus();
            else { body.focus(); placeCaret(body.firstElementChild || body, false); }
          } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
        });
        on(f, 'input', () => { if (!f.textContent.trim()) f.innerHTML = ''; schedule(); });
        on(f, 'paste', (e) => { e.preventDefault(); insertText((e.clipboardData.getData('text/plain') || '').replace(/\s+/g, ' ')); });
      });

      on(body, 'keydown', onKey);
      on(body, 'input', onInput);
      on(body, 'paste', onPaste);
      on(body, 'drop', onDrop);
      on(body, 'click', onBodyClick);
      on(body, 'focus', updatePlus);
      on(document, 'selectionchange', onSel);
      on(window, 'scroll', () => { hideTool(); updatePlus(); }, { passive: true });
      on(window, 'beforeunload', () => { if (state.dirty) save(true); });
      on(el.querySelector('.ed-done'), 'click', async () => { await save(); location.hash = `#/n/${o.folder}/${o.slug}`; });
      on(plus, 'mousedown', (e) => e.preventDefault());
      on(plus, 'click', () => { const b = caretTop(); if (b) openSlash(b, '', true); });
      on(tool, 'mousedown', (e) => { if (e.target.tagName !== 'INPUT') e.preventDefault(); });
      on(tool, 'click', onTool);
      on(slashEl, 'mousedown', (e) => e.preventDefault());
      on(slashEl, 'click', (e) => { const b = e.target.closest('[data-i]'); if (b) choose(slash.items[+b.dataset.i]); });

      if (!titleEl.textContent.trim() || titleEl.textContent === 'Untitled') { titleEl.focus(); selectAll(titleEl); }
      else if (!body.textContent.trim()) { body.focus(); placeCaret(body.firstElementChild, false); }
    }

    // ---------- helpers ----------
    const sel = () => window.getSelection();
    const insertText = (t) => document.execCommand('insertText', false, t);
    const insertHTML = (h) => document.execCommand('insertHTML', false, h);
    const newP = () => { const p = document.createElement('p'); p.innerHTML = '<br>'; return p; };
    function blockOf(node) {
      while (node && node !== body) {
        if (node.nodeType === 1 && /^(P|H[1-6]|LI|PRE|BLOCKQUOTE|ASIDE|FIGURE|DIV)$/.test(node.tagName)) return node;
        node = node.parentNode;
      }
      return null;
    }
    function caretBlock() {
      const s = sel();
      if (!s.rangeCount || !body.contains(s.anchorNode)) return null;
      const n = s.anchorNode;
      return blockOf(n.nodeType === 3 ? n.parentNode : n);
    }
    function caretTop() {
      let n = caretBlock();
      while (n && n.parentNode !== body) n = n.parentNode;
      return n;
    }
    function rangeText(container, toStart) {
      const s = sel();
      if (!s.rangeCount) return '';
      const r = document.createRange();
      r.selectNodeContents(container);
      const c = s.getRangeAt(0);
      if (toStart) r.setEnd(c.startContainer, c.startOffset); else r.setStart(c.endContainer, c.endOffset);
      return r.toString();
    }
    const caretAtEnd = (b) => rangeText(b, false).replace(/\u200b/g, '') === '';
    const caretAtStart = (b) => rangeText(b, true).replace(/\u200b/g, '') === '';
    function placeCaret(node, end = true) {
      if (!node) return;
      const r = document.createRange();
      r.selectNodeContents(node);
      r.collapse(!end);
      const s = sel();
      s.removeAllRanges();
      s.addRange(r);
    }
    function selectAll(node) { const r = document.createRange(); r.selectNodeContents(node); sel().removeAllRanges(); sel().addRange(r); }
    function ensureAfter(node) { if (!node.nextElementSibling) node.after(newP()); }
    function ensureTrailing() { const last = body.lastElementChild; if (!last || last.tagName !== 'P') body.appendChild(newP()); }
    function decorate() {
      body.querySelectorAll('figure.img').forEach((f) => {
        f.contentEditable = 'false';
        if (!f.querySelector('.img-del')) f.insertAdjacentHTML('beforeend', '<button type="button" class="img-del">Remove image</button>');
      });
    }
    function normalize() {
      // keep the body a flat list of blocks: no stray text, no divs, no nested paragraphs
      if (!body.firstElementChild && !body.textContent.trim()) {
        body.innerHTML = '<p><br></p>';
        placeCaret(body.firstChild, false);
        return;
      }
      body.querySelectorAll('p > ul, p > ol, p > blockquote, p > pre, p > h2, p > h3').forEach((x) => {
        const p = x.parentNode;
        p.after(x);
        if (!p.textContent.trim() && !p.querySelector('img')) p.remove();
      });
      [...body.childNodes].forEach((c) => {
        if (c.nodeType === 3 && c.textContent.trim()) { const p = document.createElement('p'); c.replaceWith(p); p.appendChild(c); placeCaret(p, true); }
        else if (c.nodeType === 1 && c.tagName === 'DIV' && !c.classList.contains('blk') && !c.classList.contains('table-wrap')) {
          const p = document.createElement('p');
          while (c.firstChild) p.appendChild(c.firstChild);
          if (!p.firstChild) p.innerHTML = '<br>';
          c.replaceWith(p);
          placeCaret(p, true);
        }
      });
      body.querySelectorAll('p p').forEach((inner) => { const outer = inner.parentNode.closest('p'); if (outer) outer.after(inner); });
      body.querySelectorAll('span[style], font').forEach((s) => s.replaceWith(...s.childNodes));
      ensureTrailing();
    }

    // ---------- save ----------
    function setStatus(text, s) { if (statusEl) { statusEl.textContent = text; statusEl.dataset.s = s || ''; } }
    function updateCount() {
      if (!body) return;
      const words = (body.innerText.match(/\S+/g) || []).length;
      countEl.textContent = `${words} words · ${Math.max(1, Math.round(words / 200))} min`;
    }
    function schedule() {
      state.dirty = true;
      setStatus('Unsaved', 'dirty');
      clearTimeout(state.timer);
      state.timer = setTimeout(() => save(), 900);
      updateCount();
    }
    function collect() {
      return {
        title: titleEl.textContent.replace(/\s+/g, ' ').trim() || 'Untitled',
        summary: sumEl.textContent.replace(/\s+/g, ' ').trim(),
        tags,
        body: toMD(body),
      };
    }
    async function save(keepalive) {
      clearTimeout(state.timer);
      if (!state.dirty || !body) return;
      if (state.saving) { state.again = true; return; }
      state.saving = true;
      state.dirty = false;
      setStatus('Saving…', 'saving');
      try {
        await o.api('PUT', '/api/note', { folder: o.folder, slug: o.slug, ...collect() }, { keepalive });
        if (alive) setStatus('Saved', 'saved');
        if (o.onSaved) o.onSaved({ unmounted: !alive, folder: o.folder, slug: o.slug });
      } catch (e) {
        state.dirty = true;
        setStatus('Not saved · ' + e.message, 'err');
        if (!alive) ui.toast('Your last edit didn’t save: ' + e.message);
      } finally {
        state.saving = false;
        if (state.again) { state.again = false; save(); }
      }
    }

    // ---------- tags ----------
    function renderTags() {
      tagsEl.innerHTML = tags.map((t, i) => `<span class="ed-tag">#${esc(t)}<button type="button" data-rm="${i}" aria-label="Remove tag ${esc(t)}">×</button></span>`).join('') +
        '<input class="ed-tag-input" type="text" placeholder="Add a tag" aria-label="Add a tag" maxlength="30">';
      const inp = tagsEl.querySelector('input');
      inp.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ',' || e.key === ' ') && inp.value.trim()) {
          e.preventDefault();
          const t = inp.value.trim().toLowerCase().replace(/^#/, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
          if (t && !tags.includes(t)) { tags.push(t); schedule(); }
          renderTags();
          tagsEl.querySelector('input').focus();
        } else if (e.key === 'Backspace' && !inp.value && tags.length) { tags.pop(); schedule(); renderTags(); tagsEl.querySelector('input').focus(); }
        else if (e.key === 'Enter') { e.preventDefault(); body.focus(); placeCaret(body.firstElementChild, false); }
      });
      tagsEl.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { tags.splice(+b.dataset.rm, 1); schedule(); renderTags(); }));
    }

    // ---------- keys ----------
    function onKey(e) {
      if (slash.open && slashKey(e)) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === 's') { e.preventDefault(); save(); return; }
      if (mod && k === 'k') { e.preventDefault(); if (!sel().isCollapsed) linkInput(); return; }
      if (mod && k === 'e') { e.preventDefault(); wrapInline('code'); return; }
      if (mod && e.shiftKey && k === 'h') { e.preventDefault(); wrapInline('mark'); return; }
      const b = caretBlock();
      if (!b) return;
      const pre = b.closest('pre');

      if (e.key === 'Tab' && pre) { e.preventDefault(); insertText('  '); return; }

      if (e.key === 'Enter' && !e.isComposing) {
        if (pre) {
          e.preventDefault();
          const before = rangeText(pre, true);
          const after = rangeText(pre, false);
          if (before.endsWith('\n') && /^\n?$/.test(after)) {
            pre.textContent = before.replace(/\n+$/, '');
            const p = newP();
            pre.after(p);
            placeCaret(p, false);
            schedule();
          } else if (after === '') {
            insertText('\n\n');
            sel().modify('move', 'backward', 'character');
          } else insertText('\n');
          return;
        }
        if (e.shiftKey) return;
        const t = b.textContent.trim();
        if (b.tagName === 'LI' && !t && !b.querySelector('img')) {
          // Enter on an empty list item leaves the list (splitting it if needed)
          e.preventDefault();
          const listEl = b.parentNode;
          const rest = [...listEl.children].slice([...listEl.children].indexOf(b) + 1);
          b.remove();
          if (rest.length) { const l2 = document.createElement(listEl.tagName); rest.forEach((x) => l2.append(x)); listEl.after(l2); }
          const p = newP();
          listEl.after(p);
          if (!listEl.children.length) listEl.remove();
          placeCaret(p, false);
          schedule();
          return;
        }
        if (b.tagName === 'P') {
          const m = t.match(/^```(\w*)$/);
          if (m) {
            e.preventDefault();
            const p2 = document.createElement('pre');
            p2.dataset.lang = m[1];
            p2.innerHTML = '<br>';
            b.replaceWith(p2);
            ensureAfter(p2);
            placeCaret(p2, false);
            schedule();
            return;
          }
          if (/^(---|\*\*\*)$/.test(t)) {
            e.preventDefault();
            const hr = document.createElement('hr');
            const p = newP();
            b.replaceWith(hr);
            hr.after(p);
            placeCaret(p, false);
            schedule();
            return;
          }
          const box = b.parentNode.closest && b.parentNode.closest('aside, blockquote');
          if (!t && box && body.contains(box) && b === box.lastElementChild) {
            e.preventDefault();
            b.remove();
            const p = newP();
            box.after(p);
            placeCaret(p, false);
            schedule();
            return;
          }
        }
        if (/^H[2-4]$/.test(b.tagName) && caretAtEnd(b)) {
          e.preventDefault();
          const p = newP();
          b.after(p);
          placeCaret(p, false);
          schedule();
          return;
        }
      }

      if (e.key === ' ' && b.tagName === 'P' && caretAtEnd(b) && !b.closest('li')) {
        const kind = { '#': 'h2', '##': 'h2', '###': 'h3', '>': 'blockquote', '-': 'ul', '*': 'ul', '1.': 'ol' }[b.textContent];
        if (kind) {
          e.preventDefault();
          b.innerHTML = '<br>';
          placeCaret(b, false);
          applyKind(kind, b);
          schedule();
          return;
        }
      }

      if (e.key === 'Backspace' && sel().isCollapsed) {
        if (/^H[2-4]$/.test(b.tagName) && caretAtStart(b)) { e.preventDefault(); placeCaret(retag(b, 'p'), false); schedule(); return; }
        if (b.tagName === 'P' && caretAtStart(b)) {
          const prev = b.previousElementSibling;
          if (prev && (prev.classList.contains('blk') || prev.matches('figure.img, hr'))) {
            e.preventDefault();
            removeBlock(prev);
            return;
          }
        }
      }
    }

    function onInput() {
      normalize();
      updateSlash();
      updatePlus();
      schedule();
    }

    // ---------- block kinds ----------
    // swap a block's tag but keep its contents
    function retag(b, tag) {
      if (b.tagName === tag.toUpperCase()) return b;
      const n = document.createElement(tag);
      while (b.firstChild) n.appendChild(b.firstChild);
      if (!n.firstChild) n.innerHTML = '<br>';
      b.replaceWith(n);
      return n;
    }
    function toggleQuote(b) {
      const q = b.closest('blockquote');
      if (q && body.contains(q)) {
        const kids = [...q.childNodes];
        q.replaceWith(...kids);
        const first = kids.find((k) => k.nodeType === 1);
        if (first) placeCaret(first, true);
        return;
      }
      const quote = document.createElement('blockquote');
      const p = document.createElement('p');
      while (b.firstChild) p.appendChild(b.firstChild);
      if (!p.firstChild) p.innerHTML = '<br>';
      quote.append(p);
      b.replaceWith(quote);
      ensureAfter(quote);
      placeCaret(p, true);
    }
    function toList(b, tag) {
      const li = b.closest('li');
      if (li && body.contains(li)) { const l = li.parentNode; if (l.tagName !== tag.toUpperCase()) retag(l, tag); return; }
      const list = document.createElement(tag);
      const item = document.createElement('li');
      while (b.firstChild) item.appendChild(b.firstChild);
      if (!item.firstChild) item.innerHTML = '<br>';
      list.append(item);
      b.replaceWith(list);
      ensureAfter(list);
      placeCaret(item, true);
    }

    function applyKind(kind, b) {
      if (kind === 'p' || kind === 'h2' || kind === 'h3') placeCaret(retag(b, kind), true);
      else if (kind === 'blockquote') toggleQuote(b);
      else if (kind === 'ul' || kind === 'ol') toList(b, kind);
      else if (CALLOUT[kind]) {
        const a = document.createElement('aside');
        a.className = `callout callout-${kind}`;
        a.dataset.kind = kind;
        a.innerHTML = `<div class="callout-title">${CALLOUT[kind]}</div><p><br></p>`;
        b.replaceWith(a);
        ensureAfter(a);
        placeCaret(a.querySelector('p'), false);
      } else if (kind === 'code') {
        const pre = document.createElement('pre');
        pre.dataset.lang = '';
        pre.innerHTML = '<br>';
        b.replaceWith(pre);
        ensureAfter(pre);
        placeCaret(pre, false);
      } else if (kind === 'hr') {
        const hr = document.createElement('hr');
        b.before(hr);
        placeCaret(b, false);
      } else if (kind === 'image') pickImage(b);
      else if (TEMPLATES[kind]) editRaw(kind, TEMPLATES[kind], b, null);
    }

    function removeBlock(node) {
      const next = node.nextSibling;
      const parent = node.parentNode;
      node.remove();
      ensureTrailing();
      schedule();
      ui.toast('Block removed', 'Undo', () => { parent.insertBefore(node, next && next.parentNode === parent ? next : null); schedule(); });
    }

    function editRaw(kind, source, target, existing) {
      const clean = (s) => { s = s.replace(/\r/g, '').trim(); return kind === 'html' ? s.replace(/\n\s*\n/g, '\n') : s; };
      ui.modal({
        title: `${existing ? 'Edit' : 'Insert'} ${LABEL[kind] || 'block'}`,
        wide: true,
        confirm: existing ? 'Update' : 'Insert',
        body: `<p class="modal-hint">${HELP[kind] || ''}</p><div class="raw-grid"><textarea class="code-input" rows="14" spellcheck="false" aria-label="Block source">${esc(source)}</textarea><div class="raw-preview prose" aria-label="Preview"></div></div>`,
        onOpen: (w) => {
          const ta = w.querySelector('textarea');
          const pv = w.querySelector('.raw-preview');
          const upd = () => { pv.innerHTML = md(clean(ta.value)).html; pv.querySelectorAll('.dg').forEach((d) => d.classList.add('in')); };
          ta.addEventListener('input', upd);
          ta.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') { e.preventDefault(); ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end'); upd(); }
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); w.querySelector('form').requestSubmit(); }
          });
          upd();
        },
        onConfirm: (w) => {
          const src = clean(w.querySelector('textarea').value);
          if (!src) return false;
          const tmp = document.createElement('div');
          tmp.innerHTML = md(src, { edit: true }).html;
          const nodes = [...tmp.children];
          const ref = existing || target;
          if (!ref || !ref.parentNode) nodes.forEach((n) => body.appendChild(n));
          else { nodes.forEach((n) => ref.before(n)); ref.remove(); }
          if (nodes.length) ensureAfter(nodes[nodes.length - 1]);
          decorate();
          ensureTrailing();
          schedule();
          const after = nodes.length && nodes[nodes.length - 1].nextElementSibling;
          if (after) { body.focus(); placeCaret(after, false); }
        },
      });
    }

    // ---------- images ----------
    function pickImage(target) {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/png,image/jpeg,image/gif,image/webp';
      inp.onchange = () => { if (inp.files[0]) uploadImage(inp.files[0], target); };
      inp.click();
    }
    async function uploadImage(file, target) {
      if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) { ui.toast('Only PNG, JPG, GIF or WebP images'); return; }
      if (file.size > 8e6) { ui.toast('Images must be under 8 MB'); return; }
      setStatus('Uploading image…', 'saving');
      try {
        const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
        const { src } = await o.api('POST', '/api/upload', { data });
        const fig = document.createElement('figure');
        fig.className = 'img';
        const img = document.createElement('img');
        img.src = src;
        img.alt = (file.name || 'image').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/[[\]]/g, '');
        fig.append(img);
        if (target && target.parentNode === body && target.tagName === 'P' && !target.textContent.trim()) target.replaceWith(fig);
        else if (target && target.parentNode) target.after(fig);
        else body.append(fig);
        ensureAfter(fig);
        decorate();
        schedule();
      } catch (e) { setStatus('Image failed · ' + e.message, 'err'); }
    }

    // ---------- paste / drop / clicks ----------
    const looksMd = (t) => /(^|\n)(#{1,4} |[-*] |\d+\. |> |```|\|.*\|)/.test(t) || /\*\*[^*]+\*\*/.test(t);
    function onPaste(e) {
      const cd = e.clipboardData;
      if (!cd) return;
      e.preventDefault();
      const files = [...(cd.files || [])].filter((f) => f.type.startsWith('image/'));
      if (files.length) { files.forEach((f) => uploadImage(f, caretTop())); return; }
      const text = cd.getData('text/plain');
      const b = caretBlock();
      if (b && b.closest('pre')) { insertText(text); return; }
      const html = cd.getData('text/html');
      if (html && !looksMd(text)) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('script, style, meta, link, noscript, iframe').forEach((x) => x.remove());
        const mdText = toMD(doc.body).trim();
        if (/\n\n/.test(mdText) || /^(#|-|>|\d+\.|```)/.test(mdText)) insertHTML(md(mdText, { edit: true }).html);
        else insertHTML(mdLib.inline(mdText));
      } else if (text && (looksMd(text) || /\n\s*\n/.test(text))) insertHTML(md(text, { edit: true }).html);
      else if (text) insertText(text);
      normalize();
      decorate();
      schedule();
    }
    function onDrop(e) {
      const files = [...(e.dataTransfer && e.dataTransfer.files || [])].filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;
      e.preventDefault();
      const r = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
      if (r) { sel().removeAllRanges(); sel().addRange(r); }
      files.forEach((f) => uploadImage(f, caretTop()));
    }
    function onBodyClick(e) {
      const blk = e.target.closest('.blk');
      if (blk && e.target.closest('.blk-edit')) { e.preventDefault(); editRaw(blk.dataset.kind, blk.dataset.md, null, blk); return; }
      if (blk && e.target.closest('.blk-del')) { e.preventDefault(); removeBlock(blk); return; }
      const del = e.target.closest('.img-del');
      if (del) { e.preventDefault(); removeBlock(del.closest('figure')); return; }
      if (e.target.closest('a') && (e.metaKey || e.ctrlKey)) window.open(e.target.closest('a').href, '_blank', 'noopener');
    }

    // ---------- slash menu ----------
    const slash = { open: false, block: null, items: [], active: 0, fromPlus: false };
    function updateSlash() {
      const b = caretBlock();
      const m = b && b.tagName === 'P' && b.textContent.match(/^\/([\w ]{0,24})$/);
      if (m && caretAtEnd(b)) openSlash(b, m[1].trim(), false);
      else if (slash.open && !slash.fromPlus) closeSlash();
    }
    function openSlash(b, q, fromPlus) {
      const words = q.toLowerCase().split(/\s+/).filter(Boolean);
      slash.items = BLOCKS.filter((it) => words.every((w) => (it.label + ' ' + it.kw).toLowerCase().includes(w)));
      slash.block = b;
      slash.open = true;
      slash.fromPlus = fromPlus;
      slash.active = 0;
      slashEl.innerHTML = slash.items.length
        ? slash.items.map((it, i) => `<button type="button" class="sl-item${i === 0 ? ' on' : ''}" data-i="${i}" role="option"><span class="sl-glyph">${esc(it.glyph)}</span><span class="sl-text"><b>${esc(it.label)}</b><small>${esc(it.hint)}</small></span></button>`).join('')
        : '<div class="sl-empty">No block called that</div>';
      slashEl.hidden = false;
      const r = b.getBoundingClientRect();
      const h = Math.min(slashEl.scrollHeight, 340);
      let top = r.bottom + 6;
      if (top + h > innerHeight - 10) top = Math.max(10, r.top - h - 6);
      slashEl.style.top = top + 'px';
      slashEl.style.left = Math.max(10, Math.min(r.left, innerWidth - slashEl.offsetWidth - 10)) + 'px';
      plus.hidden = true;
    }
    function closeSlash() { slash.open = false; slashEl.hidden = true; }
    function markSlash() {
      slashEl.querySelectorAll('.sl-item').forEach((x, i) => x.classList.toggle('on', i === slash.active));
      const a = slashEl.querySelector('.sl-item.on');
      if (a) a.scrollIntoView({ block: 'nearest' });
    }
    function slashKey(e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); slash.active = (slash.active + 1) % Math.max(1, slash.items.length); markSlash(); return true; }
      if (e.key === 'ArrowUp') { e.preventDefault(); slash.active = (slash.active - 1 + slash.items.length) % Math.max(1, slash.items.length); markSlash(); return true; }
      if ((e.key === 'Enter' || e.key === 'Tab') && slash.items.length) { e.preventDefault(); choose(slash.items[slash.active]); return true; }
      if (e.key === 'Escape') { e.preventDefault(); closeSlash(); return true; }
      return false;
    }
    function choose(it) {
      let b = slash.block;
      closeSlash();
      if (!b || !b.parentNode) return;
      body.focus();
      b.innerHTML = '<br>';
      // big blocks never nest inside a quote, callout or list: lift the empty line out first
      if (!['p', 'h2', 'h3', 'ul', 'ol', 'blockquote'].includes(it.id) && b.parentNode !== body) {
        let top = b;
        while (top.parentNode !== body) top = top.parentNode;
        const box = b.parentNode;
        top.after(b);
        if (b.tagName !== 'P') b = retag(b, 'p');
        if (!box.textContent.trim() && !box.querySelector('img, .blk')) box.remove();
      }
      placeCaret(b, false);
      applyKind(it.id, b);
      normalize();
      schedule();
    }

    function updatePlus() {
      if (!plus) return;
      const b = caretTop();
      if (!b || b.tagName !== 'P' || b.textContent.trim() || slash.open || document.activeElement !== body) { plus.hidden = true; return; }
      const r = b.getBoundingClientRect();
      plus.hidden = false;
      plus.style.top = (r.top + r.height / 2 - 15) + 'px';
      plus.style.left = Math.max(6, r.left - 42) + 'px';
      body.querySelectorAll('.ph').forEach((x) => x !== b && x.classList.remove('ph'));
      b.classList.add('ph');
    }

    // ---------- selection toolbar ----------
    const TOOLS = [
      { id: 'bold', label: 'Bold (⌘B)', html: '<b>B</b>' },
      { id: 'italic', label: 'Italic (⌘I)', html: '<i>I</i>' },
      { id: 'code', label: 'Inline code (⌘E)', html: '<span class="mono">&lt;/&gt;</span>' },
      { id: 'mark', label: 'Highlight (⌘⇧H)', html: '<span class="hl">H</span>' },
      { id: 'link', label: 'Link (⌘K)', html: I.link },
      { sep: true },
      { id: 'h2', label: 'Heading', html: 'H2' },
      { id: 'h3', label: 'Subheading', html: 'H3' },
      { id: 'quote', label: 'Quote', html: '❝' },
    ];
    function renderTool() {
      tool.innerHTML = TOOLS.map((t) => (t.sep ? '<span class="tool-sep"></span>' : `<button type="button" data-t="${t.id}" title="${t.label}" aria-label="${t.label}">${t.html}</button>`)).join('');
    }
    function hideTool() { if (tool && !tool.querySelector('input')) tool.hidden = true; }
    let selRaf = 0;
    function onSel() {
      cancelAnimationFrame(selRaf);
      selRaf = requestAnimationFrame(() => {
        if (!alive || !body) return;
        updatePlus();
        if (tool.querySelector('input')) return;
        const s = sel();
        if (!s.rangeCount || s.isCollapsed || !body.contains(s.anchorNode) || !body.contains(s.focusNode)) { tool.hidden = true; return; }
        const b = caretBlock();
        if (b && (b.closest('pre') || b.closest('.blk'))) { tool.hidden = true; return; }
        tool.hidden = false;
        tool.querySelectorAll('[data-t]').forEach((x) => {
          const t = x.dataset.t;
          let a = false;
          try {
            if (t === 'bold' || t === 'italic') a = document.queryCommandState(t);
            else if (t === 'h2' || t === 'h3') a = !!(b && b.tagName === t.toUpperCase());
            else if (t === 'quote') a = !!(b && b.closest('blockquote'));
            else if (t === 'link') a = !!(s.anchorNode.parentNode && s.anchorNode.parentNode.closest('a'));
            else if (t === 'code' || t === 'mark') a = !!(s.anchorNode.parentNode && s.anchorNode.parentNode.closest(t));
          } catch { /* ignore */ }
          x.classList.toggle('on', a);
        });
        if (matchMedia('(max-width: 900px), (pointer: coarse)').matches) { tool.classList.add('dock'); tool.style.top = ''; tool.style.left = ''; return; }
        tool.classList.remove('dock');
        const r = s.getRangeAt(0).getBoundingClientRect();
        const w = tool.offsetWidth;
        tool.style.top = Math.max(70, r.top - tool.offsetHeight - 10) + 'px';
        tool.style.left = Math.max(10, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 10)) + 'px';
      });
    }
    function wrapInline(tag) {
      const s = sel();
      if (!s.rangeCount || s.isCollapsed) return;
      const holder = s.anchorNode.parentNode && s.anchorNode.parentNode.closest(tag);
      if (holder && body.contains(holder)) { holder.replaceWith(document.createTextNode(holder.textContent)); schedule(); return; }
      insertHTML(`<${tag}>${esc(s.toString())}</${tag}>`);
      schedule();
    }
    function linkInput() {
      const s = sel();
      if (!s.rangeCount) return;
      const existing = s.anchorNode.parentNode && s.anchorNode.parentNode.closest('a');
      if (existing) { document.execCommand('unlink'); schedule(); return; }
      const saved = s.getRangeAt(0).cloneRange();
      tool.hidden = false;
      tool.innerHTML = '<input type="url" class="tool-link" placeholder="Paste a link, press Enter" aria-label="Link address">';
      const inp = tool.querySelector('input');
      inp.focus();
      const done = (apply) => {
        const v = inp.value.trim();
        renderTool();
        tool.hidden = true;
        body.focus();
        sel().removeAllRanges();
        sel().addRange(saved);
        if (apply && v) {
          const url = /^(https?:|mailto:|#|\/)/.test(v) ? v : 'https://' + v;
          document.execCommand('createLink', false, url);
          schedule();
        }
      };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done(true); } else if (e.key === 'Escape') { e.preventDefault(); done(false); } });
      inp.addEventListener('blur', () => { if (tool.contains(inp)) done(false); });
    }
    function onTool(e) {
      const b = e.target.closest('[data-t]');
      if (!b) return;
      const t = b.dataset.t;
      const blockEl = caretBlock();
      if (t === 'bold' || t === 'italic') document.execCommand(t);
      else if (t === 'code' || t === 'mark') wrapInline(t);
      else if (t === 'link') { linkInput(); return; }
      else if ((t === 'h2' || t === 'h3') && blockEl) placeCaret(retag(blockEl, blockEl.tagName === t.toUpperCase() ? 'p' : t), true);
      else if (t === 'quote' && blockEl) toggleQuote(blockEl);
      normalize();
      schedule();
      onSel();
    }

    return () => {
      alive = false;
      [tool, slashEl, plus].forEach((x) => x && x.remove());
      clearTimeout(state.timer);
      off.forEach((fn) => fn());
      if (state.dirty) save();
    };
  }

  window.SecondBrainEditor = window.KoshEditor = { mount, toMD };
})();
