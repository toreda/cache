# Cache Policy Design — 1.0.0

Design spec for making `Cache` policy-agnostic and shipping named cache-type wrappers
(`LruCache`, `LfuCache`, etc.) as thin presets over a fully flag-configurable base.

## Model

A cache type is **not a profile or a strategy object** — it is a complete assignment of
independent feature flags. `Cache` natively implements every feature any type needs, each
behind its own cfg setting with a default. Defaults reproduce pre-1.0 behavior (insertion-order
eviction, no segments/ghosts/admission). Wrappers set **every** flag explicitly so their
behavior is pinned even if base defaults change.

Because each behavioral question gets exactly one cfg slot, contradictory combinations
(e.g. LRU + FIFO — two answers to "who leaves when full?") are structurally impossible,
while orthogonal features (LRU + TTL) combine freely.

The four behavioral axes:

1. **Expiration** — when does an item stop being valid? (`ttl`, sliding, prune)
2. **Eviction ordering** — who leaves at capacity? (`evict` group)
3. **Admission** — does a new item get in at all? (`itemValidator`, `admission` group)
4. **Access accounting** — what counts as a "use"? (per-operation `countsAsAccess`)

`CfgData` is data-only and fully serializable — a cache type is a JSON profile.
Function-valued options (validator, events, rng) live on `CacheInit`.

## Base refactor (phase 1)

### CacheItem metadata (always on)

- `addedSeq: number` — monotonic insertion sequence from a counter on `Cache`.
  Sequence counters, not timestamps: `@toreda/time` is second-resolution and ties
  make eviction order nondeterministic.
- `lastAccessSeq: number` — updated on qualifying accesses. Starts equal to `addedSeq`.
- `accessCount: number` — incremented on qualifying accesses.
- `policyData?: unknown` — slot owned by internal feature modules (CLOCK reference bit,
  segment tags, etc.).

`created` / `updated` / `ttl` remain; expiration stays an orthogonal axis.
`CacheItem` constructor becomes init-object based (breaking).

### Centralized removal

```ts
type CacheRemoveReason = 'delete' | 'evict' | 'expire' | 'overwrite';
protected removeItem(id: CacheItemId, reason: CacheRemoveReason): boolean;
```

All deletion sites (lazy expire in `getItem`, evict loop, `delete()`, `prune()`) route
through this one method. It updates the matching stat and emits the removal events.
Bulk `clear()`/`reset()` do NOT go item-by-item (see events).

### Internal feature modules

Flag-gated modules allocated only when enabled: segment accounting, ghost registry,
frequency sketch. A plain FIFO cache pays for none of them. Modules run off internal
paths, always before user events fire. The `Map` is **never reordered** — insertion
order is a load-bearing invariant (FIFO/LIFO/CLOCK traversal); ordering rules are
metadata scans (O(n) at victim-selection time, acceptable at typical capacities;
O(1) structures are a later optimization).

### Stats

Add `rejects` (adds refused by validator / capacity / admission). Every stat counter
has an event counterpart — stats answer "how many," events answer "which and when."

## CfgData (grouped flags)

```ts
interface CfgData {
	// ── Capacity ──────────────────────────────────────────────
	capacityMax: number;                 // 0 = unbounded
	initialSize: number;

	// ── Expiration ────────────────────────────────────────────
	ttl: number;                         // default TTL seconds; 0 = never

	// ── Per-operation settings ────────────────────────────────
	get:   {countsAsAccess: boolean;     // default true
	        slidesExpiration: boolean};  // default false
	has:   {countsAsAccess: boolean;     // default false
	        slidesExpiration: boolean};  // default false
	touch: {countsAsAccess: boolean};    // default true (touch always slides)

	// ── Prune ─────────────────────────────────────────────────
	prune: {auto: boolean;               // default false — interval timer, .unref() in Node
	        interval: number;            // seconds, default = minDelay
	        minDelay: number};           // absorbs pre-1.0 pruneDelay

	// ── Eviction ──────────────────────────────────────────────
	evict: {
		basis: 'insertion' | 'access' | 'frequency' | 'random' | 'none'; // default 'insertion'
		order: 'oldest' | 'newest';      // default 'oldest'; least/most for frequency
		secondChance: boolean;           // default false — accessed items skipped once (CLOCK)
		tieBreak: 'insertion' | 'access'; // default 'access' — frequency ties
	};

	// ── Segmentation ──────────────────────────────────────────
	segments: {
		enabled: boolean;                // default false — probation + protected regions
		protectedRatio: number;          // default 0.8 of capacityMax
		probationRatio: number;          // default 0.25 — 2Q kin; probation budget
		probationBasis: 'insertion' | 'access'; // default 'access' (SLRU); 'insertion' = 2Q A1in
		promoteOnHit: boolean;           // default true
	};

	// ── Ghost registry (ids only, no item data) ───────────────
	ghosts: {
		enabled: boolean;                // default false
		sizeRatio: number;               // default 0.5 of capacityMax — 2Q kout
		perSegment: boolean;             // default false — B1/B2 split (ARC)
	};

	// ── Adaptivity ────────────────────────────────────────────
	adaptive: boolean;                   // default false — ghost hits shift the
	                                     // probation/protected target (ARC's p)

	// ── Admission ─────────────────────────────────────────────
	admission: {
		policy: 'always' | 'frequency';  // default 'always'
		windowRatio: number;             // default 0.01 — W-TinyLFU entry window
		sketchResetThreshold: number;    // default 10 × capacityMax — counter halving
	};
}
```

