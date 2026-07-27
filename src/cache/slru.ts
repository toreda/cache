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
 * Config accepted by {@link SlruCache}. The `evict` group is pinned and `segments` is fixed to
 * SLRU behavior; the caller may only tune `protectedRatio`.
 *
 * @category Cache
 */
export type SlruCacheCfg = Omit<CfgPartial, 'evict' | 'segments'> & {
	segments?: {protectedRatio?: number};
};

/**
 * Init for {@link SlruCache}.
 *
 * @category Cache
 */
export type SlruCacheInit<ItemT extends Cacheable> = Omit<CacheInit<ItemT>, 'cfg'> & {
	cfg?: SlruCacheCfg;
};

/**
 * Segmented LRU cache. Splits capacity into a probation region (new items) and a protected
 * region (items hit at least once). Scan-resistant: a one-time burst of new ids churns through
 * probation without displacing the protected working set.
 *
 * @category Cache
 */
export class SlruCache<ItemT extends Cacheable> extends Cache<ItemT> {
	constructor(init?: SlruCacheInit<ItemT>) {
		const protectedRatio = init?.cfg?.segments?.protectedRatio ?? 0.8;

		super({
			...init,
			cfg: {
				...init?.cfg,
				evict: {basis: 'access', order: 'oldest', secondChance: false, tieBreak: 'access'},
				segments: {
					enabled: true,
					probationBasis: 'access',
					promoteOnHit: true,
					protectedRatio: protectedRatio,
					// Probation fills the remainder so protected + probation never exceeds capacity.
					probationRatio: SlruCache.complementRatio(protectedRatio)
				}
			}
		});
	}

	/** The (0, 1)-clamped complement of a ratio, used to size probation against protected. */
	private static complementRatio(ratio: number): number {
		const complement = 1 - ratio;
		if (!Number.isFinite(complement) || complement <= 0) {
			return 0.2;
		}

		return complement >= 1 ? 0.99 : complement;
	}
}
