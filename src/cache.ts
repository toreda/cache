/**
 *	MIT License
 *
 *	Copyright (c) 2019 - 2026 Toreda, Inc.
 *
 *	Permission is hereby granted, free of charge, to any person obtaining a copy
 *	of this software and associated documentation files (the "Software"), to deal
 *	in the Software without restriction, including without limitation the rights
 *	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *	copies of the Software, and to permit persons to whom the Software is
 *	furnished to do so, subject to the following conditions:

 * 	The above copyright notice and this permission notice shall be included in all
 * 	copies or substantial portions of the Software.
 *
 * 	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * 	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * 	SOFTWARE.
 *
 */

import {CacheItem} from './cache/item';
import type {CacheEvents} from './cache/events';
import type {CacheInit} from './cache/init';
import type {CacheItemId} from './cache/item/id';
import type {CacheRejectReason} from './cache/reject/reason';
import type {CacheRemoveReason} from './cache/remove/reason';
import {CacheGhosts} from './cache/ghosts';
import {CacheSegments} from './cache/segments';
import {CacheStats} from './cache/stats';
import {CountMinSketch} from './cache/sketch';
import type {Cacheable} from './cacheable';
import type {CfgData} from './cfg/data';
import type {LogLike} from '@toreda/shared-types';
import type {Time} from '@toreda/time';
import {cacheItemId} from './cache/item/id';
import {cfgResolve} from './cfg/resolve';
import {cfgValidate} from './cfg/validate';
import {timeMake} from '@toreda/time';
import type {PolicyMeta} from './policy/meta';
import type {PolicySegment} from './policy/segment';

/**
 * Source operation that triggered a `getItem` lookup, used to apply the matching per-operation
 * access-accounting cfg.
 */
type CacheAccessSource = 'get' | 'has' | 'touch';

/**
 * Options accepted by {@link Cache.add}.
 *
 * @category Cache
 */
export interface CacheAddOptions {
	/** When `true`, replace an existing item with the same id. */
	overwrite?: boolean;
	/** TTL (seconds) for this item. Falls back to the cache's configured ttl. `0` never expires. */
	ttl?: number;
}

/**
 * Options accepted by {@link Cache.getOrAdd}.
 *
 * @category Cache
 */
export interface CacheGetOrAddOptions {
	/** TTL (seconds) applied when the factory item is added. */
	ttl?: number;
}

/**
 * Options accepted by {@link Cache.prune}.
 *
 * @category Cache
 */
export interface CachePruneOptions {
	/** When `true`, bypass the `prune.minDelay` gate and prune immediately. */
	force?: boolean;
}

/**
 * Policy-agnostic, time-based object cache for TypeScript generics. Every behavioral feature —
 * eviction ordering, segmentation, ghosts, admission — is driven by resolved cfg flags. Named
 * cache types (`LruCache`, `LfuCache`, ...) are thin wrappers that pin those flags.
 *
 * @category Cache
 */
export class Cache<ItemT extends Cacheable> {
	/** Global log instance. */
	public readonly log?: LogLike;
	/** Map of cached items keyed by id. Insertion order is a load-bearing invariant. */
	protected readonly items: Map<CacheItemId, CacheItem<ItemT>>;
	/** Optional validator invoked on each `add` call. `null` accepts all items. */
	protected readonly itemValidator: ((item?: ItemT | null) => boolean) | null;
	/** Random source for the `random` eviction basis and sketch hashing. */
	protected readonly rng: () => number;
	/** Optional escape-hatch eviction target selector. */
	protected readonly evictionTargetSelector?: (
		cache: Cache<ItemT>,
		candidateId: CacheItemId
	) => CacheItemId | null;
	/** User observability callbacks. Defaults to an empty object. */
	protected readonly events: CacheEvents<ItemT>;
	/** Default TTL (seconds) applied to items added without an explicit ttl. */
	protected readonly itemTtl: number;
	/** Operation counters for this cache instance. Restored to 0 by `reset()`. */
	public readonly stats: CacheStats;
	/** Minimum seconds between prune calls. `prune()` aborts when called more frequently. */
	protected readonly pruneDelay: Time;
	/** Timestamp of the last successful prune operation. */
	protected readonly lastPrune: Time;

