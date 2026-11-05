---
title: Accounts, programs and transactions
summary: On Solana everything is an account, programs hold no state of their own, and every transaction names its accounts up front so the chain can run many at once.
tags: [basics, accounts, runtime]
order: 1
date: 2026-11-05
---

## Everything is an account

Every piece of state on Solana lives in an **account**: your SOL balance, a USDC balance, an NFT's metadata, even the compiled code of a program. Think of an account as a box with an address on it, holding some lamports and a blob of bytes, plus a note saying which program is allowed to change those bytes.

| Field | What it holds |
|---|---|
| `address` | A 32-byte public key, shown as a base58 string |
| `lamports` | The balance. 1 SOL = 1,000,000,000 lamports |
| `data` | Raw bytes. A token account keeps its mint, owner and amount here |
| `owner` | The program that's allowed to write to `data` |
| `executable` | `true` if this account is itself a program |

## Programs don't keep state

On Ethereum a smart contract stores its own variables inside itself. A Solana **program** can't; it's stateless code, and anything it needs to read or write has to be handed to it as separate accounts. That feels clumsy for the first week. The payoff shows up in the next section.

## Transactions list their accounts up front

Before it runs, every transaction declares exactly which accounts it'll read and which it'll write. Because the runtime (called Sealevel) knows this in advance, it can spot transactions that don't touch the same accounts and run them at the same time on different CPU cores.

<figure class="dg"><svg viewBox="0 0 420 226" role="img" aria-label="Tx A and Tx B run in parallel; Tx C waits for Tx A because both write Bob">
<text class="m" x="12" y="64">Core 1</text>
<text class="m" x="12" y="144">Core 2</text>
<rect class="lane" x="66" y="30" width="344" height="60" rx="10"/>
<rect class="lane" x="66" y="110" width="344" height="60" rx="10"/>
<g class="pop" style="animation-delay:.1s"><rect class="box hot" x="76" y="38" width="140" height="44" rx="8"/><text x="88" y="57" class="b">Tx A</text><text x="88" y="74" class="m">writes Alice, Bob</text></g>
<g class="pop" style="animation-delay:.1s"><rect class="box hot" x="76" y="118" width="140" height="44" rx="8"/><text x="88" y="137" class="b">Tx B</text><text x="88" y="154" class="m">writes Carol, Dan</text></g>
<g class="pop" style="animation-delay:.9s"><rect class="box" x="226" y="38" width="176" height="44" rx="8"/><text x="238" y="57" class="b">Tx C</text><text x="238" y="74" class="m">writes Bob, Eve</text></g>
<text class="m pop" x="226" y="104" style="animation-delay:1.1s">C waits: it shares Bob with A</text>
<path class="ln" d="M76 196 H396"/><path class="ln" d="M388 190 L398 196 L388 202"/>
<text class="m" x="76" y="218">time</text>
</svg><figcaption>A and B touch different accounts, so they run side by side. C has to wait for A to finish with Bob.</figcaption></figure>

> [!note] Numbers worth remembering
> A slot is about 400 ms. The base fee is 5,000 lamports per signature, so a plain transfer costs 0.000005 SOL before any priority fee.

## Rent

Every account takes up space on every validator, so the network asks each one to hold a minimum balance. Keep at least two years' worth of "rent" in it and the account becomes **rent-exempt**, which in practice is what everyone does. When you close an account, those lamports come back to you.

```flashcards
Q: Where does a Solana program store its state?
A: It doesn't. State lives in separate accounts that get passed into the program.
Q: How many lamports are in 1 SOL?
A: 1,000,000,000 (one billion).
Q: Why can Solana run transactions in parallel?
A: Each transaction lists the accounts it reads and writes up front, so the runtime can run non-overlapping ones at the same time.
Q: What does rent-exempt mean?
A: The account holds at least two years of rent as a minimum balance, so it never gets charged or removed.
```

```quiz
? Two transactions both write to the same token account. What happens?
- They run in parallel and the last write wins
+ They run one after the other
- The second one always fails
= Writes to the same account can't overlap, so the runtime puts them in sequence.
```
