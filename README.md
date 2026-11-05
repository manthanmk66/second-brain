# Second Brain

Manthan's learn book. One folder per subject, one markdown note per idea.

## Run it

```bash
node server.mjs          # read AND edit → http://localhost:4321
```

No installs. The server only listens on your own machine (127.0.0.1) and writes straight into `content/`.

Opening `index.html` directly still works, but it's read-only. Run `node build.mjs` after changing files by hand so the read-only copy picks them up. (The server does this for you.)

## Editing in the browser

**Sidebar (like VS Code's explorer)**
- The buttons next to **Notes** make a new note, make a new folder, or collapse everything.
- **⋯** on any row (or right-click) opens:
  - for a note: Open, Edit, Rename, Move to, Duplicate, Copy link, Delete
  - for a folder: New note here, Rename, Description & queue, Move up/down, Colour, Icon, Delete
- **F2** renames the selected row. **Delete** removes a note.
- Drag a note onto a folder to move it.
- Deleting shows an **Undo** for a few seconds. Deleted files go to `content/.trash/`.

**Writing (like Medium or Confluence)**
- Click **Edit** on any note. The page has a big title, a one-line summary, tags, then the body.
- Select text for the toolbar: bold, italic, `code`, highlight, link, H2, H3, quote.
- Type **/** on an empty line, or click the **+** beside it, to insert a block: heading, list, quote, callout, code, divider, image, flashcards, quiz, steps, table, diagram.
- Markdown shortcuts at the start of a line: `## ` heading, `### ` subheading, `- ` list, `1. ` numbered list, `> ` quote. On their own line, ```` ``` ```` + Enter starts a code block and `---` + Enter adds a divider.
- Paste images, or drop them in. They're saved to `content/_media/`.
- Pasting markdown or a web page turns it into formatted text.
- Autosaves about a second after you stop typing. **⌘S** saves now, and **Done** goes back to reading.

Flashcards, quizzes, steps, tables and diagrams appear as blocks with **Edit** and **Remove** buttons. **Edit** opens their source next to a live preview.

## The note format (for writing by hand)

`content/<folder-id>/<slug>.md`:

```md
---
title: The note's title
summary: One or two sentences shown under the title and in search.
tags: [basics, something]
order: 2
date: 2026-11-05
---

## A section heading   (h2/h3 become the "On this page" list)

Normal markdown: **bold**, *italic*, `code`, ==highlight==, [links](https://…), ![images](content/_media/x.png), lists, tables.

> [!tip] Title        (also: note, warn, idea)
> Callout body.
```

Special blocks (fenced with three backticks):

- `steps`: one step per line, `Title :: description`
- `flashcards`: a `Q: …` line, then an `A: …` line, repeated
- `quiz`: `? question`, `- wrong`, `+ right`, `= why`

Diagrams are inline `<figure class="dg"><svg>…</svg><figcaption>…</figcaption></figure>` with **no blank lines inside**.
- Shape classes: `box`, `box hot`, `box dashed`, `lane`, `ln`, `flow`, `flow slow`, `bar`, `bar dim`, `dot`, `spin`, `playhead`, `pop`
- Text classes: `b`, `m`, `s`

## Files

| File | Job |
|---|---|
| `server.mjs` | local server + the editing API |
| `build.mjs` | turns `content/` into `assets/notes.js` |
| `assets/md.js` | the markdown parser, shared by build and editor |
| `assets/app.js` | reading views, explorer sidebar, menus, search |
| `assets/editor.js` | the writing editor and its HTML→markdown saver |
| `assets/style.css` | all styles |

Learned progress and recently opened notes are kept in the browser (localStorage), so they're per device.