	/** Resolved, validated config. Immutable after construction. */
	private readonly _cfg: CfgData;
	/** Frozen deep copy of `_cfg` returned by the `cfg` getter. */
	private readonly _frozenCfg: Readonly<CfgData>;
	/** Current capacity cap. `0` = unbounded. */
	private _capacityMax: number;
	/** capacityMax resolved during init. Restored by `reset()`. */
	private readonly initialCapacityMax: number;
	/** Monotonic sequence counter. Assigned on every add and every qualifying access. */
	private seq: number;
	/** Handle for the auto-prune interval timer, or `null` when auto-prune is off/stopped. */
	private autoPruneTimer: unknown;
	/** Segmentation module, allocated only when `cfg.segments.enabled`. */
	protected readonly segments: CacheSegments<ItemT> | null;
	/** Ghost registry, allocated only when `cfg.ghosts.enabled`. */
	protected readonly ghosts: CacheGhosts | null;
	/** Frequency sketch, allocated only when `cfg.admission.policy === 'frequency'`. */
	protected readonly sketch: CountMinSketch | null;
	/** CLOCK sweep hand — the key *before* where the next second-chance sweep resumes. */
	private clockHand: CacheItemId | null;

	constructor(init?: CacheInit<ItemT>) {
		this.log = init?.log;

		const cfg = cfgResolve(init?.cfg);
		cfgValidate(cfg, this.log);
		this._cfg = cfg;
		this._frozenCfg = Cache.freezeCfg(cfg);

		this.items = new Map<CacheItemId, CacheItem<ItemT>>();
		this.itemValidator = init?.itemValidator ? init.itemValidator : null;
		this.rng = init?.rng ? init.rng : Math.random;
		this.evictionTargetSelector = init?.evictionTargetSelector;
		this.events = init?.events ? init.events : {};
		this.itemTtl = cfg.ttl;
		this._capacityMax = cfg.capacityMax;
		this.initialCapacityMax = cfg.capacityMax;
		this.seq = 0;

		this.stats = new CacheStats();
		this.pruneDelay = timeMake('s', cfg.prune.minDelay, this.log);
		this.lastPrune = timeMake('s', 0, this.log);
		this.autoPruneTimer = null;
		this.clockHand = null;

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this;
		this.segments = cfg.segments.enabled
			? new CacheSegments<ItemT>(
					{
						items: this.items,
						policyMeta: (item: CacheItem<ItemT>): PolicyMeta => self.policyMeta(item),
						get capacityMax(): number {
							return self._capacityMax;
						}
					},
					cfg
				)
			: null;
		this.ghosts = cfg.ghosts.enabled ? new CacheGhosts(cfg, (): number => self._capacityMax) : null;
		this.sketch =
			cfg.admission.policy === 'frequency'
				? new CountMinSketch(cfg.capacityMax, cfg.admission.sketchResetThreshold)
				: null;

		// ARC adaptivity: seed the segments module's adaptive target from the static budget.
		if (cfg.adaptive && this.segments) {
			this.segments.adaptiveTarget = Math.floor(cfg.segments.protectedRatio * cfg.capacityMax);
		}

		if (cfg.prune.auto) {
			this.startAutoPrune();
		}
	}

	/**
	 * Start the auto-prune interval timer using the resolved `prune.interval`. In Node, the handle
	 * is `unref()`d so it never keeps the process alive. Safe to call when already running (no-op).
	 */
	private startAutoPrune(): void {
		if (this.autoPruneTimer !== null) {
			return;
		}

		const timers = globalThis as unknown as {
			setInterval?: (handler: () => void, ms: number) => unknown;
		};
		if (typeof timers.setInterval !== 'function') {
			return;
		}

		const intervalMs = this._cfg.prune.interval * 1000;
		const handle = timers.setInterval((): void => {
			this.prune();
		}, intervalMs);

		const unrefable = handle as {unref?: () => void};
		if (handle && typeof unrefable.unref === 'function') {
			unrefable.unref();
		}

		this.autoPruneTimer = handle;
	}

	/**
	 * Stop the auto-prune interval timer if running. Called by consumers that need deterministic
	 * teardown; `reset()` restarts it when `prune.auto` is configured.
	 * @returns		void
	 */
	public stopAutoPrune(): void {
		if (this.autoPruneTimer === null) {
			return;
		}

		const timers = globalThis as unknown as {clearInterval?: (handle: unknown) => void};
		if (typeof timers.clearInterval === 'function') {
			timers.clearInterval(this.autoPruneTimer);
		}

		this.autoPruneTimer = null;
	}

