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
 * Config accepted by {@link TinyLfuCache}. The `evict`, `segments`, and `admission` behavior is
 * fixed to W-TinyLFU; the caller may tune the entry window (`windowRatio`), the sketch decay
 * (`sketchResetThreshold`), and the protected ratio.
 *
 * @category Cache
 */
export type TinyLfuCacheCfg = Omit<CfgPartial, 'evict' | 'segments' | 'admission' | 'ghosts' | 'adaptive'> & {
	segments?: {protectedRatio?: number};
	admission?: {windowRatio?: number; sketchResetThreshold?: number};
};

/**
 * Init for {@link TinyLfuCache}.
 *
 * @category Cache
 */
export type TinyLfuCacheInit<ItemT extends Cacheable> = Omit<CacheInit<ItemT>, 'cfg'> & {
	cfg?: TinyLfuCacheCfg;
};

/**
 * W-TinyLFU cache. A small admission window (probation) feeds a frequency-gated main region: a
 * newcomer is admitted over the main victim only when a count-min sketch estimates it is accessed
 * at least as often, so rarely-used newcomers cannot evict a proven hot item.
 *
 * @category Cache
 */
export class TinyLfuCache<ItemT extends Cacheable> extends Cache<ItemT> {
	constructor(init?: TinyLfuCacheInit<ItemT>) {
		const windowRatio = init?.cfg?.admission?.windowRatio ?? 0.01;
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
					// The probation region is the admission window.
					probationRatio: TinyLfuCache.clampRatio(windowRatio)
				},
				admission: {
					policy: 'frequency',
					windowRatio: TinyLfuCache.clampRatio(windowRatio),
					sketchResetThreshold: init?.cfg?.admission?.sketchResetThreshold ?? 0
				},
				ghosts: {enabled: false, perSegment: false},
				adaptive: false
			}
		});
	}

	/** Clamp a ratio into the open interval (0, 1). */
	private static clampRatio(ratio: number): number {
		if (!Number.isFinite(ratio) || ratio <= 0) {
			return 0.01;
		}

		return ratio >= 1 ? 0.99 : ratio;
	}
}
