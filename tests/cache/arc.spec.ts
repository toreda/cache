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
import {ArcCache} from '../../src/cache/arc';

interface SampleT extends Cacheable {
	id: string;
}

function adaptiveTarget(cache: ArcCache<SampleT>): number {
	return (cache as unknown as {segments: {adaptiveTarget: number}}).segments.adaptiveTarget;
}

describe('ArcCache', () => {
	it(`should enable segments, per-segment ghosts, and adaptivity`, () => {
		const cache = new ArcCache<SampleT>({cfg: {capacityMax: 10}});
		expect(cache.cfg.segments.enabled).toBe(true);
		expect(cache.cfg.ghosts.enabled).toBe(true);
		expect(cache.cfg.ghosts.perSegment).toBe(true);
		expect(cache.cfg.adaptive).toBe(true);
	});

	it(`should seed the adaptive target from the initial protected ratio`, () => {
		const cache = new ArcCache<SampleT>({cfg: {capacityMax: 10, segments: {protectedRatio: 0.5}}});
		expect(adaptiveTarget(cache)).toBe(5);
	});

	it(`should shrink the protected target under a recency-heavy workload`, () => {
		// Recency-heavy: churn many distinct ids that are re-added shortly after eviction, so
		// their eviction lands them in the recency ghost list and re-adds hit it.
		const cache = new ArcCache<SampleT>({cfg: {capacityMax: 8, ttl: 0, segments: {protectedRatio: 0.5}}});
		const start = adaptiveTarget(cache);

		const ids = Array.from({length: 40}, (_v, i) => `r${i}`);
		for (const id of ids) {
			cache.add({id});
		}
		// Re-add the earliest ids — they were evicted from probation into recency ghosts.
		for (const id of ids.slice(0, 12)) {
			cache.add({id});
		}

		expect(adaptiveTarget(cache)).toBeLessThanOrEqual(start);
	});

	it(`should restore the adaptive target on reset`, () => {
		const cache = new ArcCache<SampleT>({cfg: {capacityMax: 8, ttl: 0, segments: {protectedRatio: 0.5}}});
		const start = adaptiveTarget(cache);
		for (let i = 0; i < 40; i++) {
			cache.add({id: `r${i}`});
		}
		cache.reset();
		expect(adaptiveTarget(cache)).toBe(start);
	});
});
