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

import type {Cache} from '../cache';
import type {CacheEvents} from './events';
import type {CacheItemId} from './item/id';
import type {Cacheable} from '../cacheable';
import type {CfgPartial} from '../cfg/partial';
import type {LogLike} from '@toreda/shared-types';

/**
 * Init object accepted by the `Cache` constructor. Groups the function-valued options (validator,
 * rng, eviction target selector, events) alongside the data-only `cfg`.
 *
 * @category Cache
 */
export interface CacheInit<ItemT extends Cacheable> {
	/** Optional log instance used for cache activity & diagnostic output. */
	log?: LogLike;
	/** Caller-provided partial config merged over defaults during init. */
	cfg?: CfgPartial;
	/**
	 * Optional validator invoked each time `add` is called. Items are added when the validator
	 * returns `true` and rejected when it returns `false`. When omitted, all items are accepted.
	 */
	itemValidator?: (item?: ItemT | null) => boolean;
	/** Random source for the `random` eviction basis and sketch hashing. Default `Math.random`. */
	rng?: () => number;
	/**
	 * Escape hatch for eviction target selection rules no flag combination expresses. Returns the
	 * id to evict, or `null` to reject the incoming add.
	 */
	evictionTargetSelector?: (cache: Cache<ItemT>, candidateId: CacheItemId) => CacheItemId | null;
	/** Optional observability callbacks. */
	events?: CacheEvents<ItemT>;
}
