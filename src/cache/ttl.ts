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

import {Cache} from '../cache';
import type {CacheInit} from './init';
import type {Cacheable} from '../cacheable';
import type {CfgPartial} from '../cfg/partial';

/**
 * Config accepted by {@link TtlCache}. The `evict` group and `prune.auto` are pinned by the
 * wrapper. A positive `ttl` is required; `capacityMax` defaults to `0` (unbounded).
 *
 * @category Cache
 */
export type TtlCacheCfg = Omit<CfgPartial, 'evict'> & {
	prune?: Omit<NonNullable<CfgPartial['prune']>, 'auto'>;
	/** Required default TTL (seconds). Must be `> 0`. */
	ttl: number;
};

/**
 * Init for {@link TtlCache}.
 *
 * @category Cache
 */
export type TtlCacheInit<ItemT extends Cacheable> = Omit<CacheInit<ItemT>, 'cfg'> & {
	cfg: TtlCacheCfg;
};

/**
 * Pure expiration cache. Items are never evicted for capacity — they leave only when their TTL
 * elapses, swept automatically by an auto-prune timer. Composes freely with any capacity cap.
 *
 * @category Cache
 */
export class TtlCache<ItemT extends Cacheable> extends Cache<ItemT> {
	constructor(init: TtlCacheInit<ItemT>) {
		const ttl = init.cfg.ttl;
		if (typeof ttl !== 'number' || !Number.isFinite(ttl) || ttl <= 0) {
			throw new Error(`TtlCache requires cfg.ttl > 0.`);
		}

		super({
			...init,
			cfg: {
				capacityMax: 0,
				...init.cfg,
				evict: {basis: 'none', order: 'oldest', secondChance: false, tieBreak: 'access'},
				prune: {...init.cfg.prune, auto: true}
			}
		});
	}

	/**
	 * Seconds until the item matching `id` expires.
	 * @param id		Unique ID of item in cache.
	 * @returns			Whole seconds remaining; `0` when the item never expires; `null` when no
	 *					unexpired item matches `id` (absent or already expired, in which case it is
	 *					lazily removed).
	 */
	public getRemainingTtl(id: string): number | null {
		const item = this.items.get(id);
		if (!item) {
			return null;
		}

		if (item.expired()) {
			this.removeItem(id, 'expire');
			return null;
		}

		return item.remainingTtl();
	}
}
