---
title: Caching, the first fix for slow
summary: Keep a copy of hot data somewhere faster than the database. Storing the copy is easy; knowing when it's gone stale is the real work.
tags: [caching, redis, performance]
order: 1
date: 2026-11-05
---

## Why it works

Most apps read the same small slice of data over and over. The homepage, the top 50 products, the logged-in user's profile. A database has to go to disk and run the query each time, while a cache like Redis keeps the answer in memory and hands it back in well under a millisecond. So you keep a copy of the hot stuff close and only bother the database when you have to.

## Cache-aside, the pattern you'll use most

<figure class="dg"><svg viewBox="0 0 420 240" role="img" aria-label="App checks the cache first, reads the database on a miss, then saves a copy in the cache">
<rect class="box" x="16" y="95" width="104" height="50" rx="10"/><text x="68" y="125" text-anchor="middle" class="b">Your app</text>
<g class="pop" style="animation-delay:.1s"><rect class="box hot" x="290" y="20" width="114" height="52" rx="10"/><text x="347" y="42" text-anchor="middle" class="b">Cache</text><text x="347" y="60" text-anchor="middle" class="m">Redis, in memory</text></g>
<g class="pop" style="animation-delay:.3s"><rect class="box" x="290" y="168" width="114" height="52" rx="10"/><text x="347" y="190" text-anchor="middle" class="b">Database</text><text x="347" y="208" text-anchor="middle" class="m">Postgres, on disk</text></g>
<path class="flow" d="M122 108 C190 108 220 46 286 46"/>
<path class="flow slow" d="M122 132 C190 132 220 194 286 194"/>
<path class="flow" style="animation-direction:reverse" d="M347 166 V76"/>
<text class="m" x="128" y="36">1 · check here first</text>
<text class="m" x="128" y="214">2 · miss? read here</text>
<text class="m" x="338" y="125" text-anchor="end">3 · save a copy</text>
</svg><figcaption>Cache-aside: the app asks the cache, falls back to the database on a miss, then writes the answer into the cache for next time.</figcaption></figure>

```js
async function getUser(id) {
  const hit = await redis.get(`user:${id}`);
  if (hit) return JSON.parse(hit);

  const user = await db.users.find(id);
  await redis.set(`user:${id}`, JSON.stringify(user), { EX: 300 }); // 5 min TTL
  return user;
}
```

## The hard part: stale copies

The moment someone updates their profile, the cached copy is wrong. You've got two tools, and most real systems use both:

- **TTL (time to live).** Every key expires after N seconds, so a wrong value can only stick around that long. Simple, and it covers the cases you forgot about.
- **Delete on write.** When the data changes, delete the cache key in the same code path. The next read misses and fetches the fresh row.

> [!warn] The stampede
> A popular key expires and 10,000 requests miss at once, all hitting the database together. Fixes: let only one request rebuild the key while the others wait, or refresh hot keys a little before they expire.

## Where caches live

| Layer | Example | Good for |
|---|---|---|
| Browser | HTTP `Cache-Control` | Images, JS, CSS |
| CDN | Cloudflare, CloudFront | Whole pages and files, close to the user |
| App memory | A `Map` in the server process | Tiny config that rarely changes |
| Shared cache | Redis, Memcached | Query results shared across servers |

The number to watch is the **hit ratio**: hits divided by total reads. If it's low, you're caching the wrong things or expiring them too fast.

```flashcards
Q: What is cache-aside?
A: The app checks the cache first, reads the database on a miss, then stores the result in the cache.
Q: What does a TTL do?
A: It makes a key expire after a set time, which limits how long a stale value can survive.
Q: What's a cache stampede?
A: A hot key expires and a flood of requests all miss and hit the database at the same moment.
Q: What is the hit ratio?
A: Cache hits divided by total reads. Higher means the cache is doing its job.
```

```quiz
? A user changes their name but still sees the old one for a few minutes. What's the simplest fix?
- Turn off the cache entirely
+ Delete the user's cache key whenever the profile is updated
- Increase the TTL
= Deleting on write means the next read misses and pulls the fresh row. A longer TTL would make it worse.
```
