/* Second Brain markdown — shared by build.mjs (Node) and the editor (browser).
 * md(src)               → { html, toc } for reading
 * md(src, {edit:true})  → editor HTML: special blocks become atomic .blk nodes that keep their source
 */
(function (root) {
  'use strict';

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const attr = (s) => esc(s).replace(/"/g, '&quot;');

  function inline(s) {
    const keep = [];
    const hold = (html) => { keep.push(html); return `\u0000${keep.length - 1}\u0000`; };
    s = s.replace(/\\([\\`*_=[\]()#>|!-])/g, (_, c) => hold(esc(c)));
    s = s.replace(/`([^`]+)`/g, (_, c) => hold(`<code>${esc(c)}</code>`));
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, a, u) => hold(`<img src="${attr(u)}" alt="${attr(a)}" loading="lazy">`));
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) =>
      hold(`<a href="${attr(u)}"${/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : ''}>`) + t + hold('</a>'));
    s = esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, '$1<em>$2</em>')
      .replace(/==(.+?)==/g, '<mark>$1</mark>');
    let prev;
    do { prev = s; s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => keep[+i]); } while (s !== prev);
    return s;
  }

  function flashcards(lines) {
    const cards = [];
    let cur = null;
    for (const l of lines) {
      if (/^Q:/i.test(l)) { cur = { q: l.slice(2).trim(), a: '' }; cards.push(cur); }
      else if (/^A:/i.test(l) && cur) cur.a = l.slice(2).trim();
      else if (cur && l.trim()) cur.a += ' ' + l.trim();
    }
    return `<div class="flashcards"><div class="flash-head"><span>Flashcards · ${cards.length}</span><span class="flash-hint">Tap a card to flip it</span></div><div class="flash-grid">${cards
      .map((c, n) => `<button class="flash" type="button" aria-pressed="false"><span class="flash-inner"><span class="flash-face flash-front"><em>Q${n + 1}</em>${inline(c.q)}</span><span class="flash-face flash-back"><em>Answer</em>${inline(c.a)}</span></span></button>`)
      .join('')}</div></div>`;
  }

  function quiz(lines) {
    const qs = [];
    let cur = null;
    for (const l of lines) {
      if (l.startsWith('?')) { cur = { q: l.slice(1).trim(), opts: [], why: '' }; qs.push(cur); }
      else if (/^[+-]\s/.test(l) && cur) cur.opts.push({ t: l.slice(2).trim(), ok: l[0] === '+' });
      else if (l.startsWith('=') && cur) cur.why = l.slice(1).trim();
    }
    return `<div class="quiz">${qs
      .map((q) => `<div class="quiz-q"><p class="quiz-title"><span>Check yourself</span>${inline(q.q)}</p><div class="quiz-opts">${q.opts
        .map((o) => `<button type="button" class="quiz-opt" data-ok="${o.ok ? 1 : 0}">${inline(o.t)}</button>`)
        .join('')}</div><p class="quiz-why" hidden>${inline(q.why)}</p></div>`)
      .join('')}</div>`;
  }

  function steps(lines) {
    const items = lines.filter((l) => l.trim()).map((l) => {
      const [t, ...d] = l.split('::');
      return { t: t.trim(), d: d.join('::').trim() };
    });
    return `<ol class="steps">${items
      .map((s, i) => `<li style="--i:${i}"><strong>${inline(s.t)}</strong>${s.d ? `<span>${inline(s.d)}</span>` : ''}</li>`)
      .join('')}</ol>`;
  }

  const LABEL = { flashcards: 'Flashcards', quiz: 'Quiz', steps: 'Steps', table: 'Table', html: 'Diagram / HTML' };
  const rawBlock = (kind, source, preview) =>
    `<div class="blk" contenteditable="false" data-kind="${kind}" data-md="${attr(source)}"><div class="blk-bar"><span>${LABEL[kind] || kind}</span><span class="blk-actions"><button type="button" class="blk-edit">Edit</button><button type="button" class="blk-del">Remove</button></span></div><div class="blk-preview">${preview}</div></div>`;

  const LIST = /^\s*([-*]|\d+\.)\s+/;
  const IMG_ONLY = /^!\[[^\]]*\]\([^)\s]+\)$/;

  function md(src, opts) {
    const edit = !!(opts && opts.edit);
    const lines = String(src).replace(/\r/g, '').split('\n');
    const out = [];
    const toc = [];
    const used = {};
    const slug = (t) => {
      let s = t.toLowerCase().replace(/[`*=]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
      if (used[s]) s += '-' + ++used[s]; else used[s] = 1;
      return s;
    };
    let i = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) { i++; continue; }
      const start = i;

      let m = l.match(/^```(\w+)?\s*$/);
      if (m) {
        const lang = m[1] || '';
        const buf = [];
        i++;
        while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
        i++;
        const source = lines.slice(start, Math.min(i, lines.length)).join('\n');
        const special = { flashcards, quiz, steps }[lang];
        if (special) out.push(edit ? rawBlock(lang, source, special(buf)) : special(buf));
        else if (edit) out.push(`<pre data-lang="${attr(lang)}"><code>${esc(buf.join('\n'))}</code></pre>`);
        else out.push(`<figure class="code"><figcaption><span>${esc(lang || 'text')}</span><button class="copy" type="button">Copy</button></figcaption><pre><code>${esc(buf.join('\n'))}</code></pre></figure>`);
        continue;
      }

      m = l.match(/^(#{1,4})\s+(.*)$/);
      if (m) {
        const lv = Math.max(2, m[1].length);
        const id = slug(m[2]);
        if (lv === 2 || lv === 3) toc.push({ lv, id, text: m[2].replace(/[*`=\\]/g, '') });
        out.push(`<h${lv} id="${id}">${inline(m[2])}</h${lv}>`);
        i++;
        continue;
      }

      if (/^---+\s*$/.test(l)) { out.push('<hr>'); i++; continue; }

      if (/^\s*<[a-zA-Z!/]/.test(l)) {
        const buf = [];
        while (i < lines.length && lines[i].trim()) buf.push(lines[i++]);
        const html = buf.join('\n');
        out.push(edit ? rawBlock('html', html, html) : html);
        continue;
      }

      if (/^>/.test(l)) {
        const buf = [];
        while (i < lines.length && /^>/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
        const cm = buf[0].match(/^\[!(\w+)\]\s*(.*)$/);
        if (cm) {
          const kind = cm[1].toLowerCase();
          out.push(`<aside class="callout callout-${kind}" data-kind="${kind}"><div class="callout-title">${inline(cm[2] || kind)}</div>${md(buf.slice(1).join('\n'), opts).html}</aside>`);
        } else out.push(`<blockquote>${md(buf.join('\n'), opts).html}</blockquote>`);
        continue;
      }

      if (/^\|/.test(l) && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1])) {
        const rows = [];
        while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
        const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        const head = cells(rows[0]);
        const html = `<div class="table-wrap"><table><thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${rows
          .slice(2)
          .map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table></div>`;
        out.push(edit ? rawBlock('table', rows.join('\n'), html) : html);
        continue;
      }

      if (LIST.test(l)) {
        const ordered = /^\s*\d+\./.test(l);
        const items = [];
        while (i < lines.length && LIST.test(lines[i])) {
          let it = lines[i++].replace(LIST, '');
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !LIST.test(lines[i])) it += ' ' + lines[i++].trim();
          items.push(it);
        }
        const tag = ordered ? 'ol' : 'ul';
        out.push(`<${tag}>${items
          .map((t) => {
            const cb = !edit && t.match(/^\[( |x)\]\s+(.*)/);
            return cb ? `<li class="task${cb[1] === 'x' ? ' done' : ''}">${inline(cb[2])}</li>` : `<li>${inline(t)}</li>`;
          })
          .join('')}</${tag}>`);
        continue;
      }

      const buf = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|>|\||\s*<[a-zA-Z])/.test(lines[i]) && !LIST.test(lines[i]) && !/^---+\s*$/.test(lines[i])) buf.push(lines[i++].trim());
      if (!buf.length) buf.push(lines[i++].trim());
      if (buf.length === 1 && IMG_ONLY.test(buf[0])) out.push(`<figure class="img"${edit ? ' contenteditable="false"' : ''}>${inline(buf[0])}</figure>`);
      else out.push(`<p>${inline(buf.join(' '))}</p>`);
    }
    return { html: out.join('\n'), toc };
  }

  function frontmatter(src) {
    src = String(src).replace(/\r/g, '');
    const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!m) return { meta: {}, body: src };
    const meta = {};
    for (const line of m[1].split('\n')) {
      const kv = line.match(/^(\w+):\s*(.*)$/);
      if (!kv) continue;
      let v = kv[2].trim();
      if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
      else if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
      meta[kv[1]] = v;
    }
    return { meta, body: src.slice(m[0].length) };
  }

  root.SecondBrainMD = root.KoshMD = { md, inline, frontmatter, esc };
})(typeof globalThis !== 'undefined' ? globalThis : this);
