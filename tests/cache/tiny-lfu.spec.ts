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
import {TinyLfuCache} from '../../src/cache/tiny-lfu';

interface SampleT extends Cacheable {
	id: string;
}

describe('TinyLfuCache', () => {
	it(`should enable segments and frequency admission`, () => {
		const cache = new TinyLfuCache<SampleT>({cfg: {capacityMax: 100}});
		expect(cache.cfg.segments.enabled).toBe(true);
		expect(cache.cfg.admission.policy).toBe('frequency');
	});

	it(`should reject a low-frequency newcomer over an established hot set`, () => {
		const onAddReject = jest.fn();
		const cache = new TinyLfuCache<SampleT>({cfg: {capacityMax: 3, ttl: 0}, events: {onAddReject}});
		// Build hot items and hammer their frequency via repeated gets.
		cache.add({id: 'h1'});
		cache.add({id: 'h2'});
		cache.add({id: 'h3'});
		for (let i = 0; i < 10; i++) {
			cache.get('h1');
			cache.get('h2');
			cache.get('h3');
		}

		// A brand-new cold id with no frequency history should lose admission.
		const admitted = cache.add({id: 'cold'});
		expect(admitted).toBe(false);
		expect(onAddReject).toHaveBeenCalledWith({id: 'cold'}, 'admission');
		expect(cache.has('cold')).toBe(false);
		expect(cache.has('h1')).toBe(true);
	});

	it(`should admit a high-frequency newcomer over a low-frequency eviction target`, () => {
		const cache = new TinyLfuCache<SampleT>({cfg: {capacityMax: 3, ttl: 0}});
		cache.add({id: 'a'});
		cache.add({id: 'b'});
		cache.add({id: 'c'});
		// Warm 'hot' via repeated misses (misses feed the sketch) so it out-ranks the eviction target.
		for (let i = 0; i < 12; i++) {
			cache.get('hot');
		}
		expect(cache.add({id: 'hot'})).toBe(true);
		expect(cache.has('hot')).toBe(true);
	});
});
