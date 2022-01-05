/**
 *	MIT License
 *
 *	Copyright (c) 2019 - 2022 Toreda, Inc.
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

import {numberValue, typeMatch, uIntMake} from '@toreda/strong-types';

import {CacheItem} from './cache/item';
import type {CacheItemId} from './cache/item/id';
import type {Cacheable} from './cacheable';
import type {CfgData} from './cfg/data';
import {Defaults} from './defaults';
import {Log} from '@toreda/log';
import type {Time} from '@toreda/time';
import type {UInt} from '@toreda/strong-types';
import {cacheItemId} from './cache/item/id';
import {timeMake} from '@toreda/time';

/**
 * Time based object cache for TypeScript generics.
 *
 * @category Cache
 */
export class Cache<ItemT extends Cacheable> {
	/** Global log instance. */
	public readonly log: Log;
	/** Map of ItemId  */
	public readonly items: Map<CacheItemId, CacheItem<ItemT>>;
	/** Validates objects before they're added to the cache. */
	public readonly itemValidator: (item?: ItemT | null) => boolean;
	/** Max number of items that can be cached at any one time. */
	public readonly capacityMax: UInt;
	/** Minimum number of seconds between prune calls. `prune()` execution aborts automatically when called
	 *  more frequently than delay allows. */
	public readonly pruneDelay: Time;
	/** Timestamp of the last successful prune operation. */
	public readonly lastPrune: Time;

	constructor(cfg?: CfgData<ItemT>) {
		this.items = new Map<string, CacheItem<ItemT>>();

		this.itemValidator = cfg?.itemValidator ? cfg.itemValidator : this.defaultItemValidator.bind(this);
		this.log = this.makeLog(cfg?.log);
		this.capacityMax = uIntMake(Defaults.Cache.CapacityMax, cfg?.capacityMax);
		this.pruneDelay = timeMake('s', numberValue(cfg?.pruneDelay, Defaults.Cache.PruneDelay));
		this.lastPrune = timeMake('s', 0);
	}

	/**
	 * Helper that guarantees a Log instance is set during init. Check optional `log` arg and return it if
	 * it's a valid `Log` instance. Otherwise creates & returns a new `Log` instance.
	 * @param baseLog
	 * @returns
	 */
	private makeLog(log?: Log): Log {
		if (!typeMatch(log, Log)) {
			return new Log();
		}

		return log.makeLog('Cache');
	}

	/**
	 * Get current cached item count.
	 * @returns
	 */
	public size(): number {
		return this.items.size;
	}

	/**
	 * Check unexpired item with target id exists in cache. Returns false when target item expires
	 * but still exists in cache.
	 * @param id		Unique ID of item in cache.
	 * @returns
	 */
	public has(id: string): boolean {
		if (!this.items.has(id)) {
			return false;
		}

		const item = this.items.get(id);
		if (!item || !typeMatch(item, CacheItem)) {
			return false;
		}

		return item?.expired() === false;
	}

	/**
	 * Get item from cache matching `id` if one exists.
	 * @param id		Globally unique item identifier.
	 * @returns			Item of type `ItemT` if it exists, otherwise `null`.
	 */
	public get(id: string): ItemT | null {
		if (!this.has(id)) {
			return null;
		}

		const wrapper = this.items.get(id);
		if (wrapper?.expired()) {
			return null;
		}

		if (!wrapper?.data) {
			return null;
		}

		return wrapper.data;
	}

	/**
	 * Add item to cache if it does not exist. When ite
	 * @param item			Item to cache.
	 * @param overwrite		`true`	-	Overwrite existing item with same ID.
	 *						`false`	-	(default) Do not overwrite existing item. add call fails.
	 * @returns
	 */
	public add(item: ItemT, overwrite?: boolean): boolean {
		const id = cacheItemId(item);

		if (!id) {
			return false;
		}

		const has = this.has(id);

		if (has === true && overwrite !== true) {
			return false;
		}

		const wrappedItem = new CacheItem<ItemT>(item);
		this.items.set(id, wrappedItem);

		return true;
	}

	/**
	 * The default validator used to check items before they're cached. Only used when no cache
	 *  cfg option is provided for `itemValidator`.
	 * @param item
	 * @returns
	 */
	public defaultItemValidator(item?: ItemT | null): boolean {
		if (!item) {
			return false;
		}

		return true;
	}

	/**
	 * Clear cached & volatile data that can be easily recreated. The system received a memory
	 * warning, indicating performance issues.
	 * @returns		`true` when handler executes, `false` when handler does not execute.
	 */
	public async onMemoryWarning(): Promise<boolean> {
		this.reset();

		return true;
	}

	/**
	 * Iterate over all items and check for expiration.
	 * @returns
	 */
	public async prune(): Promise<number> {
		// Bail out if called before enough time has elapsed.
		if (!this.lastPrune.elapsed(this.pruneDelay)) {
			return 0;
		}

		let count = 0;

		for (const [key, value] of this.items) {
			if (value.expired()) {
				this.items.delete(key);
				count++;
			}
		}

		this.lastPrune.setNow();
		return count;
	}

	/**
	 * Reset cache to inital state.
	 * @returns		void
	 */
	public reset(): void {
		this.pruneDelay.reset();
		this.lastPrune.reset();
		this.capacityMax.reset();
		this.items.clear();
	}
}
