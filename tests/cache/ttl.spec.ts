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
import {TtlCache} from '../../src/cache/ttl';

interface SampleT extends Cacheable {
	id: string;
}

describe('TtlCache', () => {
	it(`should throw when ttl is not positive`, () => {
		expect(() => new TtlCache<SampleT>({cfg: {ttl: 0}})).toThrow(/ttl/);
		expect(() => new TtlCache<SampleT>({cfg: {ttl: -1}})).toThrow(/ttl/);
	});

	it(`should pin evict basis to none and prune.auto to true`, () => {
		const cache = new TtlCache<SampleT>({cfg: {ttl: 30}});
		expect(cache.cfg.evict.basis).toBe('none');
		expect(cache.cfg.prune.auto).toBe(true);
		cache.stopAutoPrune();
	});

	it(`should default capacityMax to 0 (unbounded)`, () => {
		const cache = new TtlCache<SampleT>({cfg: {ttl: 30}});
		expect(cache.cfg.capacityMax).toBe(0);
		cache.stopAutoPrune();
	});

	it(`should allow a caller-set capacityMax but never evict for capacity`, () => {
		const cache = new TtlCache<SampleT>({cfg: {ttl: 30, capacityMax: 2}});
		cache.add({id: 'a'});
		cache.add({id: 'b'});
		// basis none -> add is rejected rather than evicting.
		expect(cache.add({id: 'c'})).toBe(false);
		expect(cache.size).toBe(2);
		cache.stopAutoPrune();
	});

	describe('getRemainingTtl', () => {
		it(`should return null for an absent id`, () => {
			const cache = new TtlCache<SampleT>({cfg: {ttl: 30}});
			expect(cache.getRemainingTtl('missing')).toBeNull();
			cache.stopAutoPrune();
		});

		it(`should return remaining seconds for a live item`, () => {
			const cache = new TtlCache<SampleT>({cfg: {ttl: 30}});
			cache.add({id: 'a'}, {ttl: 100});
			const remaining = cache.getRemainingTtl('a');
			expect(remaining).not.toBeNull();
			expect(remaining!).toBeGreaterThan(90);
			expect(remaining!).toBeLessThanOrEqual(100);
			cache.stopAutoPrune();
		});

		it(`should return 0 for an item that never expires`, () => {
			const cache = new TtlCache<SampleT>({cfg: {ttl: 30}});
			cache.add({id: 'a'}, {ttl: 0});
			expect(cache.getRemainingTtl('a')).toBe(0);
			cache.stopAutoPrune();
		});

		it(`should return null and remove an expired item`, () => {
			const cache = new TtlCache<SampleT>({cfg: {ttl: 30}});
			cache.add({id: 'a'}, {ttl: 1});
			const items = (
				cache as unknown as {items: Map<string, {created: {subDays: (n: number) => void}}>}
			).items;
			items.get('a')!.created.subDays(1);
			expect(cache.getRemainingTtl('a')).toBeNull();
			expect(cache.has('a')).toBe(false);
			cache.stopAutoPrune();
		});
	});
});
