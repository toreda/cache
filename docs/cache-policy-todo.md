# 1.0.0 Implementation Todo — Cache Policy Refactor

Implementation checklist for [cache-policy-design.md](./cache-policy-design.md). Read that
doc first — it is the authority on behavior. This doc is the authority on task order,
file layout, and acceptance criteria.

## How to work

- Complete tasks **in order** within a phase. Phase 1 must be fully green before phase 2.
- After each task: `pnpm test:fast`. Before checking off a phase: `pnpm test && pnpm lint`.
- Check off tasks by editing this file (`[ ]` → `[x]`).
- Phase 1 ends with version `1.0.0` in package.json. Phases 2–4 are additive (1.x minors)
  but are all in scope for this effort.

## Hard rules (violating any of these is a defect)

1. **Never reorder `items` Map entries.** Insertion order is load-bearing (FIFO/LIFO/CLOCK
   traversal). No delete+re-set to "move" a key. Ordering comes from metadata scans.
2. **Ordering uses sequence counters, never timestamps.** `@toreda/time` is
   second-resolution; timestamps tie and make eviction nondeterministic.
3. **Every single-item removal goes through `removeItem(id, reason)`.** No direct
   `this.items.delete()` outside `removeItem` and the bulk-clear path.
4. **User event callbacks fire post-commit** (state + stats already updated), synchronously,
   each wrapped in try/catch (log the error via `this.log?.error`, never rethrow).
5. **Internal feature modules never depend on user events** and always update before user
   events fire.
6. Match existing code style: tabs, MIT header block (2019–2026) on every new src file,
   `import type` for type-only imports, JSDoc on public members, `@category` tags.
7. New behavior requires new tests. Do not delete existing assertions — update them for
   new signatures.

## Existing files you must read before starting

- `src/cache.ts`, `src/cache/item.ts`, `src/cache/init.ts`, `src/cache/stats.ts`
- `src/cfg/data.ts`, `src/defaults.ts`, `src/index.ts`
- `tests/cache.spec.ts` (existing patterns for Time mocking and cache setup)

---

## Phase 1 — Base refactor + API hardening (gates 1.0.0)

### 1.1 Reason types

- [x] Create `src/cache/remove/reason.ts`:
  ```ts
  export type CacheRemoveReason = 'delete' | 'evict' | 'expire' | 'overwrite';
  ```
- [x] Create `src/cache/reject/reason.ts`:
  ```ts
  export type CacheRejectReason = 'validator' | 'admission' | 'capacity' | 'duplicate' | 'bad-id';
  ```
- [x] Export both from `src/index.ts`.

### 1.2 Defaults expansion

- [x] Rewrite `Defaults` in `src/defaults.ts` to cover every cfg field in the design doc's
  `CfgData`, grouped the same way (`Defaults.Cache.Get.CountsAsAccess = true`, etc.).
  Keep `CacheItem.TTL = 30`, `Cache.CapacityMax = 1000`. `PruneDelay: 10` becomes
  `Prune.MinDelay: 10`. Defaults must reproduce pre-1.0 behavior:
  `Evict.Basis: 'insertion'`, `Evict.Order: 'oldest'`, `Evict.SecondChance: false`,
  `Evict.TieBreak: 'access'`, everything in `segments`/`ghosts`/`admission` off/`'always'`,
  `adaptive: false`, `prune.auto: false`, `has.countsAsAccess: false`,
  `has.slidesExpiration: false`, `get.countsAsAccess: true`, `get.slidesExpiration: false`,
  `touch.countsAsAccess: true`.

### 1.3 CfgData restructure

- [x] Rewrite `src/cfg/data.ts` to the exact grouped `CfgData` interface in the design doc.
  Define each group as its own named interface in its own file, re-exported from
  `src/cfg/data.ts`:
  - `src/cfg/evict.ts` → `CfgEvict`
  - `src/cfg/segments.ts` → `CfgSegments`
  - `src/cfg/ghosts.ts` → `CfgGhosts`
  - `src/cfg/admission.ts` → `CfgAdmission`
  - `src/cfg/prune.ts` → `CfgPrune`
  - `src/cfg/ops.ts` → `CfgGetOp`, `CfgHasOp`, `CfgTouchOp`