	/**
	 * Produce a frozen deep copy of a resolved cfg. Mutating the copy must never affect behavior.
	 */
	private static freezeCfg(cfg: CfgData): Readonly<CfgData> {
		return Object.freeze({
			capacityMax: cfg.capacityMax,
			initialSize: cfg.initialSize,
			ttl: cfg.ttl,
			get: Object.freeze({...cfg.get}),
			has: Object.freeze({...cfg.has}),
			touch: Object.freeze({...cfg.touch}),
			prune: Object.freeze({...cfg.prune}),
			evict: Object.freeze({...cfg.evict}),
			segments: Object.freeze({...cfg.segments}),
			ghosts: Object.freeze({...cfg.ghosts}),
			adaptive: cfg.adaptive,
			admission: Object.freeze({...cfg.admission})
		}) as Readonly<CfgData>;
	}

	/**
	 * Read-only view of the resolved, validated configuration. The returned object is frozen; a
	 * mutation attempt has no effect on cache behavior.
	 * @returns
	 */
	public get cfg(): Readonly<CfgData> {
		return this._frozenCfg;
	}

	/**
	 * Current cached item count (includes items not yet lazily expired).
	 * @returns
	 */
	public get size(): number {
		return this.items.size;
	}

	/**
	 * Current capacity cap. `0` = unbounded.
	 * @returns
	 */
	public get capacityMax(): number {
		return this._capacityMax;
	}

	/**
	 * Fire a user event callback if present, swallowing and logging any error it throws so a bad
	 * callback can never corrupt cache state. Callbacks run post-commit.
	 */
	private emit<K extends keyof CacheEvents<ItemT>>(
		name: K,
		...args: Parameters<NonNullable<CacheEvents<ItemT>[K]>>
	): void {
		const cb = this.events[name];
		if (typeof cb !== 'function') {
			return;
		}

		try {
			(cb as (...a: unknown[]) => void)(...args);
		} catch (e) {
			this.log?.error(`cache event '${String(name)}' callback threw: ${(e as Error)?.message ?? e}`);
		}
	}

	/**
	 * Look up the wrapper for `id` when it exists and is unexpired, applying per-operation access
	 * accounting for `source`. Expired items are lazily removed via `removeItem('expire')`.
	 * @param id		Unique ID of item in cache.
	 * @param source	Operation performing the lookup — selects the access-accounting cfg.
	 * @returns			CacheItem wrapper when present & unexpired, otherwise `null`.
	 */
	private getItem(id: string, source: CacheAccessSource): CacheItem<ItemT> | null {
		const item = this.items.get(id);
		if (!item || !(item instanceof CacheItem)) {
			return null;
		}

		if (item.expired()) {
			this.removeItem(id, 'expire');
			return null;
		}

		if (source === 'touch') {
			// touch always slides the expiration window (its purpose).
			item.update();
			if (this._cfg.touch.countsAsAccess) {
				this.recordItemAccess(id, item);
			}
		} else {
			const opCfg = source === 'get' ? this._cfg.get : this._cfg.has;
			if (opCfg.countsAsAccess) {
				this.recordItemAccess(id, item);
			}
			if (opCfg.slidesExpiration) {
				item.update();
			}
		}

		return item;
	}

	/**
	 * Register a qualifying access on an item: advance its access metadata, then run the internal
	 * access hooks (CLOCK reference bit, segment promotion). Internal modules run before any user
	 * event.
	 */
	private recordItemAccess(id: CacheItemId, item: CacheItem<ItemT>): void {
		item.recordAccess(++this.seq);
		this.onAccess(id, item);
	}

	/**
	 * Internal per-access hook for feature modules. Sets the CLOCK reference bit when second-chance
	 * is enabled and notifies the segmentation module. No user events fire here.
	 */
	protected onAccess(id: CacheItemId, item: CacheItem<ItemT>): void {
		if (this._cfg.evict.secondChance) {
			this.policyMeta(item).referenced = true;
		}

		if (this.segments) {
			this.segments.onAccessed(id, item);
		}

		if (this.sketch) {
			this.sketch.increment(id);
		}
	}

	/** Get or create the internal `PolicyMeta` slot on an item. */
	protected policyMeta(item: CacheItem<ItemT>): PolicyMeta {
		if (!item.policyData || typeof item.policyData !== 'object') {
			item.policyData = {};
		}

		return item.policyData as PolicyMeta;
	}

	/**
	 * Internal per-removal hook for feature modules (ghost registry). Runs before user events. The
	 * base implementation is a no-op; Phase 4 records evictions into the ghost registry here.
	 */
	protected onRemoveInternal(id: CacheItemId, item: CacheItem<ItemT>, reason: CacheRemoveReason): void {
		// Only evictions are ghosted — expiries/deletes/overwrites are not re-reference signals.
		if (reason !== 'evict' || !this.ghosts) {
			return;
		}

		const meta = item.policyData as PolicyMeta | undefined;
		this.ghosts.recordEviction(id, meta?.segment);
	}

