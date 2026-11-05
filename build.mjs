// Second Brain build: reads content/**/*.md and writes assets/notes.js.
// No dependencies. `node build.mjs` once, `node build.mjs --watch` while writing,
// or `node server.mjs` to read *and* edit in the browser.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import './assets/md.js';

const { md, frontmatter } = globalThis.SecondBrainMD || globalThis.KoshMD;

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const CONTENT = path.join(ROOT, 'content');
const OUT = path.join(ROOT, 'assets', 'notes.js');

export function buildData() {
  const folders = JSON.parse(fs.readFileSync(path.join(CONTENT, 'folders.json'), 'utf8'));
  const notes = [];
  for (const f of folders) {
    const dir = path.join(CONTENT, f.id);
    if (!fs.existsSync(dir)) continue;
    const list = fs.readdirSync(dir)
      .filter((x) => x.endsWith('.md') && !x.startsWith('_'))
      .map((file) => {
        const full = path.join(dir, file);
        const { meta, body } = frontmatter(fs.readFileSync(full, 'utf8'));
        const { html, toc } = md(body);
        const text = html
          .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
          .replace(/\s+/g, ' ')
          .trim();
        return {
          folder: f.id,
          slug: file.replace(/\.md$/, ''),
          title: meta.title || file.replace(/\.md$/, ''),
          summary: meta.summary || '',
          tags: Array.isArray(meta.tags) ? meta.tags : [],
          order: typeof meta.order === 'number' ? meta.order : 999,
          updated: meta.date || fs.statSync(full).mtime.toISOString().slice(0, 10),
          minutes: Math.max(1, Math.round((text ? text.split(' ').length : 0) / 200)),
          toc,
          html,
          text,
        };
      });
    list.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    notes.push(...list);
  }
  return { built: new Date().toISOString(), folders, notes };
}

export function build({ quiet = false } = {}) {
  const data = buildData();
  fs.writeFileSync(OUT, `window.SECOND_BRAIN = window.KOSH = ${JSON.stringify(data)};\n`);
  if (!quiet) console.log(`Second Brain: ${data.folders.length} folders, ${data.notes.length} notes → assets/notes.js`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  build();
  if (process.argv.includes('--watch')) {
    let t;
    fs.watch(CONTENT, { recursive: true }, () => {
      clearTimeout(t);
      t = setTimeout(() => { try { build(); } catch (e) { console.error(e.message); } }, 120);
    });
    console.log('Watching content/ for changes…');
  }
}