- [x] Create `src/cfg/partial.ts` → `CfgPartial`: every top-level field optional AND every
  group's fields optional (write it explicitly with `Partial<CfgEvict>` etc. — do not use
  a generic DeepPartial). This is the type of `CacheInit.cfg`.
- [x] Export all new types from `src/index.ts`.

### 1.4 Cfg resolution + validation

- [x] Create `src/cfg/resolve.ts` → `export function cfgResolve(cfg?: CfgPartial): CfgData`.
  Merges the partial over `Defaults` group-by-group (explicit per-field, using
  `numberValue`/boolean checks like the current ctor does — invalid types fall back to
  defaults). `prune.interval` defaults to the resolved `prune.minDelay` when not provided.
  `admission.sketchResetThreshold` defaults to `10 * resolved capacityMax`.
- [x] Create `src/cfg/validate.ts` →
  `export function cfgValidate(cfg: CfgData, log?: LogLike): void`.
  Implements the design doc's validation section exactly. Errors `throw new Error(...)`
  with a message naming both conflicting fields. Warnings call `log?.warn(...)` and
  continue. Write one test per error rule and one per warning rule.
- [x] `Cache` ctor calls `cfgResolve` then `cfgValidate`, stores result as
  `private readonly _cfg: CfgData`, exposes `public get cfg(): Readonly<CfgData>`
  (return a frozen deep copy created once in the ctor — mutating the getter result must
  not affect behavior).

### 1.5 Events interface

- [x] Create `src/cache/events.ts` → `CacheEvents<ItemT>` exactly as in the design doc.
- [x] Add `private emit<K extends keyof CacheEvents<ItemT>>(name: K, ...)`-style helper in
  `Cache` (or a small set of typed private wrappers — pick whichever satisfies eslint
  without `any`). Each invocation: skip if callback undefined; call inside try/catch;
  on throw call `this.log?.error(...)` and continue.
- [x] Export `CacheEvents` from `src/index.ts`.

### 1.6 CacheInit update

- [x] Update `src/cache/init.ts`:
  ```ts
  export interface CacheInit<ItemT> {
  	log?: LogLike;
  	cfg?: CfgPartial;
  	itemValidator?: (item?: ItemT | null) => boolean;
  	rng?: () => number;
  	victimSelector?: (cache: Cache<ItemT>, candidateId: CacheItemId) => CacheItemId | null;
  	events?: CacheEvents<ItemT>;
  }
  ```
  `rng` default: `Math.random`. Store `events` as `private readonly events: CacheEvents<ItemT>`
  (default `{}`).

### 1.7 CacheItem refactor

- [x] Rewrite `src/cache/item.ts` constructor to an init object:
  ```ts
  export interface CacheItemInit<ItemT> {
  	data: ItemT;
  	ttl?: number;
  	addedSeq: number;
  }
  export class CacheItem<ItemT> {
  	public data: ItemT;
  	public readonly created: Time;
  	public readonly updated: Time;
  	public readonly ttl: Time;
  	public readonly addedSeq: number;
  	public lastAccessSeq: number;   // starts equal to addedSeq
  	public accessCount: number;      // starts 0
  	public policyData?: unknown;
  	public recordAccess(seq: number): void; // sets lastAccessSeq, increments accessCount
  }
  ```
  Keep `sanitizeTtl`, `expired()`, `update()` unchanged.
- [x] `Cache` gains `private seq: number` starting at 0; incremented and assigned on every
  add and every qualifying access. Reset to 0 in `reset()`.

### 1.8 Stats

- [x] Add `rejects: number` to `CacheStats` (init 0, cleared in `reset()`). Every path where
  `add()` returns `false` increments it exactly once.

### 1.9 Cache core — centralized removal

- [x] Implement in `src/cache.ts`:
  ```ts
  protected removeItem(id: CacheItemId, reason: CacheRemoveReason): boolean
  ```
  Steps: look up item (return false if absent) → `items.delete(id)` → update stat
  (`delete`→deletes, `evict`→evictions, `expire`→expirations, `overwrite`→no counter) →
  fire specific event (`expire`→`onItemExpire(item.data, id, item.created)`,
  `evict`→`onItemEvict`) → fire `onItemRemove(item.data, id, reason)`.
