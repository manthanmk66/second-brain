---
title: CLIs that agents are good at
summary: Coding agents already have a shell, so a well-made command-line tool can beat an MCP server for them. JSON output, no prompts, clear exit codes.
tags: [cli, agents, claude-code]
order: 6
date: 2026-11-05
---

## Why the post bundles CLIs with MCPs

Claude Code, OpenAI's Codex and Gemini CLI all run inside a terminal and can run any command. For them, your product's CLI *is* an integration, and an unusually cheap one. A CLI costs no context until the agent uses it, and the agent learns it on demand by running `--help`. That's why tools like `gh`, `stripe` and `vercel` work so well with coding agents with no MCP server at all.

<figure class="dg"><svg viewBox="0 0 420 150" role="img" aria-label="A coding agent runs a CLI command and reads JSON output and an exit code">
<rect class="box" x="10" y="44" width="110" height="56" rx="12"/><text x="65" y="69" text-anchor="middle" class="b">Coding agent</text><text x="65" y="87" text-anchor="middle" class="m">has a shell</text>
<rect class="box hot" x="170" y="44" width="240" height="56" rx="12"/><text x="290" y="77" text-anchor="middle" class="c">second-brain search "rent" --json</text>
<path class="flow" d="M122 62 H168"/><path class="flow" style="animation-direction:reverse" d="M122 84 H168"/>
<text class="m" x="145" y="36" text-anchor="middle">runs</text>
<text class="m" x="210" y="128" text-anchor="middle">stdout: JSON · stderr: errors · exit code 0 or 1</text>
</svg><figcaption>The contract an agent relies on: parseable output, errors kept separate, and an exit code it can check.</figcaption></figure>

## CLI or MCP?

| Use a CLI when | Use an MCP server when |
|---|---|
| The user works with a coding agent that has a terminal | The user is in a chat app with no shell (ChatGPT, Claude.ai, mobile) |
| Developers are the audience | Non-developers are the audience |
| It runs locally with the user's own credentials | Each user signs in to a hosted service |
| You want it usable by people and scripts too | You want rich features like UI inside the chat |

Many products ship both, often from the same core library. A thin CLI and a thin MCP server can call the same functions.

## Rules for an agent-friendly CLI

**Offer machine output.** A `--json` flag that prints one clean JSON document to stdout. No spinners, colours or progress bars when stdout isn't a terminal, and respect `NO_COLOR`.

**Never stop to ask.** Every question the CLI might ask needs a flag instead (`--yes`, `--project second-brain`). An agent can't answer an interactive prompt, so it just hangs.

**Make exit codes mean something.** `0` for success, non-zero for failure, and ideally a distinct code for "not found" versus "not allowed". Agents branch on these.

**Write errors that say what to do.** Print them to stderr: "No project 'second-brain'. Run `second-brain projects` to list them." It's the same rule as MCP tool errors, for the same reason.

**Write `--help` with examples.** The agent reads it like documentation. Two real example commands teach more than a list of every flag.

**Keep it safe to retry.** Agents retry. Make commands idempotent where you can, and add `--dry-run` for anything destructive.

```js
// the shape of an agent-friendly command
const asJson = process.argv.includes('--json') || !process.stdout.isTTY;
try {
  const notes = search(query);
  if (asJson) console.log(JSON.stringify({ notes }));
  else notes.forEach((n) => console.log(`${n.title}  ${n.folder}/${n.slug}`));
  process.exit(notes.length ? 0 : 3);                 // 3 = nothing found
} catch (e) {
  console.error(`second-brain: ${e.message}. Try: second-brain search --help`);
  process.exit(1);
}
```

## Skills: the third option

Claude also supports **Agent Skills**: a folder with a `SKILL.md` of instructions and optional scripts. The agent loads it only when a task needs it. A skill often teaches the agent how to use a CLI well ("to release, run these three commands in this order"). Skills cost almost nothing until they're used, which makes them a good fit for workflows rather than single actions. There's now an MCP extension, *Skills over MCP*, for serving them from a server.

```flashcards
Q: Why can a CLI beat an MCP server for coding agents?
A: It costs no context until used, the agent learns it through --help, and it already runs with the user's credentials.
Q: What does --json need to guarantee?
A: One clean, parseable JSON document on stdout, with nothing else mixed in.
Q: Why must agent-facing CLIs avoid interactive prompts?
A: The agent can't answer them, so the command hangs. Put every choice behind a flag.
Q: When is MCP the better choice than a CLI?
A: When users are in chat apps with no shell, or each user must sign in to a hosted service.
```

```quiz
? An agent runs your CLI and it hangs forever. Most likely reason?
- The JSON output is too large
+ The command is waiting for an interactive confirmation
- The exit code was 0
= Agents can't type into prompts. Add a --yes flag and skip the prompt when stdin isn't a terminal.
```
