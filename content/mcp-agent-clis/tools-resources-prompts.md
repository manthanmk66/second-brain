---
title: Tools, resources and prompts
summary: A server can offer three kinds of thing. The difference is who decides to use each one, the model, the app or the person.
tags: [mcp, primitives, tools]
order: 2
date: 2026-11-05
---

## Three primitives, three deciders

An MCP server can expose three kinds of capability. The neat way to keep them apart is to ask *who pulls the trigger*.

<figure class="dg"><svg viewBox="0 0 420 210" role="img" aria-label="The model uses tools, the app uses resources, the user uses prompts">
<g class="pop" style="animation-delay:0s"><rect class="box" x="10" y="20" width="100" height="44" rx="10"/><text x="60" y="47" text-anchor="middle" class="b">Model</text></g>
<g class="pop" style="animation-delay:.1s"><rect class="box" x="10" y="85" width="100" height="44" rx="10"/><text x="60" y="112" text-anchor="middle" class="b">App</text></g>
<g class="pop" style="animation-delay:.2s"><rect class="box" x="10" y="150" width="100" height="44" rx="10"/><text x="60" y="177" text-anchor="middle" class="b">User</text></g>
<rect class="box dashed" x="170" y="8" width="240" height="196" rx="14"/><text class="m" x="290" y="28" text-anchor="middle">your MCP server</text>
<rect class="box hot" x="188" y="40" width="204" height="44" rx="9"/><text x="202" y="60" class="b">Tools</text><text x="202" y="76" class="m">do things: search, create, send</text>
<rect class="box hot" x="188" y="96" width="204" height="44" rx="9"/><text x="202" y="116" class="b">Resources</text><text x="202" y="132" class="m">read data: files, records, docs</text>
<rect class="box hot" x="188" y="152" width="204" height="44" rx="9"/><text x="202" y="172" class="b">Prompts</text><text x="202" y="188" class="m">templates the user picks</text>
<path class="flow" d="M112 42 C150 42 150 62 186 62"/><path class="flow" d="M112 107 C150 107 150 118 186 118"/><path class="flow" d="M112 172 C150 172 150 174 186 174"/>
</svg><figcaption>Same server, three doors. Tools are what most people mean when they say "an MCP".</figcaption></figure>

| Primitive | Who decides | Second Brain example |
|---|---|---|
| **Tools** | The model, mid-conversation | `search_notes`, `mark_learned` |
| **Resources** | The app, or the user attaching them | The markdown of one note, at `second-brain://note/solana/rent` |
| **Prompts** | The user, usually as a slash command | `/quiz-me` that turns a folder into ten questions |

## Tools: where most of the work goes

A tool is a function with a name, a description and a JSON Schema for its arguments. The host shows those to the model, and the model decides when to call it.

```json
{
  "name": "search_notes",
  "description": "Search Second Brain study notes by keyword. Returns titles, folders and paths. Use read_note for the full text.",
  "inputSchema": {
    "type": "object",
    "properties": { "query": { "type": "string", "description": "Words to find, e.g. \"solana rent\"" } },
    "required": ["query"]
  },
  "outputSchema": {
    "type": "object",
    "properties": { "notes": { "type": "array", "items": { "type": "object" } } }
  },
  "annotations": { "readOnlyHint": true, "openWorldHint": false }
}
```

Three parts of that deserve attention:

- The **description is a prompt.** The model reads it to decide when to call the tool, so it should say what the tool is for and when to reach for something else.
- **`outputSchema`** lets a tool return typed data in `structuredContent` alongside the human-readable `content`. Hosts and code can parse it without guessing.
- **Annotations** such as `readOnlyHint` and `destructiveHint` help a host decide when to ask the user first. The spec says to treat them as untrusted unless you trust the server, because a malicious server can lie.

## Resources and prompts

**Resources** are data addressed by a URI: a file, a database row, a note. The app decides when to pull them into context, often because the user attached one. Use them for things you *read*, and tools for things you *do*.

**Prompts** are reusable templates with arguments, surfaced to the user as menu items or slash commands. They're the least used of the three, and they're handy for packaging a workflow the user would otherwise retype.

## What the client can offer back

The flow can run the other way too. With **elicitation**, a server asks the user for something it needs mid-call, such as a missing date or a confirmation. In the 2026-07-28 spec this works through *multi round-trip requests*: the server replies with `resultType: "input_required"`, the host asks the user, and the host retries the original call with the answers attached.

> [!warn] Skip these in older tutorials
> **Sampling** (the server borrowing the host's model), **Roots** (the host telling the server which folders it may touch) and **Logging** are deprecated as of 2026-07-28. The spec's advice is to call an LLM API directly instead of sampling, pass folders as tool arguments or config instead of roots, and log to stderr or OpenTelemetry instead of MCP logging.

Newer, optional pieces live in **extensions**: *Tasks* for long-running jobs, *MCP Apps* for interactive UI rendered inside the chat, and *Skills over MCP* for shipping agent instructions. Both sides have to opt in.

```flashcards
Q: Tools, resources, prompts: who decides to use each?
A: The model uses tools, the app (or user) pulls in resources, and the user picks prompts.
Q: Why does a tool's description matter so much?
A: The model reads it to decide when to call the tool, so it works as a prompt.
Q: What does outputSchema add?
A: Typed results in structuredContent that code can parse, next to the readable content.
Q: Which three features did 2026-07-28 deprecate?
A: Sampling, Roots and Logging.
```

```quiz
? You want Claude to be able to read any note in Second Brain when the user attaches it. Tool or resource?
- A tool called read_everything
+ A resource per note, addressed by a URI
- A prompt
= Attaching data the user chooses is the job resources were made for. Tools are for actions the model decides to take.
```
