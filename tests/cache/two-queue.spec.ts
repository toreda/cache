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
import {TwoQueueCache} from '../../src/cache/two-queue';

interface SampleT extends Cacheable {
	id: string;
}

describe('TwoQueueCache', () => {
	it(`should enable segments (insertion probation) and ghosts`, () => {
		const cache = new TwoQueueCache<SampleT>();
		expect(cache.cfg.segments.enabled).toBe(true);
		expect(cache.cfg.segments.probationBasis).toBe('insertion');
		expect(cache.cfg.ghosts.enabled).toBe(true);
	});

	it(`should churn one-hit-wonders out of probation without touching the main region`, () => {
		const cache = new TwoQueueCache<SampleT>({cfg: {capacityMax: 4, ttl: 0}});
		// Establish a protected working set.
		cache.add({id: 'a'});
		cache.add({id: 'b'});
		cache.get('a'); // a -> protected
		cache.get('b'); // b -> protected

		// A run of one-hit-wonder ids passes through probation.
		cache.add({id: 'x'});
		cache.add({id: 'y'});
		cache.add({id: 'z'});

		expect(cache.has('a')).toBe(true);
		expect(cache.has('b')).toBe(true);
	});

	it(`should admit a recently-evicted id straight into the main region on re-add`, () => {
		const cache = new TwoQueueCache<SampleT>({cfg: {capacityMax: 6, ttl: 0}});
		for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) {
			cache.add({id});
		}
		// One more add evicts the oldest probation id ('a') into the ghost list.
		cache.add({id: 'g'});
		expect(cache.has('a')).toBe(false);

		// Re-adding 'a' should place it in the protected region (ghost hit), not probation.
		cache.add({id: 'a'});
		const item = (cache as unknown as {items: Map<string, {policyData?: {segment?: string}}>}).items.get(
			'a'
		);
		expect(item?.policyData?.segment).toBe('protected');
	});
});
