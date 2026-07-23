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

/**
 * Operation counters tracked by each `Cache` instance. All counters start at `0` and are
 * restored to `0` when the parent cache's `reset()` is called.
 *
 * @category Cache
 */
export class CacheStats {
	/** Number of `get` calls that returned a cached item. */
	public hits: number;
	/** Number of `get` calls that did not return an item, including expired lookups. */
	public misses: number;
	/** Number of items successfully added to cache by `add`. */
	public adds: number;
	/** Number of items removed by explicit `delete` calls. */
	public deletes: number;
	/** Number of items evicted to make room when adding at capacity. */
	public evictions: number;
	/** Number of expired items removed, whether by `prune` or lazily during lookups. */
	public expirations: number;

	constructor() {
		this.hits = 0;
		this.misses = 0;
		this.adds = 0;
		this.deletes = 0;
		this.evictions = 0;
		this.expirations = 0;
	}

	/**
	 * Reset all counters to `0`.
	 * @returns		void
	 */
	public reset(): void {
		this.hits = 0;
		this.misses = 0;
		this.adds = 0;
		this.deletes = 0;
		this.evictions = 0;
		this.expirations = 0;
	}
}