## CacheInit (functions + cfg)

```ts
interface CacheInit<ItemT> {
	log?: LogLike;
	cfg?: Partial<CfgData>;              // deep-partial; per-group defaults
	itemValidator?: (item?: ItemT | null) => boolean;
	rng?: () => number;                  // random basis + sketch hashes; injectable = testable
	victimSelector?: (cache: Cache<ItemT>, candidateId: CacheItemId) => CacheItemId | null;
	                                     // escape hatch for rules no flag combo expresses;
	                                     // return null to reject the incoming add
	events?: CacheEvents<ItemT>;
}
```

## Events

```ts
interface CacheEvents<ItemT> {
	// ── Item lifecycle ────────────────────────────────────────
	onItemAdd?: (item: ItemT, id: CacheItemId) => void;
	onItemExpire?: (item: ItemT, id: CacheItemId, timeAdded: Time) => void;
	onItemEvict?: (item: ItemT, id: CacheItemId) => void;
	onItemRemove?: (item: ItemT, id: CacheItemId, reason: CacheRemoveReason) => void;
	onAddRejected?: (item: ItemT, reason: CacheRejectReason) => void;

	// ── Access (opt-in observability; zero cost when unset) ───
	onItemHit?: (item: ItemT, id: CacheItemId, source: 'get' | 'touch') => void;
	onItemMiss?: (id: CacheItemId) => void;

	// ── Cache-level ───────────────────────────────────────────
	onCapacityIncrease?: (oldMax: number, newMax: number) => void;
	onCapacityDecrease?: (oldMax: number, newMax: number) => void;
	onClear?: (count: number) => void;
	onReset?: () => void;
	onPrune?: (removed: number) => void;
}

type CacheRejectReason = 'validator' | 'admission' | 'capacity' | 'duplicate' | 'bad-id';
```

Semantics:

- **Specific-then-general.** Single-item removals fire the specific event
  (`onItemExpire` / `onItemEvict`) first, then `onItemRemove(reason)`, always.
  Emission lives in `removeItem` — one site.
- **Bulk clear fires no per-item events.** `clear()` / `reset()` fire `onClear(count)`
  once (`reset` additionally `onReset`). This is why `'clear'` is not a remove reason.
- **Post-commit, synchronous, exception-safe.** Callbacks fire after state + stats are
  committed; invoked sync fire-and-forget; each wrapped in try/catch and logged via
  `log` — a throwing callback never corrupts cache state.
- **Events observe, modules participate.** Internal feature modules never depend on
  user events and always run first.

## Named types as flag assignments

Wrappers set every flag; non-default values shown. All rows freely combine with the
expiration axis (e.g. LRU + TTL is just `{evict: {basis: 'access'}, ttl: 300}`).

| Type | evict.basis | evict.order | secondChance | segments | ghosts | adaptive | admission | expiration |
|---|---|---|---|---|---|---|---|---|
| `FifoCache` | insertion | oldest | — | — | — | — | always | optional |
| `LifoCache` | insertion | newest | — | — | — | — | always | optional |
| `LruCache` | access | oldest | — | — | — | — | always | optional |
| `MruCache` | access | newest | — | — | — | — | always | optional |
| `LfuCache` | frequency | oldest | — | — | — | — | always | optional |
| `RandomCache` | random | — | — | — | — | — | always | optional |
| `TtlCache` | none | — | — | — | — | — | always | **ttl > 0, prune.auto** |
| `ClockCache` | insertion | oldest | **true** | — | — | — | always | optional |
| `SlruCache` | access | oldest | — | **on** (probationBasis: access) | — | — | always | optional |
| `TwoQueueCache` | access | oldest | — | **on** (probationBasis: **insertion**) | **on** | — | always | optional |
| `ArcCache` | access | oldest | — | **on** | **on, perSegment** | **true** | always | optional |
| `TinyLfuCache` | access | oldest | — | **on** | — | — | **frequency** | optional |

