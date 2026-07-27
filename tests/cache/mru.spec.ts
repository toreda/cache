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

import type {Cacheable} from '../../src/cacheable';
import {MruCache} from '../../src/cache/mru';

interface SampleT extends Cacheable {
	id: string;
}

describe('MruCache', () => {
	it(`should pin evict basis to access/newest`, () => {
		const cache = new MruCache<SampleT>();
		expect(cache.cfg.evict.basis).toBe('access');
		expect(cache.cfg.evict.order).toBe('newest');
	});

	it(`should evict the most-recently-used item`, () => {
		const cache = new MruCache<SampleT>({cfg: {capacityMax: 3, ttl: 0}});
		cache.add({id: 'a'});
		cache.add({id: 'b'});
		cache.add({id: 'c'});
		cache.get('a'); // a becomes most-recently-used
		cache.add({id: 'd'});
		expect(cache.has('a')).toBe(false);
		expect(Array.from(cache.keys()).sort()).toStrictEqual(['b', 'c', 'd']);
	});

	it(`should compose with TTL`, () => {
		const cache = new MruCache<SampleT>({cfg: {capacityMax: 3, ttl: 5}});
		cache.add({id: 'a'}, {ttl: 1});
		const items = (cache as unknown as {items: Map<string, {created: {subDays: (n: number) => void}}>})
			.items;
		items.get('a')!.created.subDays(1);
		expect(cache.get('a')).toBeNull();
	});
});
