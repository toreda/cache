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

import {Defaults} from '../defaults';
import type {Time} from '@toreda/time';
import {timeMake} from '@toreda/time';

/**
 * Init object accepted by the `CacheItem` constructor.
 *
 * @category Cache
 */
export interface CacheItemInit<ItemT> {
	/** Wrapped item data. */
	data: ItemT;
	/** Optional TTL (seconds). `0` never expires; invalid values fall back to the default TTL. */
	ttl?: number;
	/** Monotonic insertion sequence assigned by the owning `Cache`. */
	addedSeq: number;
}

/**
 * Wraps generic cache items and stores meta data about the item, including the sequence and
 * access metadata used by the eviction engine.
 *
 * @category Cache
 */
export class CacheItem<ItemT> {
	public data: ItemT;
	public readonly created: Time;
	public readonly updated: Time;
	public readonly ttl: Time;
	/** Monotonic insertion sequence. Never changes after construction. */
	public readonly addedSeq: number;
	/** Sequence of the most recent qualifying access. Starts equal to `addedSeq`. */
	public lastAccessSeq: number;
	/** Number of qualifying accesses since the item was added. Starts at 0. */
	public accessCount: number;
	/** Slot owned by internal feature modules (CLOCK reference bit, segment tags, etc.). */
	public policyData?: unknown;

	constructor(init: CacheItemInit<ItemT>) {
		this.data = init.data;

		this.created = timeMake('s', 0).setNow();
		this.updated = timeMake('s', 0);
		this.ttl = timeMake('s', CacheItem.sanitizeTtl(init.ttl));
		this.addedSeq = init.addedSeq;
		this.lastAccessSeq = init.addedSeq;
		this.accessCount = 0;
	}

	/**
	 * Validate optional `ttl` arg. Rejects values that are not `typeof number`, non-finite values
	 * (`NaN`, `±Infinity`), and negative values, falling back to the default TTL. `0` is valid and
	 * means the item never expires.
	 * @param ttl
	 * @returns
	 */
	private static sanitizeTtl(ttl?: number | null): number {
		if (typeof ttl !== 'number' || !Number.isFinite(ttl) || ttl < 0) {
			return Defaults.CacheItem.TTL;
		}

		return ttl;
	}

	/**
	 * Record a qualifying access: advance `lastAccessSeq` and increment `accessCount`.
	 * @param seq		Sequence value assigned by the owning cache for this access.
	 * @returns			void
	 */
	public recordAccess(seq: number): void {
		this.lastAccessSeq = seq;
		this.accessCount++;
	}

	/**
	 * Check whether this item is expired.
	 * @returns
	 */
	public expired(): boolean {
		const ttl = this.ttl();

		// Based on DNS conventions, items with 0 TTL don't expire until forcefully cleared.
		if (ttl === 0) {
			return false;
		}

		const now = timeMake('s', 0).setNow();
		let elapsed: Time | null;

		if (this.updated() > 0) {
			elapsed = now.since(this.updated);
		} else {
			elapsed = now.since(this.created);
		}

		return elapsed === null || elapsed() >= ttl;
	}

	public update(): void {
		this.updated.setNow();
	}

	/**
	 * Seconds remaining before this item expires. Returns `0` when the item never expires
	 * (ttl 0) and a value `<= 0`-clamped-to-0 semantics are avoided by callers checking
	 * `expired()` first. A negative internal result is clamped to `0`.
	 * @returns		Whole seconds remaining, or `0` when the item never expires.
	 */
	public remainingTtl(): number {
		const ttl = this.ttl();
		if (ttl === 0) {
			return 0;
		}

		const base = this.updated() > 0 ? this.updated() : this.created();
		const now = timeMake('s', 0).setNow();
		const elapsed = now() - base;
		const remaining = ttl - elapsed;

		return remaining > 0 ? remaining : 0;
	}
}
