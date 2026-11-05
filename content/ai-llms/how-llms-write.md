---
title: How an LLM writes a sentence
summary: It guesses one token at a time. Chat, code and "reasoning" are all built on that single trick.
tags: [basics, tokens, training]
order: 1
date: 2026-11-05
---

## The one trick

A large language model does exactly one thing: given some text, it predicts which token comes next. It appends that token and predicts again, so a 300-word answer is roughly 400 guesses in a row, and nowhere in that loop does it outline the whole reply first the way you'd plan an essay.

<figure class="dg"><svg viewBox="0 0 420 256" role="img" aria-label="Five tokens go into the model, which scores every possible next token">
<g class="pop" style="animation-delay:0s"><rect class="box" x="15" y="14" width="60" height="34" rx="9"/><text x="45" y="36" text-anchor="middle">The</text></g>
<g class="pop" style="animation-delay:.08s"><rect class="box" x="85" y="14" width="60" height="34" rx="9"/><text x="115" y="36" text-anchor="middle">cat</text></g>
<g class="pop" style="animation-delay:.16s"><rect class="box" x="155" y="14" width="60" height="34" rx="9"/><text x="185" y="36" text-anchor="middle">sat</text></g>
<g class="pop" style="animation-delay:.24s"><rect class="box" x="225" y="14" width="60" height="34" rx="9"/><text x="255" y="36" text-anchor="middle">on</text></g>
<g class="pop" style="animation-delay:.32s"><rect class="box" x="295" y="14" width="60" height="34" rx="9"/><text x="325" y="36" text-anchor="middle">the</text></g>
<g class="pop" style="animation-delay:.5s"><rect class="box hot dashed" x="365" y="14" width="40" height="34" rx="9"/><text x="385" y="36" text-anchor="middle" class="b">?</text></g>
<path class="flow" d="M210 54 V82"/>
<rect class="box hot" x="125" y="86" width="170" height="46" rx="12"/><text x="210" y="114" text-anchor="middle" class="b">Model</text>
<path class="flow" d="M210 138 V160"/>
<text x="110" y="181" text-anchor="end">mat</text><rect class="bar" x="120" y="169" width="174" height="14" rx="4" style="animation-delay:.2s"/><text class="m" x="302" y="181">62%</text>
<text x="110" y="203" text-anchor="end">floor</text><rect class="bar dim" x="120" y="191" width="50" height="14" rx="4" style="animation-delay:.3s"/><text class="m" x="178" y="203">18%</text>
<text x="110" y="225" text-anchor="end">sofa</text><rect class="bar dim" x="120" y="213" width="25" height="14" rx="4" style="animation-delay:.4s"/><text class="m" x="153" y="225">9%</text>
<text x="110" y="247" text-anchor="end">roof</text><rect class="bar dim" x="120" y="235" width="8" height="14" rx="4" style="animation-delay:.5s"/><text class="m" x="136" y="247">3%</text>
</svg><figcaption>The model scores every token it knows. In this made-up example "mat" wins, gets appended, and the loop runs again.</figcaption></figure>

## Tokens, not words

Models never see letters or whole words. They see **tokens**, chunks of text from a fixed vocabulary that's usually somewhere between 100,000 and 200,000 pieces. Common words get one token each, while a rare word gets chopped up, so `unbelievable` might come out as `un` + `believ` + `able`.

> [!tip] Rule of thumb
> In English, one token is about ¾ of a word, so 1,000 tokens is roughly 750 words. Prices and context limits are both counted in tokens, which is why this number keeps coming up.

## Where the guesses come from

Training happens in two big stages, and they do very different jobs:

```steps
Pre-training :: The model reads an enormous pile of text and learns to predict the next token. Its knowledge and grammar come from here. It's the expensive part: months on thousands of GPUs.
Post-training :: People (and other models) show it good conversations, rate its answers and nudge it toward being helpful and honest. This is what turns a text-completer into an assistant.
```

## Knobs you'll actually touch

| Setting | What it changes |
|---|---|
| Context window | How many tokens the model can see at once: your prompt, any files, and its own reply so far. |
| Temperature | How adventurous each pick is. `0` takes the likeliest token almost every time; higher values let less likely tokens through. |
| Max tokens | A hard cap on reply length. Hit it and the answer stops mid-sentence. |

## Why it sometimes makes things up

Each token gets picked because it *sounds* right after everything before it. Most of the time "sounds right" and "is right" overlap; when the model doesn't actually know a fact, the most natural-sounding continuation can still be confident and wrong. That's a hallucination. Putting the real source text into the prompt fixes most of it, and that idea has a name, RAG, which gets its own note in this folder later.

```flashcards
Q: What does an LLM predict at each step?
A: The next token, given all the text before it.
Q: Roughly how many words is 1,000 tokens?
A: About 750 English words.
Q: What does temperature 0 do?
A: The model takes the most likely token nearly every time, so the same prompt gives near-identical answers.
Q: Which training stage gives the model its knowledge?
A: Pre-training, the long next-token-prediction run over a huge pile of text.
```

```quiz
? You ask for a long report and it cuts off mid-sentence. What's the likely cause?
- The temperature is set too high
+ The reply hit the max tokens limit
- The model ran out of things it knows
= Max tokens is a hard stop. The model doesn't get a chance to wrap up; generation just halts.
```
