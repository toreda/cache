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

import type {CacheItemId} from './item/id';
import type {CacheRejectReason} from './reject/reason';
import type {CacheRemoveReason} from './remove/reason';
import type {Time} from '@toreda/time';

/**
 * User-supplied observability callbacks fired by `Cache`. Every callback is optional and costs
 * nothing when unset. Callbacks fire post-commit (state + stats already updated), synchronously,
 * each wrapped in try/catch — a throwing callback is logged and never corrupts cache state.
 *
 * Single-item removals fire the specific event (`onItemExpire` / `onItemEvict`) first, then the
 * general `onItemRemove`. Bulk `clear()` / `reset()` fire only `onClear` (and `onReset`) — never
 * per-item events.
 *
 * @category Cache
 */
export interface CacheEvents<ItemT> {
	// ── Item lifecycle ────────────────────────────────────────
	/** Fired after an item is successfully added. */
	onItemAdd?: (item: ItemT, id: CacheItemId) => void;
	/** Fired when an item is removed because its TTL elapsed. Precedes `onItemRemove`. */
	onItemExpire?: (item: ItemT, id: CacheItemId, timeAdded: Time) => void;
	/** Fired when an item is removed to make room at capacity. Precedes `onItemRemove`. */
	onItemEvict?: (item: ItemT, id: CacheItemId) => void;
	/** Fired for every single-item removal, after any specific event, with the reason. */
	onItemRemove?: (item: ItemT, id: CacheItemId, reason: CacheRemoveReason) => void;
	/** Fired when an `add` call is refused, with the reason. */
	onAddRejected?: (item: ItemT, reason: CacheRejectReason) => void;

	// ── Access (opt-in observability; zero cost when unset) ───
	/** Fired on a cache hit via `get` or `touch`. */
	onItemHit?: (item: ItemT, id: CacheItemId, source: 'get' | 'touch') => void;
	/** Fired on a `get` miss. */
	onItemMiss?: (id: CacheItemId) => void;

	// ── Cache-level ───────────────────────────────────────────
	/** Fired when capacity is raised via `setCapacity`. */
	onCapacityIncrease?: (oldMax: number, newMax: number) => void;
	/** Fired when capacity is lowered via `setCapacity`. */
	onCapacityDecrease?: (oldMax: number, newMax: number) => void;
	/** Fired once by `clear()` / `reset()` with the number of items removed. */
	onClear?: (count: number) => void;
	/** Fired by `reset()` after `onClear`. */
	onReset?: () => void;
	/** Fired whenever `prune()` actually runs (not delay-gated), including when 0 removed. */
	onPrune?: (removed: number) => void;
}