	/**
	 * Centralized single-item removal. Every non-bulk deletion routes through here so stats and
	 * events stay consistent. Fires the specific event (`onItemExpire` / `onItemEvict`) then the
	 * general `onItemRemove`.
	 * @param id		Unique ID of the item to remove.
	 * @param reason	Why the item is being removed.
	 * @returns			`true` when an item was removed, otherwise `false`.
	 */
	protected removeItem(id: CacheItemId, reason: CacheRemoveReason): boolean {
		const item = this.items.get(id);
		if (!item) {
			return false;
		}

		this.items.delete(id);

		// Internal feature modules update before user events fire.
		if (this.clockHand === id) {
			this.clockHand = null;
		}
		if (this.segments) {
			this.segments.onRemoved(id, item);
		}
		this.onRemoveInternal(id, item, reason);

		switch (reason) {
			case 'delete':
				this.stats.deletes++;
				break;
			case 'evict':
				this.stats.evictions++;
				break;
			case 'expire':
				this.stats.expirations++;
				break;
			case 'overwrite':
				// Overwrites are not counted — the replacing add counts instead.
				break;
		}

		if (reason === 'expire') {
			this.emit('onItemExpire', item.data, id, item.created);
		} else if (reason === 'evict') {
			this.emit('onItemEvict', item.data, id);
		}

		this.emit('onItemRemove', item.data, id, reason);

		return true;
	}

	/**
	 * Check whether an unexpired item with `id` exists. Expired items found during lookup are
	 * lazily removed.
	 * @param id		Unique ID of item in cache.
	 * @returns
	 */
	public has(id: string): boolean {
		return this.getItem(id, 'has') !== null;
	}

	/**
	 * Get item from cache matching `id` if one exists & is unexpired. Fires `onItemHit` on a hit
	 * and `onItemMiss` on a miss.
	 * @param id		Globally unique item identifier.
	 * @returns			Item of type `ItemT` if present, otherwise `null`.
	 */
	public get(id: string): ItemT | null {
		const item = this.getItem(id, 'get');

		if (!item || !item.data) {
			this.stats.misses++;
			this.onMiss(id);
			this.emit('onItemMiss', id);
			return null;
		}

		this.stats.hits++;
		this.emit('onItemHit', item.data, id, 'get');

		return item.data;
	}

	/**
	 * Internal hook invoked on every `get` miss. No-op until admission (phase 4) overrides it.
	 */
	protected onMiss(id: CacheItemId): void {
		if (this.sketch) {
			this.sketch.increment(id);
		}
	}

	/**
	 * Get item matching `id`, or create it with `factory` and add the result when no unexpired
	 * item matches.
	 * @param id		Globally unique item identifier.
	 * @param factory	Invoked to create the item on cache miss.
	 * @param opts		Optional `ttl` applied when the factory item is added.
	 * @returns			Cached or newly created item, or `null` when it could not be added.
	 */
	public getOrAdd(id: string, factory: (id: string) => ItemT, opts?: CacheGetOrAddOptions): ItemT | null {
		const existing = this.get(id);
		if (existing !== null) {
			return existing;
		}

		const item = factory(id);
		if (this.add(item, {ttl: opts?.ttl}) !== true) {
			return null;
		}

		return item;
	}

	/**
	 * Reject an `add`: increment the reject stat and fire `onAddReject`.
	 */
	private reject(item: ItemT, reason: CacheRejectReason): false {
		this.stats.rejects++;
		this.emit('onAddReject', item, reason);
		return false;
	}

	/**
	 * Add item to cache. When adding would exceed `capacityMax`, eviction targets are removed via the
	 * active eviction policy to make room. Rejected adds fire `onAddReject` and bump
	 * `stats.rejects`.
	 * @param item		Item to cache.
	 * @param opts		Optional `overwrite` and `ttl`.
	 * @returns			`true` when the item was added, otherwise `false`.
	 */
	public add(item: ItemT, opts?: CacheAddOptions): boolean {
		if (this.itemValidator && this.itemValidator(item) !== true) {
			return this.reject(item, 'validator');
		}

		const id = cacheItemId(item);
		if (!id) {
			return this.reject(item, 'bad-id');
		}

		const present = this.items.has(id);
		if (present && opts?.overwrite !== true) {
			return this.reject(item, 'duplicate');
		}

		// Replacing an existing id doesn't grow the cache, so eviction only applies for new ids.
		if (!present && this._capacityMax > 0) {
			const denial = this.makeRoom(id);
			if (denial !== null) {
				return this.reject(item, denial);
			}
		}

		if (present) {
			// Fire overwrite removal before replacing so observers see the old value leave.
			this.removeItem(id, 'overwrite');
		}

		const itemTtl = typeof opts?.ttl === 'number' ? opts.ttl : this.itemTtl;
		const wrappedItem = new CacheItem<ItemT>({data: item, ttl: itemTtl, addedSeq: ++this.seq});
		this.items.set(id, wrappedItem);
		this.stats.adds++;

		// Internal feature modules run before the user event.
		this.onAddInternal(id, wrappedItem);
		if (this.evictSecondChance()) {
			this.policyMeta(wrappedItem).referenced = false;
		}

		this.emit('onItemAdd', item, id);

		return true;
	}

