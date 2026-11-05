---
title: Designing tools an agent can actually use
summary: Wrapping your REST API one endpoint per tool is the classic mistake. Design tools around the jobs people ask for, write descriptions like prompts, and return less.
tags: [mcp, tool-design, agents]
order: 4
date: 2026-11-05
---

## Why "it's just API calls" goes wrong

The easy first version of a product's MCP server maps every REST endpoint to a tool. It works in a demo and falls apart in use, for two reasons.

First, **every tool costs context.** The name, description and schema of every tool sit in the model's context on every turn, whether it uses them or not. A server with 150 tools spends a big slice of the window before the user has said anything, and gives the model 150 chances to pick the wrong one.

Second, **models aren't REST clients.** A person asking "add a task to the Second Brain project" doesn't know the project's UUID. An API-mirror server makes the model discover it step by step, and every extra call is another chance to drift.

<figure class="dg"><svg viewBox="0 0 420 180" role="img" aria-label="Mirroring the API needs four calls; a task-shaped tool needs one">
<text x="10" y="22" class="b">Mirror the API: 4 calls</text>
<g class="pop" style="animation-delay:0s"><rect class="box" x="10" y="32" width="94" height="32" rx="8"/><text x="57" y="53" text-anchor="middle" class="c">list_projects</text></g>
<g class="pop" style="animation-delay:.15s"><rect class="box" x="112" y="32" width="94" height="32" rx="8"/><text x="159" y="53" text-anchor="middle" class="c">get_project</text></g>
<g class="pop" style="animation-delay:.3s"><rect class="box" x="214" y="32" width="94" height="32" rx="8"/><text x="261" y="53" text-anchor="middle" class="c">list_columns</text></g>
<g class="pop" style="animation-delay:.45s"><rect class="box" x="316" y="32" width="94" height="32" rx="8"/><text x="363" y="53" text-anchor="middle" class="c">create_task</text></g>
<text x="10" y="112" class="b">Design for the job: 1 call</text>
<g class="pop" style="animation-delay:.7s"><rect class="box hot" x="10" y="122" width="400" height="34" rx="8"/><text x="22" y="144" class="c">add_task(project: "Second Brain", title: "Write MCP note")</text></g>
</svg><figcaption>The second server does the lookups itself, so the model makes one call with words a person would use.</figcaption></figure>

## The rules that hold up

**Build tools for tasks, not endpoints.** Group the steps a real request needs into one tool. `add_task` that accepts a project *name* beats four tools that need IDs. Fewer, sharper tools win.

**Write the description like a prompt.** Say what the tool does, when to use it, when to use a different tool instead, and what an argument looks like ("ISO date, e.g. 2026-11-05"). That text is the only manual the model gets.

**Namespace when tools pile up.** `github_search_issues` and `jira_search_issues` stay distinct when a user has both servers connected. A bare `search` collides.

**Return less, and return meaning.** Send names and short summaries rather than raw rows full of UUIDs. Cap list lengths and say what got cut ("showing 10 of 240, pass `page: 2` for more"). Offer a `detail: "brief" | "full"` argument when both are genuinely useful.

**Make errors tell the model what to do.** "Project not found" is a dead end. "No project called 'Second Brain'. Projects you can use: Second Brain Notes, Neev" gets fixed on the next turn.

**Mark what's risky.** Set `readOnlyHint`, `destructiveHint` and `idempotentHint` honestly, so hosts know when to ask the user before running something.

> [!tip] Anthropic's own write-up
> Anthropic's engineering post "Writing effective tools for agents" (September 2025) covers the same ground in depth, with examples of consolidating tools and of evaluating them. It's the best single read after this note.

## Check it with evals, not vibes

You can't eyeball tool design. Write ten to twenty realistic requests, the kind a user would really type ("move my overdue tasks to Friday"). Run them through an agent connected to your server, then read the transcripts. Watch for wrong tool picks, repeated calls, invented arguments and giant responses. Change one description, run the set again, and compare.

The 2026-07-28 spec also asks servers to return `tools/list` in a stable order. Hosts can then cache the tool list, which helps with prompt caching and cost.

```flashcards
Q: Why is mirroring a REST API as MCP tools a mistake?
A: Every tool costs context, and models make more mistakes chaining ID lookups than calling one task-shaped tool.
Q: What should a tool description contain?
A: What it does, when to use it (and when not to), and examples of valid arguments.
Q: What makes an error message useful to an agent?
A: It says how to fix the call, such as listing the valid names.
Q: How do you know your tools are well designed?
A: Run realistic tasks through an agent and read the transcripts. Those are evals.
```

```quiz
? Your list_customers tool returns 5,000 rows and the agent starts forgetting the user's question. Best fix?
- Raise the model's max tokens
+ Return a capped, summarised page and say how to get more
- Split it into 50 tools
= Big responses crowd out the conversation. Cap them, summarise them, and explain how to paginate.
```
