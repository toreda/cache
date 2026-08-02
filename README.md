![Toreda](https://content.toreda.com/logo/toreda-logo.png)

[![CI](https://img.shields.io/github/actions/workflow/status/toreda/cache/main.yml?branch=master&style=for-the-badge)](https://github.com/toreda/cache/actions) [![GitHub issues](https://img.shields.io/github/issues/toreda/cache?style=for-the-badge)](https://github.com/toreda/cache/issues)


[![GitHub package.json version (branch)](https://img.shields.io/github/package-json/v/toreda/cache/master?style=for-the-badge)](https://github.com/toreda/cache/releases/latest)
[![GitHub Release Date](https://img.shields.io/github/release-date/toreda/cache?style=for-the-badge)](https://github.com/toreda/cache/releases/latest)

[![license](https://img.shields.io/github/license/toreda/cache?style=for-the-badge)](https://github.com/toreda/cache/blob/master/LICENSE)

&nbsp;
# `@toreda/cache`
TypeScript caches for different use cases.

&nbsp;


# Constructor params

Every cache type takes a single optional init object. The named wrappers accept the same object
minus the `cfg` flags they pin, and `TtlCache` additionally requires `cfg.ttl`.

| Param | Purpose | Default |
|---|---|---|
| `log` | Log instance (`LogLike`) used for cache activity & diagnostic output. | None — logging disabled. |
| `cfg` | Deep-partial, data-only config merged over defaults (see table below). | All defaults — simple FIFO + TTL behavior. |
| `itemValidator` | Called on every `add`; return `false` to reject the item (`onAddReject('validator')`). | None — all items accepted. |
| `rng` | Random source for the `random` eviction basis and sketch hashing. Inject for deterministic tests. | `Math.random` |
| `evictionTargetSelector` | Escape hatch for eviction target selection rules no flag combination expresses. Returns the id to evict, or `null` to reject the incoming add. | None — selection follows `cfg.evict`. |
| `events` | Observability callbacks (`onItemAdd`, `onItemEvict`, `onItemExpire`, `onAddReject`, …), fired synchronously post-commit. | `{}` — no callbacks. |

## `cfg` options

| Option | Purpose | Default |
|---|---|---|
| `capacityMax` | Maximum number of items. `0` = unbounded. | `1000` |
| `initialSize` | Initial size hint for an empty cache. | `0` |
| `ttl` | Default TTL (seconds) for items added without an explicit `ttl`. `0` = never expire. | `30` |
| `get.countsAsAccess` | A `get` call counts as an access for eviction accounting. | `true` |
| `get.slidesExpiration` | A `get` refreshes the item's expiration window. | `false` |
| `has.countsAsAccess` | A `has` call counts as an access for eviction accounting. | `false` |
| `has.slidesExpiration` | A `has` refreshes the item's expiration window. | `false` |
| `touch.countsAsAccess` | A `touch` call counts as an access for eviction accounting. | `true` |
| `prune.auto` | Interval timer prunes expired items automatically. | `false` |
| `prune.interval` | Seconds between auto-prune runs. | `10` |
| `prune.minDelay` | Minimum seconds allowed between `prune()` calls. | `10` |
| `evict.basis` | Metadata axis that chooses the eviction target: `insertion`, `access`, `frequency`, `random`, or `none`. | `insertion` |
| `evict.order` | Direction along the basis: `oldest` or `newest`. | `oldest` |
| `evict.secondChance` | Accessed items get one skip before eviction (CLOCK). | `false` |
| `evict.tieBreak` | Tie-break for frequency ties: `access` or `insertion`. | `access` |
| `segments.enabled` | Split the cache into probation + protected regions. | `false` |
| `segments.protectedRatio` | Protected region size as a fraction of `capacityMax`. | `0.8` |
| `segments.probationRatio` | Probation budget as a fraction of `capacityMax` (2Q A1in). | `0.25` |
| `segments.probationBasis` | Basis used to pick a probation eviction target: `access` (SLRU) or `insertion` (2Q). | `access` |
| `segments.promoteOnHit` | A probation-region hit promotes the item to protected. | `true` |
| `ghosts.enabled` | Keep a bounded, ids-only registry of recently-evicted items. | `false` |
| `ghosts.sizeRatio` | Ghost registry size as a fraction of `capacityMax`. | `0.5` |
| `ghosts.perSegment` | Split ghosts into recency/frequency lists (ARC B1/B2). | `false` |
| `adaptive` | Ghost hits shift the probation/protected balance (ARC's `p`). | `false` |
| `admission.policy` | `always` admits every newcomer; `frequency` compares sketch estimates (W-TinyLFU). | `always` |
| `admission.windowRatio` | W-TinyLFU entry window as a fraction of `capacityMax`. | `0.01` |
| `admission.sketchResetThreshold` | Sketch counter-halving threshold. `0` = derived from capacity. | `0` |

## `events` callbacks
Callbacks provide external visibility into cache state changes.

Every callback is optional and costs nothing when unset. Callbacks fire post-commit (state and
stats already updated), synchronously, each wrapped in try/catch — a throwing callback is logged
and never corrupts cache state.

| Event | Signature | Fired when |
|---|---|---|
| `onItemAdd` | `(item, id)` | An item is successfully added. |
| `onItemExpire` | `(item, id, timeAdded)` | An item is removed because its TTL elapsed. Precedes `onItemRemove`. |
| `onItemEvict` | `(item, id)` | An item is removed to make room at capacity. Precedes `onItemRemove`. |
| `onItemRemove` | `(item, id, reason)` | Every single-item removal, after any specific event. Reasons: `delete`, `evict`, `expire`, `overwrite`. |
| `onAddReject` | `(item, reason)` | An `add` call is refused. Reasons: `validator`, `admission`, `capacity`, `duplicate`, `bad-id`. |
| `onItemHit` | `(item, id, source)` | A cache hit via `get` or `touch` (`source` names which). |
| `onItemMiss` | `(id)` | A `get` miss. |
| `onCapacityIncrease` | `(oldMax, newMax)` | Capacity is raised via `setCapacity`. |
| `onCapacityDecrease` | `(oldMax, newMax)` | Capacity is lowered via `setCapacity`. |
| `onClear` | `(count)` | Once per `clear()` / `reset()` with the number of items removed. |
| `onReset` | `()` | By `reset()`, after `onClear`. |
| `onPrune` | `(removed)` | Whenever `prune()` actually runs (not delay-gated), including when 0 items were removed. |

Single-item removals fire the specific event (`onItemExpire` / `onItemEvict`) first, then the
general `onItemRemove`. Bulk `clear()` / `reset()` fire only `onClear` (and `onReset`) — never
per-item events.

```typescript
const cache = new LruCache<User>({
	cfg: {capacityMax: 500, ttl: 300},
	events: {
		onItemEvict: (item, id) => console.log(`evicted ${id}`),
		onItemExpire: (item, id) => console.log(`expired ${id}`),
		onAddReject: (item, reason) => console.warn(`add refused: ${reason}`)
	}
});
```

&nbsp;

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

## Cache types

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

All examples below use the `User` interface defined above.

## `FifoCache`

First-in, first-out. Insertion order alone decides the eviction target — reads never reorder anything:

```typescript
import {FifoCache} from '@toreda/cache';

const cache = new FifoCache<User>({cfg: {capacityMax: 2}});

cache.add({id: 'a', name: 'Ada'});
cache.add({id: 'b', name: 'Grace'});
cache.get('a'); // Reads don't affect FIFO order.
cache.add({id: 'c', name: 'Edsger'}); // Evicts 'a' — the oldest insert.
```

## `LifoCache`

Last-in, first-out — the newest insert is sacrificed to protect older entries:

```typescript
import {LifoCache} from '@toreda/cache';

const cache = new LifoCache<User>({cfg: {capacityMax: 2}});

cache.add({id: 'a', name: 'Ada'});
cache.add({id: 'b', name: 'Grace'});
cache.add({id: 'c', name: 'Edsger'}); // Evicts 'b' — the newest insert; 'a' survives.
```

## `LruCache`

Least-recently used. Every `get` / `touch` refreshes an item's recency:

```typescript
import {LruCache} from '@toreda/cache';

const cache = new LruCache<User>({cfg: {capacityMax: 2}});

cache.add({id: 'a', name: 'Ada'});
cache.add({id: 'b', name: 'Grace'});
cache.get('a'); // 'a' is now most-recent.
cache.add({id: 'c', name: 'Edsger'}); // Evicts 'b' — least-recently used.
```

## `MruCache`

Most-recently used — evicts the hottest item, useful for cyclic scans where the item you just
read is the one you'll need last:

```typescript
import {MruCache} from '@toreda/cache';

const cache = new MruCache<User>({cfg: {capacityMax: 2}});

cache.add({id: 'a', name: 'Ada'});
cache.add({id: 'b', name: 'Grace'});
cache.get('a'); // 'a' is now most-recent.
cache.add({id: 'c', name: 'Edsger'}); // Evicts 'a' — the most-recently used.
```

## `LfuCache`

Least-frequently used. Each read increments a hit count; ties fall back to least-recent:

```typescript
import {LfuCache} from '@toreda/cache';

const cache = new LfuCache<User>({cfg: {capacityMax: 2}});

cache.add({id: 'a', name: 'Ada'});
cache.add({id: 'b', name: 'Grace'});
cache.get('a');
cache.get('a'); // 'a' has 2 hits, 'b' has 0.
cache.add({id: 'c', name: 'Edsger'}); // Evicts 'b' — the least-frequently used.
```

## `RandomCache`

Uniform random replacement. Inject `rng` to make eviction deterministic in tests:

```typescript
import {RandomCache} from '@toreda/cache';

const cache = new RandomCache<User>({
	cfg: {capacityMax: 1000},
	rng: () => 0.42 // Optional — defaults to Math.random.
});
```

## `TtlCache`

Pure expiration — no capacity evictions, items leave only when their (required) TTL elapses.
An auto-prune timer sweeps expired items; call `stopAutoPrune()` when done with the cache:

```typescript
import {TtlCache} from '@toreda/cache';

const cache = new TtlCache<User>({
	cfg: {ttl: 60} // Seconds. Required, and capacity is unbounded by default.
});

cache.add({id: 'a', name: 'Ada'});
cache.getRemainingTtl('a'); // Whole seconds until expiry, or null once gone.
cache.stopAutoPrune(); // Release the sweep timer on shutdown.
```

## `ClockCache`

CLOCK (second-chance FIFO). A hand sweeps insertion order, but an accessed item gets one
reprieve before eviction — LRU-like behavior without reordering on every read:

```typescript
import {ClockCache} from '@toreda/cache';

const cache = new ClockCache<User>({cfg: {capacityMax: 2}});

cache.add({id: 'a', name: 'Ada'});
cache.add({id: 'b', name: 'Grace'});
cache.get('a'); // Marks 'a' referenced.
cache.add({id: 'c', name: 'Edsger'}); // 'a' is spared once; 'b' is evicted instead.
```

## `SlruCache`

Segmented LRU. New items sit in probation; a hit promotes them into the protected region, so a
one-time scan of new ids can't displace the working set:

```typescript
import {SlruCache} from '@toreda/cache';

const cache = new SlruCache<User>({
	cfg: {
		capacityMax: 1000,
		segments: {protectedRatio: 0.8} // Optional — protected region share (default 0.8).
	}
});
```

## `TwoQueueCache`

2Q. A FIFO probation queue (A1in) absorbs newcomers and a ghost list (A1out) remembers recent
evictees — a quick re-reference admits an id straight into the main LRU region:

```typescript
import {TwoQueueCache} from '@toreda/cache';

const cache = new TwoQueueCache<User>({
	cfg: {
		capacityMax: 1000,
		segments: {probationRatio: 0.25}, // Optional — A1in share (default 0.25).
		ghosts: {sizeRatio: 0.5} // Optional — A1out budget vs capacity (default 0.5).
	}
});
```

## `ArcCache`

ARC. Self-tuning — per-segment ghost lists track whether recency or frequency evictions are
being regretted, and the balance point adapts toward whichever is winning:

```typescript
import {ArcCache} from '@toreda/cache';

const cache = new ArcCache<User>({
	cfg: {
		capacityMax: 1000,
		segments: {protectedRatio: 0.5} // Optional — ARC's starting balance point (default 0.5).
	}
});
```

## `TinyLfuCache`

W-TinyLFU. A count-min sketch estimates access frequency, and a newcomer is only admitted over
the resident eviction target when the sketch says it's at least as popular — `add` returns `false` when
admission is refused:

```typescript
import {TinyLfuCache} from '@toreda/cache';

const cache = new TinyLfuCache<User>({
	cfg: {
		capacityMax: 1000,
		admission: {
			windowRatio: 0.01, // Optional — entry window share (default 0.01).
			sketchResetThreshold: 100_000 // Optional — halve sketch counts after this many increments.
		}
	}
});

const admitted = cache.add({id: 'rare', name: 'One-hit wonder'});
// admitted === false when the frequency sketch refuses the newcomer at capacity.
```

## Combining policies with expiration

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
`@toreda/cache` is an open source package provided under the MIT License. Download, clone, or check the complete project source [here on Github](https://github.com/toreda/cache). We welcome bug reports, comments, and pull requests.

&nbsp;
# Legal

## License
[MIT](LICENSE) &copy; Toreda, Inc.

## Copyright
Copyright &copy; 2019 - 2026 Toreda, Inc. All Rights Reserved.

&nbsp;

# Website
https://www.toreda.com

