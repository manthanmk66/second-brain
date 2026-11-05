---
title: Build your first MCP server
summary: Forty lines of TypeScript that let Claude search this very notebook. Run it over stdio, poke it with the Inspector, then plug it into Claude Code.
tags: [mcp, typescript, hands-on]
order: 3
date: 2026-11-05
---

## What we're building

A tiny local server called `second-brain` with two tools: `search_notes` finds notes by keyword, and `read_note` returns one note's markdown. Plug it into Claude Code and you can ask "what did I write about Solana rent?" from any project.

<figure class="dg"><svg viewBox="0 0 420 150" role="img" aria-label="Claude Code sends requests on stdin and reads results on stdout">
<rect class="box" x="10" y="40" width="130" height="60" rx="12"/><text x="75" y="66" text-anchor="middle" class="b">Claude Code</text><text x="75" y="84" text-anchor="middle" class="m">host, starts the server</text>
<rect class="box hot" x="280" y="40" width="130" height="60" rx="12"/><text x="345" y="66" text-anchor="middle" class="b">server.mjs</text><text x="345" y="84" text-anchor="middle" class="m">your code</text>
<path class="flow" d="M142 58 H278"/><path class="flow" style="animation-direction:reverse" d="M142 84 H278"/>
<text class="m" x="210" y="50" text-anchor="middle">stdin: requests</text>
<text class="m" x="210" y="102" text-anchor="middle">stdout: results</text>
<text class="m" x="210" y="138" text-anchor="middle">stderr: your logs, never stdout</text>
</svg><figcaption>With the stdio transport the host launches your server as a child process and they talk through its standard input and output.</figcaption></figure>

## The four steps

```steps
Install :: Make a folder, run npm init -y, add "type": "module" to package.json, then npm install @modelcontextprotocol/server zod.
Write the server :: One file with an McpServer, two registerTool calls and a stdio transport. Code below.
Poke it with the Inspector :: npx @modelcontextprotocol/inspector node server.mjs opens a web page where you can list the tools and call them by hand.
Plug it in :: claude mcp add second-brain -- node /full/path/to/server.mjs, then ask Claude Code a question that needs your notes.
```

## The code

This uses v2 of the official TypeScript SDK, which ships as `@modelcontextprotocol/server`. Older guides import from `@modelcontextprotocol/sdk/...`; that's the v1 line.

```js
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/apple/Downloads/Codes/second-brain/content';

// every note as { folder, slug, title, text }
function allNotes() {
  return fs.readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('_'))
    .flatMap((d) => fs.readdirSync(path.join(ROOT, d.name))
      .filter((f) => f.endsWith('.md'))
      .map((f) => {
        const text = fs.readFileSync(path.join(ROOT, d.name, f), 'utf8');
        const title = (text.match(/^title:\s*(.+)$/m) || [])[1] || f;
        return { folder: d.name, slug: f.replace(/\.md$/, ''), title, text };
      }));
}

const server = new McpServer({ name: 'second-brain', version: '1.0.0' });

server.registerTool('search_notes', {
  description: 'Search Manthan\'s Second Brain study notes by keyword. Returns matching titles with folder/slug. Call read_note to get the full text.',
  inputSchema: z.object({ query: z.string().describe('Words to look for, e.g. "solana rent"') }),
}, async ({ query }) => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = allNotes().filter((n) => words.every((w) => n.text.toLowerCase().includes(w)));
  const lines = hits.slice(0, 10).map((n) => `${n.title}  (${n.folder}/${n.slug})`);
  return { content: [{ type: 'text', text: lines.join('\n') || `No notes mention "${query}". Try fewer words.` }] };
});

server.registerTool('read_note', {
  description: 'Read one Second Brain note in full, as markdown. Use the folder/slug from search_notes.',
  inputSchema: z.object({ folder: z.string(), slug: z.string() }),
}, async ({ folder, slug }) => {
  const note = allNotes().find((n) => n.folder === folder && n.slug === slug);
  if (!note) return { isError: true, content: [{ type: 'text', text: `No note ${folder}/${slug}. Call search_notes first to get a valid one.` }] };
  return { content: [{ type: 'text', text: note.text }] };
});

await server.connect(new StdioServerTransport());
console.error('second-brain MCP server ready'); // stderr, on purpose
```

> [!warn] Never print to stdout
> On stdio, stdout *is* the protocol channel. One stray `console.log` and the host receives garbage instead of JSON-RPC, and the connection dies in a confusing way. Log with `console.error`.

## Small choices that matter

- **The error text tells the model what to do next.** "Call search_notes first" turns a dead end into a retry. Setting `isError: true` tells the host the call failed without throwing a protocol error.
- **Results are short.** Ten titles, not ten full notes. The model asks for the one it needs with `read_note`.
- **The two tools hand off to each other.** Each description names the other, so the model learns the path: search, then read.

## Where to go next

Once this works locally, the next steps are real-world ones: an HTTP transport so it runs remotely, auth so it knows who is calling, and evals so you know the model picks the right tool. Those are the next notes in this folder. The official guides at modelcontextprotocol.io cover Python, Java, C#, Go and Rust SDKs too.

```flashcards
Q: Which package is the v2 TypeScript server SDK?
A: @modelcontextprotocol/server (v1 was @modelcontextprotocol/sdk).
Q: How do you test a server without an AI app?
A: npx @modelcontextprotocol/inspector node server.mjs, then list and call the tools in the browser.
Q: How do you add a stdio server to Claude Code?
A: claude mcp add <name> -- <command to start it>
Q: Why must a stdio server never write to stdout?
A: stdout carries the JSON-RPC messages. Logs go to stderr.
```

```quiz
? Your server connects, then the host says it received invalid JSON. What's the most likely cause?
- The tool description is too long
+ Something in your code wrote to stdout
- The Inspector is still running
= On stdio, any non-protocol text on stdout corrupts the stream. Move logs to console.error.
```