	/**
	 * Ensure there is room for a new `id` at capacity, evicting via the active policy. Returns
	 * `null` when room was made (or the newcomer should be admitted), or the reject reason when the
	 * add must be refused. Frequency admission (W-TinyLFU) runs its own comparison path.
	 */
	private makeRoom(candidateId: CacheItemId): CacheRejectReason | null {
		if (this._cfg.admission.policy === 'frequency' && this.sketch) {
			return this.admitByFrequency(candidateId);
		}

		while (this.items.size >= this._capacityMax) {
			const evictionTarget = this.selectEvictionTarget(candidateId);
			if (evictionTarget === null) {
				return 'capacity';
			}

			this.removeItem(evictionTarget, 'evict');
		}

		return null;
	}

	/**
	 * W-TinyLFU admission. The probation region is the entry window. At capacity, compare the
	 * newcomer's estimated frequency against the main (protected) eviction target's: the newcomer
	 * wins → evict the main target to make room; it loses → refuse admission. When there is no main
	 * eviction target yet (protected empty), evict the window target instead so the newcomer still
	 * enters probation.
	 */
	private admitByFrequency(candidateId: CacheItemId): CacheRejectReason | null {
		while (this.items.size >= this._capacityMax) {
			const mainEvictionTarget = this.protectedEvictionTarget();
			if (mainEvictionTarget === null) {
				// No protected eviction target yet — evict from the window (probation) to admit newcomer.
				const windowEvictionTarget = this.probationEvictionTarget() ?? this.evictionTargetByBasis();
				if (windowEvictionTarget === null) {
					return 'capacity';
				}

				this.removeItem(windowEvictionTarget, 'evict');
				continue;
			}

			const sketch = this.sketch;
			const candidateFreq = sketch ? sketch.estimate(candidateId) : 0;
			const evictionTargetFreq = sketch ? sketch.estimate(mainEvictionTarget) : 0;

			if (candidateFreq > evictionTargetFreq) {
				this.removeItem(mainEvictionTarget, 'evict');
			} else {
				return 'admission';
			}
		}

		return null;
	}

	/**
	 * Internal per-add hook for feature modules. Tags the new item into the probation segment when
	 * segmentation is enabled. Phase 4 overrides this to promote ghost-hit re-adds to protected.
	 */
	protected onAddInternal(id: CacheItemId, item: CacheItem<ItemT>): void {
		// A ghost hit means this id was recently evicted — a re-reference signal. Adapt the ARC
		// target and admit the item straight into the protected segment.
		let ghostHit: PolicySegment | undefined;
		if (this.ghosts) {
			const list = this.ghosts.hit(id);
			if (list !== null) {
				ghostHit = 'protected';
				this.adaptOnGhostHit(list === 'frequency');
			}
		}

		if (this.segments) {
			this.segments.onAdded(id, item, ghostHit);
		}
	}

	/**
	 * Shift the adaptive protected target on a ghost hit (ARC's p). A frequency-list hit grows the
	 * protected budget (favor frequency); a recency-list hit shrinks it (favor recency). No-op
	 * unless `cfg.adaptive` and both segments + per-segment ghosts are active.
	 */
	private adaptOnGhostHit(fromFrequency: boolean): void {
		if (!this._cfg.adaptive || !this.segments || !this.ghosts) {
			return;
		}

		const recency = Math.max(1, this.ghosts.recencyCount);
		const frequency = Math.max(1, this.ghosts.frequencyCount);
		const staticTarget = Math.floor(this._cfg.segments.protectedRatio * this._capacityMax);
		const current = this.segments.adaptiveTarget ?? staticTarget;

		if (fromFrequency) {
			const delta = Math.max(1, Math.floor(recency / frequency));
			this.segments.adaptiveTarget = Math.min(this._capacityMax, current + delta);
		} else {
			const delta = Math.max(1, Math.floor(frequency / recency));
			this.segments.adaptiveTarget = Math.max(0, current - delta);
		}
	}

