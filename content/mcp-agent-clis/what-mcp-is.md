---
title: What MCP is, and why it took off
summary: One open protocol that lets any AI app use any tool. Write a server once, and Claude, ChatGPT, Cursor and the rest can all call it.
tags: [mcp, basics, protocol]
order: 1
date: 2026-11-05
---

## The problem it solves

Before MCP, every AI app had to build its own integration with every service. Five AI apps talking to twenty services meant up to a hundred one-off connectors, each with its own auth, its own format and its own bugs.

The **Model Context Protocol** turns that into a plug standard. A service ships one **MCP server**; every AI app that speaks MCP can use it. Five apps and twenty services now need twenty-five implementations instead of a hundred.

<figure class="dg"><svg viewBox="0 0 420 228" role="img" aria-label="Three AI apps on the left connect through MCP to three servers on the right">
<g class="pop" style="animation-delay:0s"><rect class="box" x="10" y="20" width="110" height="44" rx="10"/><text x="65" y="47" text-anchor="middle">Claude</text></g>
<g class="pop" style="animation-delay:.08s"><rect class="box" x="10" y="85" width="110" height="44" rx="10"/><text x="65" y="112" text-anchor="middle">ChatGPT</text></g>
<g class="pop" style="animation-delay:.16s"><rect class="box" x="10" y="150" width="110" height="44" rx="10"/><text x="65" y="177" text-anchor="middle">Cursor</text></g>
<path class="flow" d="M122 42 C142 42 140 100 158 100"/><path class="flow" d="M122 107 H158"/><path class="flow" d="M122 172 C142 172 140 116 158 116"/>
<rect class="box hot" x="160" y="80" width="100" height="56" rx="12"/><text x="210" y="105" text-anchor="middle" class="b">MCP</text><text x="210" y="123" text-anchor="middle" class="m">one protocol</text>
<path class="flow" d="M262 100 C282 100 280 42 298 42"/><path class="flow" d="M262 108 H298"/><path class="flow" d="M262 116 C282 116 280 172 298 172"/>
<g class="pop" style="animation-delay:.3s"><rect class="box" x="300" y="20" width="110" height="44" rx="10"/><text x="355" y="47" text-anchor="middle">GitHub</text></g>
<g class="pop" style="animation-delay:.38s"><rect class="box" x="300" y="85" width="110" height="44" rx="10"/><text x="355" y="112" text-anchor="middle">Postgres</text></g>
<g class="pop" style="animation-delay:.46s"><rect class="box" x="300" y="150" width="110" height="44" rx="10"/><text x="355" y="177" text-anchor="middle">Your app</text></g>
<text class="m" x="65" y="218" text-anchor="middle">AI apps (hosts)</text><text class="m" x="355" y="218" text-anchor="middle">MCP servers</text>
</svg><figcaption>Every app speaks MCP, every service ships one server, and any app can reach any service.</figcaption></figure>

The idea is borrowed from the Language Server Protocol, which did the same thing for code editors: one language server works in VS Code, Vim and JetBrains alike.

## The three roles

| Role | What it is | Example |
|---|---|---|
| **Host** | The AI app the person is using | Claude Desktop, Claude Code, ChatGPT, Cursor |
| **Client** | The connector inside the host, one per server | Claude Code's link to your GitHub server |
| **Server** | Your program, offering tools and data | A server that searches your notes or files a Jira ticket |

People blur "client" and "host" all the time. The distinction only matters when you read the spec: one host can run many clients, each talking to one server.

## What actually goes over the wire

Every MCP message is **JSON-RPC 2.0**: a small JSON object with a `method`, some `params` and an `id` so the reply can be matched to the request. Here a host asks a server to run a tool:

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "search_notes",
    "arguments": { "query": "solana rent" },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {}
    }
  }
}
```

And the server answers:

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "result": {
    "resultType": "complete",
    "content": [{ "type": "text", "text": "1 note: Accounts, programs and transactions (solana)" }]
  }
}
```

> [!note] The 2026-07-28 spec changed this
> Older tutorials start every connection with an `initialize` handshake and keep a session open. The current spec removed both: each request carries its own protocol version and capabilities in `_meta`, and a client that wants to know what a server supports calls `server/discover`. If a guide talks about `Mcp-Session-Id` or `initialize`, it was written for the 2025 versions.

## Why it took off

Anthropic released MCP as an open standard in November 2024. During 2025 OpenAI, Google and Microsoft all added support, and OpenAI's Apps SDK for ChatGPT is built on top of it. That's what changed it from "an Anthropic thing" into the default way to plug a product into an assistant. A company that wants to show up inside ChatGPT and Claude now builds one MCP server instead of two custom plugins.

> [!warn] Reading the Reddit post with a straight face
> Two of its claims check out: MCP really is the cross-vendor standard, and good servers really are harder than they look (its own edit makes that point). Two need salt. "Learn it in under a week" is true for a working server, which takes an afternoon; it isn't true for auth, tool design and evals. "Like the 2010 app moment" is an opinion, not data. And the first link is a framework the author contributes to. Start from the official docs at modelcontextprotocol.io instead.

```flashcards
Q: What problem does MCP solve?
A: The N×M integration mess. Each service ships one server, and every MCP-speaking AI app can use it.
Q: Host, client, server: which one do you build?
A: Usually the server. The host is the AI app (Claude, ChatGPT), and the client is its built-in connector.
Q: What message format does MCP use?
A: JSON-RPC 2.0: a method, params, and an id to match each reply to its request.
Q: What replaced the initialize handshake in 2026-07-28?
A: Nothing runs up front any more. Each request carries its version and capabilities in _meta, and server/discover tells a client what a server supports.
```

```quiz
? A tutorial tells you to store the Mcp-Session-Id header between calls. What does that tell you?
- It's the recommended way to keep state
+ It was written for an older spec; 2026-07-28 removed protocol sessions
- You're using the stdio transport
= Since 2026-07-28 every request stands alone. Servers that need state hand out their own IDs as ordinary tool arguments.
```