- [x] Route all existing deletion sites through it: `getItem` lazy-expire (`'expire'`),
  eviction in `add` (`'evict'`), `delete()` (`'delete'`), `prune()` (`'expire'`),
  overwrite path in `add` (`'overwrite'`).

### 1.10 Cache core — API hardening

- [x] `items` → `protected readonly`. Add `public *entries(): IterableIterator<[CacheItemId, ItemT]>`
  (unexpired only, lazy-expiring like `keys()`). Update any test using `cache.items` to use
  public API instead.
- [x] `size()` method → `public get size(): number`.
- [x] `capacityMax` → private field `_capacityMax` + `public get capacityMax(): number` +
  ```ts
  public setCapacity(next: number): boolean
  ```
  Rejects (return false) non-finite/negative/non-number. `0` = unbounded. On change fires
  `onCapacityIncrease(old, next)` or `onCapacityDecrease(old, next)`. On decrease below
  `size`, immediately evicts via the active eviction path (task 1.12) until
  `size <= next`, firing evict events per victim. `reset()` restores initial capacity
  **through `setCapacity`** so events stay truthful.
- [x] Signature changes:
  - `add(item: ItemT, opts?: {overwrite?: boolean; ttl?: number}): boolean`
  - `getOrAdd(id: string, factory: (id: string) => ItemT, opts?: {ttl?: number}): ItemT | null`
  - `prune(opts?: {force?: boolean}): number` — `force: true` bypasses the minDelay gate.
- [x] Fields `itemValidator`, `itemTtl`, `pruneDelay`, `lastPrune` → `protected`.
  Delete the top-level `slidingExpiration` field (now per-op cfg).
- [x] Add `public clear(): number` — count = `items.size`, `items.clear()`, notify internal
  modules, fire `onClear(count)`, return count. NO per-item events.
  `reset()` = `clear()` + restore stats/capacity/seq/prune timers + fire `onReset`
  (after `onClear`).
- [x] `add()` reject paths fire `onAddRejected(item, reason)` + `stats.rejects++`:
  validator fail → `'validator'`; no id → `'bad-id'`; duplicate without overwrite →
  `'duplicate'`; at capacity with `evict.basis: 'none'` or victim selection returning
  null → `'capacity'`.

### 1.11 Cache core — access accounting + hit/miss events

- [x] `getItem` gains a source param: `getItem(id, source: 'get' | 'has' | 'touch')`.
  On unexpired hit: if cfg for that op has `countsAsAccess` → `item.recordAccess(++seq)`;
  if op cfg has `slidesExpiration` (get/has) → `item.update()`. `touch` always calls
  `item.update()` (its purpose).
- [x] `get()`: hit → `stats.hits++`, fire `onItemHit(item, id, 'get')`; miss →
  `stats.misses++`, fire `onItemMiss(id)`, notify admission sketch hook point (no-op until
  phase 4). `touch()` success fires `onItemHit(item, id, 'touch')`. `has()` fires neither
  hit nor miss events and touches no hit/miss stats (current behavior — `has` is a query,
  not an access, unless cfg says `countsAsAccess`).

### 1.12 Cache core — victim selection engine (insertion basis only, this phase)

- [x] Implement:
  ```ts
  protected selectVictim(candidateId: CacheItemId): CacheItemId | null
  ```
  Phase-1 behavior: if `init.victimSelector` provided, delegate to it. Else implement
  basis `'insertion'` (`'oldest'` = first key of `items`, `'newest'` = last key) and
  basis `'none'` (return null). Other bases: temporarily fall through to `'insertion'`
  (replaced in phase 2). The `add()` at-capacity loop: while `size >= capacityMax`
  (and capacity > 0, id not already present), call `selectVictim(id)`; null → reject the
  add (`'capacity'` reject path); otherwise `removeItem(victim, 'evict')`.
- [x] Verify the whole phase is behavior-neutral: with default cfg the full pre-existing
  test suite passes after signature-only updates.

### 1.13 Exports + tests + release chores

- [x] `src/index.ts`: export `CacheEvents`, `CacheRemoveReason`, `CacheRejectReason`,
  `CfgPartial`, all cfg group interfaces, `CacheItemInit`.
