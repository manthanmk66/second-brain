// Second Brain local server: serves the site and lets the browser create, rename, move and save notes.
// No dependencies. Run `node server.mjs`, then open http://localhost:4321
// Only listens on 127.0.0.1. Deleted things go to content/.trash so they can be restored.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, CONTENT, build, buildData } from './build.mjs';

const { frontmatter } = globalThis.SecondBrainMD || globalThis.KoshMD;
const PORT = Number(process.env.PORT) || 4321;
const FOLDERS = path.join(CONTENT, 'folders.json');
const TRASH = path.join(CONTENT, '.trash');
const MEDIA = path.join(CONTENT, '_media');
const SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;
const ICONS = ['neural', 'blocks', 'boxes', 'cube', 'phone', 'play', 'folder', 'book', 'code', 'spark', 'globe', 'chart'];
const PALETTE = ['#7c5cff', '#14a67c', '#e07a2e', '#2f86e0', '#e0457a', '#c99510', '#0e9aa7', '#8a6a4f', '#d14b3a', '#5b7a2e'];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};
const IMG_EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' };

class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const fail = (code, msg) => { throw new HttpError(code, msg); };

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'untitled';
const clean = (s, max = 200) => String(s ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);

const readFolders = () => JSON.parse(fs.readFileSync(FOLDERS, 'utf8'));
const writeFolders = (f) => fs.writeFileSync(FOLDERS, JSON.stringify(f, null, 2) + '\n');
function folderOr404(id) {
  if (!SLUG.test(String(id))) fail(400, 'Bad folder name');
  const folders = readFolders();
  const f = folders.find((x) => x.id === id);
  if (!f) fail(404, 'Folder not found');
  return { folders, f };
}
function notePath(folder, slug) {
  if (!SLUG.test(String(folder)) || !SLUG.test(String(slug))) fail(400, 'Bad note name');
  return path.join(CONTENT, folder, slug + '.md');
}
function uniqueSlug(folder, base) {
  let s = base;
  let n = 2;
  while (fs.existsSync(path.join(CONTENT, folder, s + '.md'))) s = `${base}-${n++}`;
  return s;
}
function readNote(folder, slug) {
  const p = notePath(folder, slug);
  if (!fs.existsSync(p)) fail(404, 'Note not found');
  const { meta, body } = frontmatter(fs.readFileSync(p, 'utf8'));
  return { meta, body };
}
function stringify(meta) {
  const keys = ['title', 'summary', 'tags', 'order', 'date', ...Object.keys(meta).filter((k) => !['title', 'summary', 'tags', 'order', 'date'].includes(k))];
  const lines = ['---'];
  for (const k of keys) {
    let v = meta[k];
    if (v == null || v === '') continue;
    if (Array.isArray(v)) v = `[${v.map((x) => clean(x, 40).replace(/[,[\]]/g, ' ').trim()).filter(Boolean).join(', ')}]`;
    else v = clean(v, 400);
    lines.push(`${k}: ${v}`);
  }
  lines.push('---', '');
  return lines.join('\n') + '\n';
}
function writeNote(folder, slug, meta, body) {
  fs.writeFileSync(notePath(folder, slug), stringify(meta) + String(body).replace(/^\n+/, '').replace(/\s*$/, '\n'));
}
function nextOrder(folder) {
  const dir = path.join(CONTENT, folder);
  if (!fs.existsSync(dir)) return 1;
  let max = 0;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const o = frontmatter(fs.readFileSync(path.join(dir, f), 'utf8')).meta.order;
    if (typeof o === 'number' && o > max) max = o;
  }
  return max + 1;
}
function trash(kind, info, move) {
  fs.mkdirSync(TRASH, { recursive: true });
  const id = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  move(path.join(TRASH, id));
  fs.writeFileSync(path.join(TRASH, id + '.json'), JSON.stringify({ kind, ...info }));
  return id;
}

