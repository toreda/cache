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
 * Config accepted by {@link ArcCache}. The `evict`, `segments`, `ghosts`, and `adaptive` behavior
 * is fixed to ARC; the caller may tune the initial protected ratio (ARC's starting `p`).
 *
 * @category Cache
 */
export type ArcCacheCfg = Omit<CfgPartial, 'evict' | 'segments' | 'ghosts' | 'adaptive'> & {
	segments?: {protectedRatio?: number};
};

/**
 * Init for {@link ArcCache}.
 *
 * @category Cache
 */
export type ArcCacheInit<ItemT extends Cacheable> = Omit<CacheInit<ItemT>, 'cfg'> & {
	cfg?: ArcCacheCfg;
};

/**
 * Adaptive Replacement Cache. Balances recency and frequency dynamically: per-segment ghost lists
 * (B1/B2) record which region evictions came from, and a hit on a ghost shifts the protected
 * target (`p`) toward whichever pattern is currently winning.
 *
 * @category Cache
 */
export class ArcCache<ItemT extends Cacheable> extends Cache<ItemT> {
	constructor(init?: ArcCacheInit<ItemT>) {
		const protectedRatio = init?.cfg?.segments?.protectedRatio ?? 0.5;

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
					probationRatio: ArcCache.complementRatio(protectedRatio)
				},
				ghosts: {enabled: true, perSegment: true, sizeRatio: 0.5},
				adaptive: true
			}
		});
	}

	/** The (0, 1)-clamped complement of a ratio, sizing probation against protected. */
	private static complementRatio(ratio: number): number {
		const complement = 1 - ratio;
		if (!Number.isFinite(complement) || complement <= 0) {
			return 0.5;
		}

		return complement >= 1 ? 0.99 : complement;
	}
}
