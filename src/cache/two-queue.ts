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
 * Config accepted by {@link TwoQueueCache}. The `evict` group is pinned and segmentation/ghosts
 * are fixed to 2Q behavior; the caller may tune the A1in budget (`probationRatio`) and the ghost
 * (A1out) budget (`ghosts.sizeRatio`).
 *
 * @category Cache
 */
export type TwoQueueCacheCfg = Omit<CfgPartial, 'evict' | 'segments' | 'ghosts' | 'adaptive'> & {
	segments?: {probationRatio?: number};
	ghosts?: {sizeRatio?: number};
};

/**
 * Init for {@link TwoQueueCache}.
 *
 * @category Cache
 */
export type TwoQueueCacheInit<ItemT extends Cacheable> = Omit<CacheInit<ItemT>, 'cfg'> & {
	cfg?: TwoQueueCacheCfg;
};

/**
 * 2Q cache. New items enter a FIFO probation queue (A1in); a hit promotes to the main LRU region.
 * Ids evicted from probation are remembered in a ghost registry (A1out) so a quick re-reference
 * admits the item straight into the main region — one-hit-wonders churn out without polluting it.
 *
 * @category Cache
 */
export class TwoQueueCache<ItemT extends Cacheable> extends Cache<ItemT> {
	constructor(init?: TwoQueueCacheInit<ItemT>) {
		const probationRatio = TwoQueueCache.clampRatio(init?.cfg?.segments?.probationRatio ?? 0.25);

		super({
			...init,
			cfg: {
				...init?.cfg,
				evict: {basis: 'access', order: 'oldest', secondChance: false, tieBreak: 'access'},
				segments: {
					enabled: true,
					probationBasis: 'insertion',
					promoteOnHit: true,
					probationRatio: probationRatio,
					// The main (protected) region fills the remaining capacity.
					protectedRatio: TwoQueueCache.clampRatio(1 - probationRatio)
				},
				ghosts: {
					enabled: true,
					perSegment: false,
					sizeRatio: init?.cfg?.ghosts?.sizeRatio ?? 0.5
				},
				adaptive: false
			}
		});
	}

	/** Clamp a ratio into the open interval (0, 1). */
	private static clampRatio(ratio: number): number {
		if (!Number.isFinite(ratio) || ratio <= 0) {
			return 0.25;
		}

		return ratio >= 1 ? 0.99 : ratio;
	}
}