	/** Whether the CLOCK second-chance sweep is active. */
	private evictSecondChance(): boolean {
		return this._cfg.evict.secondChance;
	}

	/**
	 * Select the id to evict to make room for `candidateId`, or `null` to reject the add. Delegates
	 * to `init.evictionTargetSelector` when provided, else dispatches on `evict.basis`. Selection is a
	 * metadata scan — the `items` Map is never reordered.
	 * @param candidateId	Id of the item being added.
	 * @returns				Eviction target id, or `null` when no eviction is possible.
	 */
	protected selectEvictionTarget(candidateId: CacheItemId): CacheItemId | null {
		if (this.evictionTargetSelector) {
			return this.evictionTargetSelector(this, candidateId);
		}

		if (this._cfg.evict.basis === 'none' || this.items.size === 0) {
			return null;
		}

		if (this.segments) {
			return this.evictionTargetBySegments();
		}

		if (this._cfg.evict.secondChance) {
			return this.evictionTargetByClock();
		}

		return this.evictionTargetByBasis();
	}

	/** Dispatch to the plain metadata-scan eviction target for the configured `evict.basis`. */
	private evictionTargetByBasis(): CacheItemId | null {
		switch (this._cfg.evict.basis) {
			case 'access':
				return this.evictionTargetByAccess();
			case 'frequency':
				return this.evictionTargetByFrequency();
			case 'random':
				return this.evictionTargetByRandom();
			case 'insertion':
			default:
				return this.evictionTargetByInsertion();
		}
	}

	/** `insertion` basis: first key (`oldest`) or last key (`newest`). O(1)/O(n). */
	private evictionTargetByInsertion(): CacheItemId | null {
		if (this._cfg.evict.order === 'newest') {
			let last: CacheItemId | null = null;
			for (const key of this.items.keys()) {
				last = key;
			}
			return last;
		}

		const first = this.items.keys().next();
		return first.done ? null : first.value;
	}

	/** `access` basis: min (`oldest`) / max (`newest`) `lastAccessSeq`. */
	private evictionTargetByAccess(): CacheItemId | null {
		const newest = this._cfg.evict.order === 'newest';
		let evictionTarget: CacheItemId | null = null;
		let best = 0;

		for (const [id, item] of this.items) {
			const value = item.lastAccessSeq;
			if (evictionTarget === null || (newest ? value > best : value < best)) {
				evictionTarget = id;
				best = value;
			}
		}

		return evictionTarget;
	}

	/**
	 * `frequency` basis: min (`oldest`) / max (`newest`) `accessCount`. Ties broken by
	 * `evict.tieBreak` — `access` prefers the lower `lastAccessSeq`, `insertion` the lower
	 * `addedSeq`.
	 */
	private evictionTargetByFrequency(): CacheItemId | null {
		const newest = this._cfg.evict.order === 'newest';
		const tieByInsertion = this._cfg.evict.tieBreak === 'insertion';
		let evictionTarget: CacheItemId | null = null;
		let bestCount = 0;
		let bestTie = 0;

		for (const [id, item] of this.items) {
			const count = item.accessCount;
			const tie = tieByInsertion ? item.addedSeq : item.lastAccessSeq;

			if (evictionTarget === null) {
				evictionTarget = id;
				bestCount = count;
				bestTie = tie;
				continue;
			}

			const better = newest ? count > bestCount : count < bestCount;
			const tied = count === bestCount;
			if (better || (tied && tie < bestTie)) {
				evictionTarget = id;
				bestCount = count;
				bestTie = tie;
			}
		}

		return evictionTarget;
	}

	/** `random` basis: the nth key for a uniformly random n in `[0, size)`. */
	private evictionTargetByRandom(): CacheItemId | null {
		const n = Math.floor(this.rng() * this.items.size);
		let i = 0;
		for (const id of this.items.keys()) {
			if (i === n) {
				return id;
			}
			i++;
		}

		// rng returned >= 1 (out of contract) — fall back to the last key.
		let last: CacheItemId | null = null;
		for (const key of this.items.keys()) {
			last = key;
		}
		return last;
	}

