/**
 *	MIT License
 *
 *	Copyright (c) 2019 - 2021 Toreda, Inc.
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

import {Log} from '@toreda/log';

/**
 * Configuration options used during Cache init.
 *
 * @category Cache Config
 */
export interface CfgData<ItemT> {
	/** Maximum number of items that can be cached. When cache size would exceed this size, older
	 * items are overwritten. */
	capacityMax?: number;
	/**
	 * Initial size of empty cache. Cache grows automatically as items are added up to `maxSize`.
	 * Useful in cases where a larger starting cache size is ideal rather than letting it grow,
	 * such as during init in systems which may rapidly add hundreds of thousands of cache items.
	 */
	initialSize?: number;
	/**
	 *	Optional validator invoked each time cache.add is called. Items are added to cache when
	 * validator returns true, and rejected when it returns false. Allows custom or extended cache
	 * types to provide custom item validation. When `itemValidator` is not provided, the default
	 * `itemValidator` is used which rejects only `undefined` and `null` items.
	 */
	itemValidator?: (item?: ItemT | null) => boolean;
	/**
	 * Global Log instance to use. Creates a new instance when not provided.
	 */
	log?: Log;
	/**
	 * Minimum number of seconds allowed prune calls. Prevents costly `prune` calls from occurring
	 * too frequently.
	 */
	pruneDelay?: number;
}