- [x] New tests (extend `tests/cache.spec.ts` or add `tests/cache/` specs):
  - every event fires with correct args (use jest.fn per callback)
  - specific-then-general removal ordering (expire fires before remove, etc.)
  - throwing callback does not break the operation and logs
  - `setCapacity` shrink evicts immediately + events; increase fires event only
  - `clear`/`reset` event behavior; no per-item events on clear
  - options-object signatures; `prune({force: true})`
  - every `CacheRejectReason` path (+ `stats.rejects`)
  - cfg validation errors throw / warnings log
  - `cache.cfg` is frozen and reflects resolved values
- [x] `package.json` version → `1.0.0`.
- [x] CHANGELOG `[1.0.0]` section: add entries for the grouped cfg break, events, capacity
  API, options objects, protected internals, `size` getter, `clear()`/`reset()` split,
  validation, `rejects` stat. Follow the existing Added/Changed/Fixed/Maintenance format.
- [x] Gate: `pnpm test && pnpm lint && pnpm build`.

---

## Phase 2 — Rule-based eviction + simple wrappers + TtlCache

### 2.1 Victim selection — all stateless bases

- [x] Complete `selectVictim` in `src/cache.ts`:
  - `'insertion'`: first/last key (O(1)).
  - `'access'`: single scan for min (`'oldest'`) / max (`'newest'`) `lastAccessSeq`.
  - `'frequency'`: scan for min (`'oldest'`) / max (`'newest'`) `accessCount`; ties broken
    by `evict.tieBreak` (`'access'` → lower `lastAccessSeq` wins; `'insertion'` → lower
    `addedSeq` wins).
  - `'random'`: `const n = Math.floor(this.rng() * this.items.size)`; take the nth key.
- [x] Tests: for each basis+order combo, build a cache of 4 items with a scripted
  access pattern and assert the exact eviction sequence over successive adds.
  Random basis: inject deterministic `rng` and assert the selected key.

### 2.2 Auto-prune

- [x] In `Cache`: when `cfg.prune.auto`, ctor starts `setInterval(() => this.prune(), interval * 1000)`;
  call `.unref()` on the handle when the method exists (Node) — guard with a typeof check.
  Add `public stopAutoPrune(): void`. `reset()` restarts it; `clear()` does not stop it.
  `prune()` fires `onPrune(removed)` only when it actually ran (not delay-gated) —
  including when removed = 0.
- [x] Tests with `jest.useFakeTimers()`.

### 2.3 Wrappers — file per type, `src/cache/<name>.ts`

Pattern for all wrappers (write once, copy carefully):

```ts
export type LruCacheInit<ItemT> = Omit<CacheInit<ItemT>, 'cfg'> & {
	cfg?: Omit<CfgPartial, 'evict'> ; // pinned groups removed from caller's reach
};
export class LruCache<ItemT extends Cacheable> extends Cache<ItemT> {
	constructor(init?: LruCacheInit<ItemT>) {
		super({
			...init,
			cfg: {
				...init?.cfg,
				// PIN EVERY FLAG the design-doc matrix specifies for this type —
				// including ones matching defaults. Do not rely on defaults.
				evict: {basis: 'access', order: 'oldest', secondChance: false, tieBreak: 'access'},
				segments: {enabled: false, ...},
				ghosts: {enabled: false, ...},
				adaptive: false,
				admission: {policy: 'always', ...}
			}
		});
	}
}
```

- [x] `src/cache/fifo.ts` → `FifoCache` (insertion/oldest)
- [x] `src/cache/lifo.ts` → `LifoCache` (insertion/newest)
- [x] `src/cache/lru.ts` → `LruCache` (access/oldest)
- [x] `src/cache/mru.ts` → `MruCache` (access/newest)
- [x] `src/cache/lfu.ts` → `LfuCache` (frequency/oldest, tieBreak access)
- [x] `src/cache/random.ts` → `RandomCache` (random)
- [x] `src/cache/ttl.ts` → `TtlCache`: requires `init.cfg.ttl > 0` (throw otherwise);
  pins `evict.basis: 'none'`, `capacityMax` caller-settable defaulting to 0,
  `prune.auto: true`. Adds:
  ```ts
  public getRemainingTtl(id: string): number | null  // null when absent/expired; 0 = never expires
  ```