	/**
	 * CLOCK second-chance sweep. Walks the insertion-ordered keys starting just after `clockHand`
	 * (wrapping). A referenced item is given one reprieve (bit cleared) and skipped; the first
	 * unreferenced item is the eviction target. If every item was referenced, the sweep cleared all
	 * bits and we fall back to the plain basis eviction target. The hand is left at the eviction
	 * target's predecessor so the next sweep resumes where this one stopped.
	 */
	private evictionTargetByClock(): CacheItemId | null {
		const keys = Array.from(this.items.keys());
		if (keys.length === 0) {
			return null;
		}

		let start = 0;
		if (this.clockHand !== null) {
			const handIdx = keys.indexOf(this.clockHand);
			start = handIdx === -1 ? 0 : (handIdx + 1) % keys.length;
		}

		for (let step = 0; step < keys.length; step++) {
			const idx = (start + step) % keys.length;
			const id = keys[idx];
			const item = this.items.get(id);
			if (!item) {
				continue;
			}

			const meta = this.policyMeta(item);
			if (meta.referenced) {
				meta.referenced = false;
				continue;
			}

			// Eviction target found — resume the next sweep at this item's predecessor.
			this.clockHand = idx === 0 ? null : keys[idx - 1];
			return id;
		}

		// Every bit was set (and is now cleared) — fall back to the plain basis eviction target.
		this.clockHand = null;
		return this.evictionTargetByBasis();
	}

	/**
	 * Segment-aware eviction target selection. Prefers a probation target (via `probationBasis`)
	 * when probation is over budget or protected has no candidates; otherwise falls back to
	 * protected members via `evict.basis`/`order`.
	 */
	private evictionTargetBySegments(): CacheItemId | null {
		const segments = this.segments;
		if (!segments) {
			return this.evictionTargetByBasis();
		}

		// SLRU/2Q: eviction targets probation first; protected is only touched when probation is
		// empty. (The probation-over-budget case still resolves to a probation eviction target, so it
		// is covered by the same branch.)
		const probationEvictionTarget = this.probationEvictionTarget();
		if (probationEvictionTarget !== null) {
			return probationEvictionTarget;
		}

		const protectedEvictionTarget = this.protectedEvictionTarget();
		if (protectedEvictionTarget !== null) {
			return protectedEvictionTarget;
		}

		return this.evictionTargetByBasis();
	}

	/** Probation member chosen by `segments.probationBasis` (lowest lastAccessSeq / addedSeq). */
	private probationEvictionTarget(): CacheItemId | null {
		const byInsertion = this._cfg.segments.probationBasis === 'insertion';
		let evictionTarget: CacheItemId | null = null;
		let best = 0;

		for (const [id, item] of this.items) {
			const meta = item.policyData as PolicyMeta | undefined;
			if (meta?.segment !== 'probation') {
				continue;
			}

			const value = byInsertion ? item.addedSeq : item.lastAccessSeq;
			if (evictionTarget === null || value < best) {
				evictionTarget = id;
				best = value;
			}
		}

		return evictionTarget;
	}

	/** Protected member chosen by `evict.basis`/`order`. */
	private protectedEvictionTarget(): CacheItemId | null {
		const newest = this._cfg.evict.order === 'newest';
		let evictionTarget: CacheItemId | null = null;
		let best = 0;

		for (const [id, item] of this.items) {
			const meta = item.policyData as PolicyMeta | undefined;
			if (meta?.segment !== 'protected') {
				continue;
			}

			const value = item.lastAccessSeq;
			if (evictionTarget === null || (newest ? value > best : value < best)) {
				evictionTarget = id;
				best = value;
			}
		}

		return evictionTarget;
	}

	/**
	 * Delete item from cache matching `id` if one exists.
	 * @param id		Unique ID of item in cache.
	 * @returns			`true` when an item was removed, otherwise `false`.
	 */
	public delete(id: string): boolean {
		return this.removeItem(id, 'delete');
	}

	/**
	 * Refresh the expiration window of an unexpired item matching `id`. Fires `onItemHit` with
	 * source `touch` on success. Expired items are lazily removed and cannot be touched.
	 * @param id		Unique ID of item in cache.
	 * @returns			`true` when the item exists & was refreshed, otherwise `false`.
	 */
	public touch(id: string): boolean {
		const item = this.getItem(id, 'touch');
		if (!item) {
			return false;
		}

		this.emit('onItemHit', item.data, id, 'touch');
		return true;
	}

	/**
	 * Iterate ids of unexpired cached items. Expired items encountered during iteration are
	 * skipped & lazily removed.
	 * @returns
	 */
	public *keys(): IterableIterator<CacheItemId> {
		for (const id of Array.from(this.items.keys())) {
			if (this.peek(id) !== null) {
				yield id;
			}
		}
	}