Wrapper shape: `class LruCache<ItemT> extends Cache<ItemT>` pinning all flags in the
super call and typing init so pinned fields cannot be overridden. `TtlCache` constructor
additionally requires a positive default ttl and exposes `getRemainingTtl(id)`.

## Validation (init-time)

**Errors (throw):**

- `admission.policy: 'frequency'` with `evict.basis: 'none'` — admission compares against
  a victim; there is none.
- `adaptive: true` without `segments.enabled` + `ghosts.enabled` + `ghosts.perSegment`.
- `ghosts.enabled` with `evict.basis: 'none'`.
- `evict.secondChance` with `evict.basis: 'random'`.
- Ratio fields outside (0, 1); `protectedRatio + probationRatio > 1` with segments enabled.

**Warnings (log, proceed):**

- `evict.*` set with `capacityMax: 0` — eviction can never trigger.
- `prune.auto` with no ttl configured anywhere.
- `countsAsAccess` feeding nothing (basis insertion/random, no sliding, no segments,
  no admission).
- `evict.order` explicitly set with basis random/none.

## Breaking changes (1.0.0)

Forced by the plan:

1. `CfgData` restructure into grouped flags (`slidingExpiration` → per-op
   `slidesExpiration`; `pruneDelay` → `prune.minDelay`; new groups).
2. `capacityMax` field → getter + `setCapacity(next)`. Decrease below current size
   evicts immediately through the active policy, firing evict/remove events.
3. Init-time cfg validation throws on the error list above.
4. `CacheItem` init-object constructor + metadata fields + `policyData`.
5. `add` with overwrite fires `onItemRemove('overwrite')` before replacing.

API hardening while breaking is free:

6. `items` Map goes `protected` — public mutation bypasses stats, events, and policy
   bookkeeping. Public iteration via `keys()` / `values()` / new `entries()`.
7. Positional booleans → options objects: `add(item, {overwrite?, ttl?})`,
   `getOrAdd(id, factory, {ttl?})`, `prune({force?})`.
8. Public fields → protected: `itemValidator`, `itemTtl`, `pruneDelay`, `lastPrune`.
   Introspection via a read-only resolved-cfg getter (`cache.cfg`).
9. `size()` method → `size` getter (Map parity).
10. `clear()` added (items only, fires `onClear`); `reset()` = clear + restore
    stats/capacity (fires `onClear` + `onReset`).

Toolchain candidates (no API impact; depends on build-tools pin tolerance):

11. Compile target `es2015` → `es2020`; explicit `engines` field.

Post-1.0, everything additive (new wrappers, flags, events) ships as 1.x minors.

## Phasing

1. **Phase 1 — base refactor (gates 1.0.0).** Metadata, `removeItem`, grouped cfg +
   validation, events group, `setCapacity`, `rejects` stat, API hardening list.
   Defaults preserve current behavior; existing tests pass with only signature updates.
2. **Phase 2 — rule flags + TtlCache.** `evict` basis/order/tieBreak, per-op access
   settings, `prune.auto`. Wrappers: Fifo, Lifo, Lru, Mru, Lfu, Random, Ttl.
   Specs assert exact eviction order (seq counters are deterministic; inject `rng`).
3. **Phase 3 — secondChance + segments.** Wrappers: Clock, Slru.
4. **Phase 4 — ghosts, adaptive, admission sketch.** Wrappers: TwoQueue, Arc, TinyLfu.
   `onAddRejected('admission')` activates here.

Phases 2–4 are additive and may ship as 1.1 / 1.2 / 1.3 if 1.0 should ship sooner.

## Reference notes

- LFU aging is deliberately not in base `evict` — frequency decay belongs to the
  TinyLFU sketch (`sketchResetThreshold` halving).
- ARC's IBM patents (filed 2002–2003) have expired.
- ARC and TinyLFU shine with read-through access; existing `getOrAdd` is the natural
  pairing and needs no changes.
- LRU O(1) fast path (Map reorder on access) is possible but forfeits the
  insertion-order invariant; only viable if scoped strictly inside `LruCache`, and only
  worth doing if profiling demands it.
