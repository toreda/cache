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
 * Init for {@link ClockCache}. The `evict` group is pinned by the wrapper.
 *
 * @category Cache
 */
export type ClockCacheInit<ItemT extends Cacheable> = Omit<CacheInit<ItemT>, 'cfg'> & {
	cfg?: Omit<CfgPartial, 'evict'>;
};

/**
 * CLOCK cache. Approximates LRU cheaply: eviction sweeps insertion order, giving each
 * recently-accessed item one reprieve (its reference bit is cleared) before it can be evicted.
 *
 * @category Cache
 */
export class ClockCache<ItemT extends Cacheable> extends Cache<ItemT> {
	constructor(init?: ClockCacheInit<ItemT>) {
		super({
			...init,
			cfg: {
				...init?.cfg,
				evict: {basis: 'insertion', order: 'oldest', secondChance: true, tieBreak: 'access'}
			}
		});
	}
}