	/**
	 * Iterate unexpired cached items. Expired items encountered during iteration are skipped &
	 * lazily removed.
	 * @returns
	 */
	public *values(): IterableIterator<ItemT> {
		for (const id of Array.from(this.items.keys())) {
			const item = this.peek(id);
			if (item !== null) {
				yield item.data;
			}
		}
	}

	/**
	 * Iterate `[id, item]` pairs of unexpired cached items. Expired items encountered during
	 * iteration are skipped & lazily removed.
	 * @returns
	 */
	public *entries(): IterableIterator<[CacheItemId, ItemT]> {
		for (const id of Array.from(this.items.keys())) {
			const item = this.peek(id);
			if (item !== null) {
				yield [id, item.data];
			}
		}
	}

	/**
	 * Lazy-expiring lookup that does NOT count as an access — used by iteration helpers so that
	 * merely enumerating the cache never perturbs eviction ordering.
	 */
	private peek(id: string): CacheItem<ItemT> | null {
		const item = this.items.get(id);
		if (!item || !(item instanceof CacheItem)) {
			return null;
		}

		if (item.expired()) {
			this.removeItem(id, 'expire');
			return null;
		}

		return item;
	}

	/**
	 * Iterate unexpired cached items.
	 * @returns
	 */
	public [Symbol.iterator](): IterableIterator<ItemT> {
		return this.values();
	}

	/**
	 * Iterate over all items and remove any that are expired.
	 * @param opts		`force: true` bypasses the `minDelay` gate.
	 * @returns			Number of items pruned.
	 */
	public prune(opts?: CachePruneOptions): number {
		// Bail out if called before enough time has elapsed, unless forced.
		if (opts?.force !== true && !this.lastPrune.elapsed(this.pruneDelay)) {
			return 0;
		}

		let count = 0;

		for (const [key, value] of Array.from(this.items)) {
			if (value.expired()) {
				if (this.removeItem(key, 'expire')) {
					count++;
				}
			}
		}

		this.lastPrune.setNow();
		this.emit('onPrune', count);
		return count;
	}

	/**
	 * Change the capacity cap. Rejects non-finite, negative, or non-number values. `0` = unbounded.
	 * On a decrease below current size, immediately evicts via the active policy until
	 * `size <= next`, firing evict events per eviction target. Fires `onCapacityIncrease` /
	 * `onCapacityDecrease` on change.
	 * @param next		New capacity cap.
	 * @returns			`true` when applied, otherwise `false`.
	 */
	public setCapacity(next: number): boolean {
		if (typeof next !== 'number' || !Number.isFinite(next) || next < 0) {
			return false;
		}

		const old = this._capacityMax;
		if (next === old) {
			return true;
		}

		this._capacityMax = next;

		if (next > old || next === 0) {
			this.emit('onCapacityIncrease', old, next);
			return true;
		}

		this.emit('onCapacityDecrease', old, next);

		// Shrink: evict via the active policy until within the new cap.
		while (this._capacityMax > 0 && this.items.size > this._capacityMax) {
			const evictionTarget = this.selectEvictionTarget('');
			if (evictionTarget === null) {
				break;
			}

			this.removeItem(evictionTarget, 'evict');
		}

		return true;
	}

	/**
	 * Remove every item without firing per-item events. Fires `onClear(count)` once.
	 * @returns		Number of items removed.
	 */
	public clear(): number {
		const count = this.items.size;
		this.items.clear();
		this.onClearInternal();
		this.emit('onClear', count);
		return count;
	}

	/**
	 * Internal hook invoked by `clear()` before user events fire. No-op until feature modules
	 * (segments, ghosts) need to zero their state.
	 */
	protected onClearInternal(): void {
		this.clockHand = null;
		if (this.segments) {
			this.segments.reset();
		}
		if (this.ghosts) {
			this.ghosts.reset();
		}
	}

	/**
	 * Reset cache to initial state: clear items, restore stats, capacity, sequence, and prune
	 * timers. Fires `onClear` (from `clear()`) then `onReset`.
	 * @returns		void
	 */
	public reset(): void {
		this.clear();
		this.pruneDelay.reset();
		this.lastPrune.reset();
		this.stats.reset();
		this.seq = 0;
		this.setCapacity(this.initialCapacityMax);

		// Restore the ARC adaptive target to its initial static value.
		if (this._cfg.adaptive && this.segments) {
			this.segments.adaptiveTarget = Math.floor(
				this._cfg.segments.protectedRatio * this.initialCapacityMax
			);
		}

		// Restart auto-prune when configured (it may have been stopped by stopAutoPrune()).
		if (this._cfg.prune.auto) {
			this.startAutoPrune();
		}

		this.emit('onReset');
	}
}
