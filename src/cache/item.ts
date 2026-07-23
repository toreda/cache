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
import type {Log} from '@toreda/log';
import type {Time} from '@toreda/time';
import {timeMake} from '@toreda/time';

/**
 * Wraps generic cache items and stores meta data about the item.
 *
 * @category Cache
 */
export class CacheItem<ItemT> {
	public data: ItemT;
	public readonly created: Time;
	public readonly updated: Time;
	public readonly ttl: Time;
	/** Optional log passed to all Time instances this item creates. Time errors log to the raw
	 *  console when no log is provided. */
	private readonly log?: Log;

	constructor(data: ItemT, ttl?: number, log?: Log) {
		this.data = data;
		this.log = log;

		this.created = timeMake('s', 0, log).setNow();
		this.updated = timeMake('s', 0, log);
		this.ttl = timeMake('s', CacheItem.sanitizeTtl(ttl), log);
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
	 * Check whether this item is expired.
	 * @returns
	 */
	public expired(): boolean {
		const ttl = this.ttl();

		// Based on DNS conventions, items with 0 TTL don't expire until forcefully cleared.
		if (ttl === 0) {
			return false;
		}

		const now = timeMake('s', 0, this.log).setNow();
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
}