const routes = {
  'GET /api/data': () => buildData(),

  'GET /api/note': (q) => readNote(q.get('folder'), q.get('slug')),

  'POST /api/note': (b) => {
    folderOr404(b.folder);
    const title = clean(b.title, 160) || 'Untitled';
    const slug = uniqueSlug(b.folder, slugify(title));
    fs.mkdirSync(path.join(CONTENT, b.folder), { recursive: true });
    writeNote(b.folder, slug, { title, summary: '', tags: [], order: nextOrder(b.folder), date: today() }, '');
    return { folder: b.folder, slug };
  },

  'PUT /api/note': (b) => {
    const { meta } = readNote(b.folder, b.slug);
    const tags = Array.isArray(b.tags) ? b.tags.map((t) => slugify(t)).filter(Boolean).slice(0, 12) : meta.tags;
    writeNote(b.folder, b.slug, { ...meta, title: clean(b.title, 160) || meta.title || 'Untitled', summary: clean(b.summary, 400), tags, date: today() }, String(b.body ?? ''));
    return { ok: true };
  },

  'POST /api/note/rename': (b) => {
    const { meta, body } = readNote(b.folder, b.slug);
    const title = clean(b.title, 160);
    if (!title) fail(400, 'Name can’t be empty');
    let slug = slugify(title);
    if (slug !== b.slug) {
      slug = uniqueSlug(b.folder, slug);
      fs.renameSync(notePath(b.folder, b.slug), notePath(b.folder, slug));
    }
    writeNote(b.folder, slug, { ...meta, title }, body);
    return { folder: b.folder, slug };
  },

  'POST /api/note/move': (b) => {
    readNote(b.folder, b.slug);
    folderOr404(b.to);
    if (b.to === b.folder) return { folder: b.folder, slug: b.slug };
    fs.mkdirSync(path.join(CONTENT, b.to), { recursive: true });
    const slug = uniqueSlug(b.to, b.slug);
    const { meta, body } = readNote(b.folder, b.slug);
    fs.renameSync(notePath(b.folder, b.slug), notePath(b.to, slug));
    writeNote(b.to, slug, { ...meta, order: nextOrder(b.to) }, body);
    return { folder: b.to, slug };
  },

  'POST /api/note/duplicate': (b) => {
    const { meta, body } = readNote(b.folder, b.slug);
    const slug = uniqueSlug(b.folder, `${b.slug}-copy`);
    writeNote(b.folder, slug, { ...meta, title: `${meta.title || b.slug} (copy)`, order: nextOrder(b.folder), date: today() }, body);
    return { folder: b.folder, slug };
  },

  'POST /api/note/delete': (b) => {
    const p = notePath(b.folder, b.slug);
    if (!fs.existsSync(p)) fail(404, 'Note not found');
    return { trash: trash('note', { folder: b.folder, slug: b.slug }, (dest) => fs.renameSync(p, dest + '.md')) };
  },

  'POST /api/folder': (b) => {
    const name = clean(b.name, 60);
    if (!name) fail(400, 'Name can’t be empty');
    const folders = readFolders();
    let id = slugify(name);
    for (let n = 2; folders.some((f) => f.id === id) || fs.existsSync(path.join(CONTENT, id)); n++) id = `${slugify(name)}-${n}`;
    fs.mkdirSync(path.join(CONTENT, id), { recursive: true });
    folders.push({ id, name, color: PALETTE[folders.length % PALETTE.length], icon: 'folder', blurb: '', next: [] });
    writeFolders(folders);
    return { id };
  },

  'POST /api/folder/update': (b) => {
    const { folders, f } = folderOr404(b.id);
    if (b.name != null) { const n = clean(b.name, 60); if (!n) fail(400, 'Name can’t be empty'); f.name = n; }
    if (b.blurb != null) f.blurb = clean(b.blurb, 300);
    if (b.color != null) { if (!/^#[0-9a-f]{6}$/i.test(b.color)) fail(400, 'Bad colour'); f.color = b.color; }
    if (b.icon != null) { if (!ICONS.includes(b.icon)) fail(400, 'Unknown icon'); f.icon = b.icon; }
    if (Array.isArray(b.next)) f.next = b.next.map((t) => clean(t, 80)).filter(Boolean).slice(0, 30);
    writeFolders(folders);
    return { ok: true };
  },

  'POST /api/folder/move': (b) => {
    const { folders, f } = folderOr404(b.id);
    const i = folders.indexOf(f);
    const j = Math.max(0, Math.min(folders.length - 1, i + (b.dir < 0 ? -1 : 1)));
    folders.splice(i, 1);
    folders.splice(j, 0, f);
    writeFolders(folders);
    return { ok: true };
  },

  'POST /api/folder/delete': (b) => {
    const { folders, f } = folderOr404(b.id);
    const index = folders.indexOf(f);
    const dir = path.join(CONTENT, f.id);
    const id = trash('folder', { folder: f, index }, (dest) => { if (fs.existsSync(dir)) fs.renameSync(dir, dest); else fs.mkdirSync(dest); });
    writeFolders(folders.filter((x) => x !== f));
    return { trash: id };
  },

  'POST /api/restore': (b) => {
    if (!/^[0-9]+-[0-9a-f]{6}$/.test(String(b.trash))) fail(400, 'Bad restore id');
    const base = path.join(TRASH, b.trash);
    if (!fs.existsSync(base + '.json')) fail(404, 'Nothing to restore');
    const info = JSON.parse(fs.readFileSync(base + '.json', 'utf8'));
    if (info.kind === 'note') {
      folderOr404(info.folder);
      const slug = uniqueSlug(info.folder, info.slug);
      fs.renameSync(base + '.md', notePath(info.folder, slug));
      fs.rmSync(base + '.json');
      return { folder: info.folder, slug };
    }
    const folders = readFolders();
    if (folders.some((x) => x.id === info.folder.id) || fs.existsSync(path.join(CONTENT, info.folder.id))) fail(409, 'A folder with that name exists again');
    fs.renameSync(base, path.join(CONTENT, info.folder.id));
    folders.splice(Math.min(info.index, folders.length), 0, info.folder);
    writeFolders(folders);
    fs.rmSync(base + '.json');
    return { id: info.folder.id };
  },

  'POST /api/upload': (b) => {
    const m = String(b.data || '').match(/^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!m) fail(400, 'Only PNG, JPG, GIF or WebP images');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 8 * 1024 * 1024) fail(413, 'Images must be under 8 MB');
    const name = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16) + IMG_EXT[m[1]];
    fs.mkdirSync(MEDIA, { recursive: true });
    fs.writeFileSync(path.join(MEDIA, name), buf);
    return { src: `content/_media/${name}` };
  },
};

