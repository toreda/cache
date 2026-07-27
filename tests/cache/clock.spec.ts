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
import {ClockCache} from '../../src/cache/clock';

interface SampleT extends Cacheable {
	id: string;
}

describe('ClockCache', () => {
	it(`should pin insertion/oldest with secondChance`, () => {
		const cache = new ClockCache<SampleT>();
		expect(cache.cfg.evict.basis).toBe('insertion');
		expect(cache.cfg.evict.secondChance).toBe(true);
	});

	it(`should spare a referenced item for one eviction round`, () => {
		const cache = new ClockCache<SampleT>({cfg: {capacityMax: 3, ttl: 0}});
		cache.add({id: 'a'});
		cache.add({id: 'b'});
		cache.add({id: 'c'});
		// Reference 'a' so it survives the first sweep; 'b' (unreferenced, next in order) leaves.
		cache.get('a');
		cache.add({id: 'd'});
		expect(cache.has('a')).toBe(true);
		expect(cache.has('b')).toBe(false);
	});

	it(`should evict unaccessed items first`, () => {
		const cache = new ClockCache<SampleT>({cfg: {capacityMax: 3, ttl: 0}});
		cache.add({id: 'a'});
		cache.add({id: 'b'});
		cache.add({id: 'c'});
		// Nothing accessed -> oldest 'a' evicted.
		cache.add({id: 'd'});
		expect(cache.has('a')).toBe(false);
	});

	it(`should advance the hand rather than restarting the sweep at key 0`, () => {
		const cache = new ClockCache<SampleT>({cfg: {capacityMax: 3, ttl: 0}});
		cache.add({id: 'a'});
		cache.add({id: 'b'});
		cache.add({id: 'c'});
		// First add evicts 'a' (oldest, unreferenced); hand now past 'a'.
		cache.add({id: 'd'}); // evicts a -> {b, c, d}
		// Second add should evict 'b' (next), not loop back and re-target from the start oddly.
		cache.add({id: 'e'}); // evicts b -> {c, d, e}
		expect(cache.has('a')).toBe(false);
		expect(cache.has('b')).toBe(false);
		expect(Array.from(cache.keys()).sort()).toStrictEqual(['c', 'd', 'e']);
	});
});
