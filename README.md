![Toreda](https://content.toreda.com/logo/toreda-logo.png)

[![CI](https://img.shields.io/github/workflow/status/toreda/cache/CI?style=for-the-badge)](https://github.com/toreda/cache/actions) [![Coverage](https://img.shields.io/sonar/coverage/toreda_cache?server=https%3A%2F%2Fsonarcloud.io&style=for-the-badge)](https://sonarcloud.io/dashboard?id=toreda_cache) ![Sonar Quality Gate](https://img.shields.io/sonar/quality_gate/toreda_cache?server=https%3A%2F%2Fsonarcloud.io&style=for-the-badge) [![GitHub issues](https://img.shields.io/github/issues/toreda/cache?style=for-the-badge)](https://github.com/toreda/cache/issues)


[![GitHub package.json version (branch)](https://img.shields.io/github/package-json/v/toreda/cache/master?style=for-the-badge)](https://github.com/toreda/cache/releases/latest)
[![GitHub Release Date](https://img.shields.io/github/release-date/toreda/cache?style=for-the-badge)](https://github.com/toreda/cache/releases/latest)

[![license](https://img.shields.io/github/license/toreda/cache?style=for-the-badge)](https://github.com/toreda/cache/blob/master/LICENSE)

&nbsp;
# `@toreda/cache`
Simple TTL-based object cache in TypeScript.

&nbsp;


# Install
`@toreda/cache` is available as an [NPM package](https://www.npmjs.com/package/@toreda/cache).

&nbsp;

**Install with yarn:**
```bash
yarn add @toreda/cache
```

**or Install with NPM:**
```bash
npm install @toreda/cache
```

# Usage

The base `Cache` is policy-agnostic — every behavior is a config flag with a default that
reproduces simple FIFO + TTL behavior:

```typescript
import {Cache} from '@toreda/cache';

interface User {
	[k: string]: unknown;
	id: string;
	name: string;
}

const cache = new Cache<User>({
	cfg: {capacityMax: 1000, ttl: 300},
	events: {
		onItemEvict: (item, id) => console.log(`evicted ${id}`)
	}
});

cache.add({id: 'u-1', name: 'Ada'});
const user = cache.getOrAdd('u-2', (id) => ({id, name: 'Grace'}));
console.log(cache.size, cache.get('u-1'));
```

# Cache types

Named wrappers pin the eviction flags for a well-known replacement policy. Every type combines
freely with the expiration axis (`ttl`, sliding, prune) — the eviction policy and TTL are
independent.

| Type | Policy — who leaves at capacity |
|---|---|
| `FifoCache` | Oldest **inserted** item. |
| `LifoCache` | Newest **inserted** item. |
| `LruCache` | **Least-recently** used item. |
| `MruCache` | **Most-recently** used item. |
| `LfuCache` | **Least-frequently** used item (ties: least-recent). |
| `RandomCache` | A uniformly **random** item (inject `rng` for determinism). |
| `TtlCache` | **Nothing** — items leave only on TTL expiry (auto-pruned). Adds `getRemainingTtl(id)`. |
| `ClockCache` | Insertion order with a **second-chance** reprieve for accessed items (CLOCK). |
| `SlruCache` | **Segmented LRU** — probation feeds a protected region; scan-resistant. |
| `TwoQueueCache` | **2Q** — FIFO probation + ghost list; re-referenced ids promote to the main region. |
| `ArcCache` | **ARC** — adapts the recency/frequency balance from per-segment ghost hits. |
| `TinyLfuCache` | **W-TinyLFU** — a frequency sketch gates admission; rare newcomers are refused. |

Mix-and-match — an LRU cache with a 5-minute default TTL and sliding expiration on reads:

```typescript
import {LruCache} from '@toreda/cache';

const cache = new LruCache<User>({
	cfg: {
		capacityMax: 500,
		ttl: 300,
		get: {slidesExpiration: true}
	}
});
```

Wrappers remove the flags they pin from the caller's `cfg` type, so contradictory combinations
(e.g. asking an `LruCache` for FIFO eviction) are a compile-time error while orthogonal features
still combine.

# Source Code
`@toreda/cache` is an open source package provided under the MIT License. Download, clone, or check the complete project source [here on Github](https://www.npmjs.com/package/@toreda/cache). We welcome bug reports, comments, and pull requests.

&nbsp;
# Legal

## License
[MIT](LICENSE) &copy; Toreda, Inc.

## Copyright
Copyright &copy; 2019 - 2022 Toreda, Inc. All Rights Reserved.

&nbsp;

# Website
https://www.toreda.com