- [x] Export all from `src/index.ts`.
- [x] Tests: one spec file per wrapper (`tests/cache/lru.spec.ts`, ...). Each asserts:
  its exact eviction order under a scripted access pattern; that TTL composes
  (add with short ttl, advance time, expired item gone regardless of policy);
  wrapper cfg pinning (caller cannot pass `evict` — type-level, plus runtime spot check
  via `cache.cfg`).
- [x] CHANGELOG: Added entries. Gate: `pnpm test && pnpm lint && pnpm build`.

---

## Phase 3 — Second chance + segmentation (Clock, Slru)

### 3.1 Second-chance sweep (CLOCK)

- [x] Reference flag lives in `policyData`: define `src/cache/policy/data.ts` with
  `export interface PolicyMeta {referenced?: boolean; segment?: 'probation' | 'protected'}`
  and a private helper on `Cache` to get-or-create it on an item.
- [x] When `cfg.evict.secondChance`: every qualifying access sets `referenced = true`.
  `Cache` keeps `private clockHand: CacheItemId | null`.
  `selectVictim` sweep: iterate `items` keys starting **after** `clockHand` (wrap around;
  start at first key when hand is null/missing). For each item in basis order traversal:
  `referenced` → set false, continue; else it is the victim — set `clockHand` to the
  victim id's predecessor-safe marker (store the victim's *previous* key, or null when
  victim is first) and return it. If a full sweep clears all bits, second sweep returns
  the plain basis victim. `removeItem` clears `clockHand` when it removes the item the
  hand references. `clear`/`reset` null the hand.
