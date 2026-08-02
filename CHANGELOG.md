
# [Unreleased]

# [1.0.0] - 2026-08-02
## Package
* Now exports both `CommonJS` and `ESM` output. The ESM build under `dist/esm` uses explicit `./*.js` import specifiers and ships a `{"type": "module"}` marker so Node parses each build in the correct format.
* Compile target raised from `es2015` to `es2022` for both builds — async/await and modern syntax are no longer downleveled.
* Declared `engines.node >= 18` as the supported Node floor.

## Added
* Added stats to track number of hits, misses, adds, deletes, evictions, expirations so that users can track cache performance. `CacheStats` is exported from the package index.
* Added `stats.rejects` counter, incremented once for every `add` refused by the validator, capacity, admission, or a bad/duplicate id.
* Added `touch` method that extends item expiry for item matching `id` which is not yet expired. Expired items are lazily removed.
* Added public `keys()` method to iterate keys in cache.
* Added public `values()` to iterate unexpired registered cache items.
* Added public `entries()` to iterate `[id, item]` pairs of unexpired cache items.
* Added `ttl` cfg option which sets the default TTL (seconds) for items added without an explicit `ttl` argument.
* Added a grouped, fully-serializable `CfgData` config (`capacityMax`, `ttl`, and the `get`/`has`/`touch`, `prune`, `evict`, `segments`, `ghosts`, `adaptive`, `admission` groups). `CacheInit.cfg` accepts a deep-partial `CfgPartial`; missing fields resolve to defaults reproducing pre-1.0 behavior.
* Added named cache-type wrappers over the flag-configurable base: `FifoCache`, `LifoCache`, `LruCache`, `MruCache`, `LfuCache`, `RandomCache`, `TtlCache`, `ClockCache`, `SlruCache`, `TwoQueueCache`, `ArcCache`, and `TinyLfuCache`. Each pins its eviction flags and removes the pinned groups from the caller's `cfg` type. `TtlCache` requires a positive `ttl`, defaults to unbounded capacity with auto-prune, and adds `getRemainingTtl(id)`.
* Added the ghost registry (`ghosts` group): a bounded, ids-only record of recently-evicted items (single list, or per-segment recency/frequency lists). A re-add that hits a ghost is admitted straight into the protected region (2Q/ARC re-reference detection).
* Added ARC adaptivity (`adaptive`): per-segment ghost hits shift the probation/protected target so the cache leans toward recency or frequency to match the live workload.
* Added the frequency admission policy (`admission.policy: 'frequency'`) backed by a deterministic Count-Min Sketch (`CountMinSketch`): at capacity, a newcomer is admitted over the main eviction target only when its estimated frequency wins, and a losing newcomer is rejected with `onAddReject('admission')` (W-TinyLFU).
* Added the CLOCK second-chance sweep (`evict.secondChance`): recently-accessed items get one reprieve before eviction, with a persistent sweep hand so successive evictions advance rather than restart.
* Added probation/protected segmentation (`segments` group): new items enter probation, a hit promotes to protected, and protected overflow demotes the least-recently-used protected member. Eviction targets probation first (scan resistance), falling back to protected only when probation is empty. Segment counts are maintained through the centralized removal path.
* Added the full stateless eviction engine: `evict.basis` of `insertion`, `access`, `frequency` (with `tieBreak`), `random` (via injectable `init.rng`), and `none`, each honoring `evict.order`.
* Added automatic pruning: `prune.auto` starts an interval timer (`unref`'d in Node) that sweeps expired items; `stopAutoPrune()` stops it and `reset()` restarts it.
* Added init-time cfg validation. Contradictory flag combinations throw with a message naming both fields; suspicious-but-legal combinations log a warning and proceed.
* Added a read-only `cache.cfg` getter returning the frozen, resolved configuration.
* Added a `CacheEvents` callback group on `CacheInit` (`onItemAdd`, `onItemExpire`, `onItemEvict`, `onItemRemove`, `onAddReject`, `onItemHit`, `onItemMiss`, `onCapacityIncrease`, `onCapacityDecrease`, `onClear`, `onReset`, `onPrune`). Callbacks fire post-commit, synchronously, each wrapped in try/catch and logged — a throwing callback never corrupts cache state.
* Added `setCapacity(next)`. Rejects invalid values; `0` = unbounded; a decrease below current size evicts immediately through the active policy, firing evict/capacity events.
* Added `clear()` (removes all items, fires `onClear`, no per-item events) distinct from `reset()` (clear + restore stats/capacity/sequence/timers, fires `onClear` then `onReset`).
* Added per-operation access accounting via `CacheItem.recordAccess`, `addedSeq`, `lastAccessSeq`, and `accessCount`, driven by the `get`/`has`/`touch` cfg groups.
* Added `init.rng`, `init.evictionTargetSelector`, and `init.events` hooks. Exported `CacheRemoveReason`, `CacheRejectReason`, `CacheEvents`, `CacheInit`, `CacheItemInit`, `CfgPartial`, and every cfg group interface.

## Changed
* **BREAKING:** `CfgData` restructured into grouped flags. `slidingExpiration` becomes per-op `get.slidesExpiration` / `has.slidesExpiration`; `pruneDelay` becomes `prune.minDelay`.
* **BREAKING:** `add`, `getOrAdd`, and `prune` take options objects: `add(item, {overwrite?, ttl?})`, `getOrAdd(id, factory, {ttl?})`, `prune({force?})`.
* **BREAKING:** `capacityMax` is now a getter; mutate via `setCapacity(next)`. `size()` method is now a `size` getter.
* **BREAKING:** `CacheItem` constructor takes an init object `{data, ttl?, addedSeq}` instead of positional args.
* **BREAKING:** `add` with `{overwrite: true}` fires `onItemRemove('overwrite')` before replacing the existing item.
* **BREAKING:** the `items` Map and the `itemValidator`, `itemTtl`, `pruneDelay`, `lastPrune` fields are now `protected`. Public mutation bypassed stats, events, and policy bookkeeping; iterate via `keys()`/`values()`/`entries()` and introspect via `cache.cfg`.
* `Cache` constructor now accepts a `CacheInit` object instead of `CfgData`. Cache config values are provided via `init.cfg` and the item validator via `init.itemValidator`.
* `Cache.log` is now an optional `LogLike` provided via `init.log`, replacing the `@toreda/log` instance the cache previously created when none was provided.
* All single-item removals (lazy expire, eviction, delete, overwrite, prune) now route through one centralized `removeItem(id, reason)` so stats and events stay consistent.

## Fixed
* `cache.add` now properly validates TTL before adding items and rejects any call with a non-number, negative, or non-finite TTL value.
* Updating `@toreda/time` to the latest available version fixed several bugs that could occur related to timeSince, timeUntil, and between specific time unit pairs
* `Cache` now stores the optional `log` provided during init. Previously the provided log instance was dropped.

## Maintenance
* Updated project's NPM dependencies.
* Fixed jest types not resolving in VSCode by adding `@types/jest` to `types` in `tsconfig.json` and updating the project's include/exclude globs.

# [0.1.1] - 2022-04-11

## Fixed
* Added missing `CacheItemId` type to package exports in `index.ts`.

## Maintenance
* Updated all packages to latest available and ran `yarn upgrade`.



[Unreleased]: https://github.com/toreda/cache/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/toreda/cache/compare/v0.1.1...v1.0.0
[0.1.1]: https://github.com/toreda/cache/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/toreda/cache/releases/tag/v0.1.0
