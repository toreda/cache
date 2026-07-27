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
import {SlruCache} from '../../src/cache/slru';

interface SampleT extends Cacheable {
	id: string;
}

describe('SlruCache', () => {
	it(`should enable segments with probationBasis access`, () => {
		const cache = new SlruCache<SampleT>();
		expect(cache.cfg.segments.enabled).toBe(true);
		expect(cache.cfg.segments.probationBasis).toBe('access');
	});

	it(`should keep protected + probation ratios within capacity`, () => {
		const cache = new SlruCache<SampleT>({cfg: {segments: {protectedRatio: 0.8}}});
		expect(cache.cfg.segments.protectedRatio + cache.cfg.segments.probationRatio).toBeLessThanOrEqual(1);
	});

	it(`should resist a one-time scan (protected working set survives)`, () => {
		const cache = new SlruCache<SampleT>({
			cfg: {capacityMax: 4, ttl: 0, segments: {protectedRatio: 0.75}}
		});
		// Build a protected working set.
		cache.add({id: 'a'});
		cache.add({id: 'b'});
		cache.add({id: 'c'});
		cache.get('a'); // promote to protected
		cache.get('b');
		cache.get('c');

		// One-time scan of new ids: each churns through probation without touching protected.
		cache.add({id: 's1'});
		cache.add({id: 's2'});
		cache.add({id: 's3'});
		cache.add({id: 's4'});

		expect(cache.has('a')).toBe(true);
		expect(cache.has('b')).toBe(true);
		expect(cache.has('c')).toBe(true);
	});

	it(`should demote a protected member when the protected region overflows`, () => {
		// capacityMax 4, protectedRatio 0.75 -> protected budget 3.
		const cache = new SlruCache<SampleT>({
			cfg: {capacityMax: 4, ttl: 0, segments: {protectedRatio: 0.75}}
		});
		cache.add({id: 'a'});
		cache.add({id: 'b'});
		cache.add({id: 'c'});
		cache.add({id: 'd'});
		// Promote 4 items; only 3 fit in protected -> the least-recently-used protected demotes.
		cache.get('a');
		cache.get('b');
		cache.get('c');
		cache.get('d');

		const segments = (cache as unknown as {segments: {protectedCount: number}}).segments;
		expect(segments.protectedCount).toBeLessThanOrEqual(3);
	});

	it(`should keep segment counts correct across removals`, () => {
		const cache = new SlruCache<SampleT>({cfg: {capacityMax: 6, ttl: 0}});
		cache.add({id: 'a'});
		cache.add({id: 'b'});
		cache.get('a'); // a -> protected
		const segments = (cache as unknown as {segments: {protectedCount: number; probationCount: number}})
			.segments;
		expect(segments.protectedCount).toBe(1);
		expect(segments.probationCount).toBe(1);

		cache.delete('a');
		expect(segments.protectedCount).toBe(0);
		cache.delete('b');
		expect(segments.probationCount).toBe(0);
	});
});
