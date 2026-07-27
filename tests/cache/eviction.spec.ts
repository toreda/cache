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

import {Cache} from '../../src/cache';
import type {Cacheable} from '../../src/cacheable';
import type {CfgPartial} from '../../src/cfg/partial';

interface SampleT extends Cacheable {
	id: string;
}

function build(evict: NonNullable<CfgPartial['evict']>, rng?: () => number): Cache<SampleT> {
	return new Cache<SampleT>({cfg: {capacityMax: 4, ttl: 0, evict: evict}, rng: rng});
}

/** Which of the 4 seeded ids remain after adding one more, given a scripted access pattern. */
function remaining(cache: Cache<SampleT>): string[] {
	return Array.from(cache.keys()).sort();
}

describe('eviction bases', () => {
	describe('insertion / oldest (FIFO)', () => {
		it(`should evict the oldest inserted item`, () => {
			const cache = build({basis: 'insertion', order: 'oldest'});
			['a', 'b', 'c', 'd'].forEach((id) => cache.add({id}));
			cache.add({id: 'e'});
			expect(remaining(cache)).toStrictEqual(['b', 'c', 'd', 'e']);
		});
	});

	describe('insertion / newest (LIFO)', () => {
		it(`should evict the newest inserted item`, () => {
			const cache = build({basis: 'insertion', order: 'newest'});
			['a', 'b', 'c', 'd'].forEach((id) => cache.add({id}));
			cache.add({id: 'e'});
			expect(remaining(cache)).toStrictEqual(['a', 'b', 'c', 'e']);
		});
	});

	describe('access / oldest (LRU)', () => {
		it(`should evict the least-recently-accessed item`, () => {
			const cache = build({basis: 'access', order: 'oldest'});
			['a', 'b', 'c', 'd'].forEach((id) => cache.add({id}));
			// Access a, c, d (b becomes the least-recently used).
			cache.get('a');
			cache.get('c');
			cache.get('d');
			cache.add({id: 'e'});
			expect(remaining(cache)).toStrictEqual(['a', 'c', 'd', 'e']);
		});
	});

	describe('access / newest (MRU)', () => {
		it(`should evict the most-recently-accessed item`, () => {
			const cache = build({basis: 'access', order: 'newest'});
			['a', 'b', 'c', 'd'].forEach((id) => cache.add({id}));
			// d was inserted most recently; access b to make it the MRU.
			cache.get('b');
			cache.add({id: 'e'});
			expect(remaining(cache)).toStrictEqual(['a', 'c', 'd', 'e']);
		});
	});

	describe('frequency / oldest (LFU)', () => {
		it(`should evict the least-frequently-accessed item`, () => {
			const cache = build({basis: 'frequency', order: 'oldest', tieBreak: 'access'});
			['a', 'b', 'c', 'd'].forEach((id) => cache.add({id}));
			// a:3, b:2, c:1, d:0 accesses -> d evicted first.
			cache.get('a');
			cache.get('a');
			cache.get('a');
			cache.get('b');
			cache.get('b');
			cache.get('c');
			cache.add({id: 'e'});
			expect(remaining(cache)).toStrictEqual(['a', 'b', 'c', 'e']);
		});

		it(`should break frequency ties by least-recent access`, () => {
			const cache = build({basis: 'frequency', order: 'oldest', tieBreak: 'access'});
			['a', 'b', 'c', 'd'].forEach((id) => cache.add({id}));
			// All accessed once, but a was accessed first (oldest lastAccessSeq) -> a evicted.
			cache.get('a');
			cache.get('b');
			cache.get('c');
			cache.get('d');
			cache.add({id: 'e'});
			expect(remaining(cache)).toStrictEqual(['b', 'c', 'd', 'e']);
		});
	});

	describe('random', () => {
		it(`should evict the nth key selected by the injected rng`, () => {
			// rng 0.5 * size(4) = 2 -> the 3rd key ('c').
			const cache = build({basis: 'random', order: 'oldest'}, () => 0.5);
			['a', 'b', 'c', 'd'].forEach((id) => cache.add({id}));
			cache.add({id: 'e'});
			expect(remaining(cache)).toStrictEqual(['a', 'b', 'd', 'e']);
		});

		it(`should evict the first key when rng returns 0`, () => {
			const cache = build({basis: 'random', order: 'oldest'}, () => 0);
			['a', 'b', 'c', 'd'].forEach((id) => cache.add({id}));
			cache.add({id: 'e'});
			expect(remaining(cache)).toStrictEqual(['b', 'c', 'd', 'e']);
		});
	});

	describe('none', () => {
		it(`should reject the add instead of evicting`, () => {
			const cache = build({basis: 'none'});
			['a', 'b', 'c', 'd'].forEach((id) => cache.add({id}));
			expect(cache.add({id: 'e'})).toBe(false);
			expect(remaining(cache)).toStrictEqual(['a', 'b', 'c', 'd']);
		});
	});
});