const MUTATING = (key) => !key.startsWith('GET ');

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 12 * 1024 * 1024) { reject(new HttpError(413, 'Too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new HttpError(400, 'Bad JSON')); }
    });
    req.on('error', reject);
  });
}

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

const ALLOWED_HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);

const server = http.createServer(async (req, res) => {
  try {
    // Refuse requests addressed to any other hostname (DNS-rebinding guard).
    if (!ALLOWED_HOSTS.has(req.headers.host)) return send(res, 403, { error: 'Forbidden host' });
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith('/api/')) {
      const key = `${req.method} ${url.pathname}`;
      const handler = routes[key];
      if (!handler) return send(res, 404, { error: 'No such endpoint' });
      if (MUTATING(key)) {
        // Only same-origin JSON requests may change files.
        const origin = req.headers.origin;
        if (origin && origin !== `http://${req.headers.host}`) return send(res, 403, { error: 'Cross-origin request refused' });
        if (!String(req.headers['content-type'] || '').startsWith('application/json')) return send(res, 415, { error: 'JSON only' });
      }
      const input = req.method === 'GET' ? url.searchParams : await readBody(req);
      const out = await handler(input);
      if (MUTATING(key)) build({ quiet: true });
      return send(res, 200, out);
    }

    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT + path.sep) || rel.includes('\0')) return send(res, 403, 'Forbidden', 'text/plain');
    if (/(^|\/)\.(?!well-known)/.test(path.relative(ROOT, file)) || /server\.mjs$|build\.mjs$/.test(file)) return send(res, 404, 'Not found', 'text/plain');
    fs.readFile(file, (err, data) => {
      if (err) return send(res, 404, 'Not found', 'text/plain');
      send(res, 200, data, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
    });
  } catch (e) {
    const code = e instanceof HttpError ? e.code : 500;
    if (code === 500) console.error(e);
    send(res, code, { error: e.message || 'Something went wrong' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  build({ quiet: true });
  console.log(`Second Brain is running → http://localhost:${PORT}  (Ctrl+C to stop)`);
});
