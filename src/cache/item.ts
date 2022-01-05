/**
 *	MIT License
 *
 *	Copyright (c) 2019 - 2022 Toreda, Inc.
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

import {timeMake, timeNow} from '@toreda/time';

import {Defaults} from '../defaults';
import type {Time} from '@toreda/time';
import {numberValue} from '@toreda/strong-types';

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

	constructor(data: ItemT, ttl?: number) {
		this.data = data;

		this.created = timeNow();
		this.updated = timeMake('s', 0);
		this.ttl = timeMake('s', numberValue(ttl, Defaults.CacheItem.TTL));
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

		const now = timeNow();
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