- [x] Tests: accessed items survive one eviction round; unaccessed evicted first;
  hand advances (evicting twice doesn't restart the sweep at key 0).

### 3.2 Segmentation module

- [x] Create `src/cache/segments.ts` — internal class `CacheSegments` instantiated by
  `Cache` only when `cfg.segments.enabled`:
  - tracks per-segment counts; item membership via `PolicyMeta.segment`
  - `onAdded(id, item)`: tag `'probation'` (phase 4 may override to protected on ghost hit)
  - `onAccessed(id, item)`: if probation and `promoteOnHit` → tag protected; then if
    protected count > `floor(protectedRatio * capacityMax)` → demote the protected member
    with lowest `lastAccessSeq` back to probation
  - `onRemoved(id, item)`: decrement its segment count (called from `removeItem` for
    every reason — this is why removal is centralized)
  - `reset()`: zero counts
- [x] `selectVictim` with segments enabled: choose victim among **probation** members using
  `probationBasis` (`'access'` → lowest lastAccessSeq; `'insertion'` → lowest addedSeq);
  when probation is empty, fall back to protected members via `evict.basis`/`order`.
  Additionally, when probation count exceeds `floor(probationRatio * capacityMax)` the
  probation victim is preferred even if protected has candidates (2Q A1in budget).
- [x] Wrappers: `src/cache/clock.ts` → `ClockCache` (insertion/oldest + secondChance),
  `src/cache/slru.ts` → `SlruCache` (segments on, probationBasis access; caller may set
  `protectedRatio` — type allows `segments: {protectedRatio?: number}` only).
- [x] Tests: SLRU scan-resistance scenario (one-time scan of N new ids does not evict
  repeatedly-accessed protected items); demotion on protected overflow; segment counts
  stay correct across expire/delete/evict/clear (assert via eviction behavior).
- [x] Exports, CHANGELOG, gate.

---

## Phase 4 — Ghosts, adaptivity, admission (TwoQueue, Arc, TinyLfu)

### 4.1 Ghost registry

- [x] Create `src/cache/ghosts.ts` — internal class, instantiated when `cfg.ghosts.enabled`:
  - storage: one insertion-ordered `Map<CacheItemId, true>` (or two when `perSegment`:
    `recency` = evicted from probation, `frequency` = evicted from protected)
  - `recordEviction(id, segment)`: called from `removeItem` on reason `'evict'` only;
    trims oldest entries beyond `floor(sizeRatio * capacityMax)`
  - `hit(id): 'recency' | 'frequency' | null` — checks membership, removes on hit
- [x] `add()` integration: on successful admit of a new id, `ghosts.hit(id)`; a hit means
  the id was recently evicted → tag the new item directly `'protected'` (segments module)
  instead of probation.
- [x] Tests: 2Q behavior — re-added recently-evicted id goes to protected; ghost registry
  bounded; ids only (no item data retained — assert via memory-shape test on the map).

### 4.2 Adaptivity (ARC's p)

- [x] When `cfg.adaptive` (validated to require segments + perSegment ghosts): `Cache`
  keeps `private adaptiveTarget: number` = initial `floor(protectedRatio * capacityMax)`.
  On ghost hit `'recency'` → `adaptiveTarget = max(0, adaptiveTarget - max(1, floor(freqGhostCount / max(1, recencyGhostCount))))`
  (favor probation/recency space); on `'frequency'` hit →
  `adaptiveTarget = min(capacityMax, adaptiveTarget + max(1, floor(recencyGhostCount / max(1, freqGhostCount))))`.
  Segments module uses `adaptiveTarget` in place of the static protected budget when
  adaptive is on. `reset()` restores initial value.
- [x] Tests: recency-heavy workload shrinks protected budget (frequently-readded ghosts
  shift target; assert via which items get evicted); frequency-heavy grows it.

### 4.3 Frequency sketch + admission

- [x] Create `src/cache/sketch.ts` — `CountMinSketch`: 4 rows, width = smallest power of two
  ≥ `4 * capacityMax` (min 16), counters `Uint8Array` capped at 15. Hash: FNV-1a over the
  id string, one seed per row (fixed constants), masked to width. `increment(id)` bumps
  all 4 row slots (skip rows already at 15) and a total-ops counter; when total ≥
  `sketchResetThreshold` halve every counter (integer div 2) and the total. `estimate(id)`
  = min across rows. No `Math.random` — fully deterministic.
- [x] Unit tests for the sketch alone: estimate ≥ true count properties on small sets,
  halving, cap at 15.
- [x] Wire when `cfg.admission.policy === 'frequency'`: `increment(id)` on every qualifying
  access AND on every `get` miss (`onItemMiss` internal path).
- [x] Admission flow in `add()` (W-TinyLFU, segments must be enabled — enforced by wrapper):
  the probation region acts as the entry window sized
  `max(1, floor(windowRatio * capacityMax))` (window budget replaces `probationRatio`
  when admission is frequency). At capacity: window overflow produces `candidate` =
  window victim; `mainVictim` = victim among protected/main via evict flags. Compare
  `estimate(candidate)` vs `estimate(mainVictim)`: candidate wins → `removeItem(mainVictim, 'evict')`
  and candidate promotes to main; candidate loses → `removeItem(candidate, 'evict')`.
  A brand-new `add` when the *window itself* is full and the new id loses the comparison →
  reject the add: `stats.rejects++`, `onAddRejected(item, 'admission')`, return false.
- [x] Wrappers:
  - `src/cache/two-queue.ts` → `TwoQueueCache` (segments on, probationBasis insertion,
    ghosts on; caller may set `probationRatio` (kin) / `ghosts.sizeRatio` (kout))
  - `src/cache/arc.ts` → `ArcCache` (segments on, ghosts on perSegment, adaptive true)
  - `src/cache/tiny-lfu.ts` → `TinyLfuCache` (segments on, admission frequency; caller may
    set `windowRatio`, `sketchResetThreshold`, `protectedRatio`)
- [x] Tests per wrapper: TwoQueue — one-hit-wonders evicted from FIFO probation without
  touching main; Arc — adapts between the phase-4.2 workloads; TinyLfu — high-frequency
  id readmitted over low-frequency victim, low-frequency newcomer rejected with
  `onAddRejected('admission')`.
- [x] Exports, CHANGELOG, gate: `pnpm test && pnpm lint && pnpm build`.

---

## Final checks (after phase 4)

- [x] `pnpm make:docs` builds clean typedoc — verified by inspection (all `@category` tags
  consistent, all `{@link}` targets resolve to exported symbols; `tsc` clean). NOT run directly
  because `make:docs` writes into `docs/` and would clobber these planning notes.
- [x] README: add a "Cache types" section — table of the 12 wrappers, one-line each, plus
  a mix-and-match cfg example (LRU + TTL).
- [x] Confirm no public API exposes `items`, `policyData` internals, or unresolved cfg.
- [x] Full suite: `pnpm test && pnpm lint && pnpm build`.
