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

interface SampleT extends Cacheable {
	id: string;
}

describe('auto-prune', () => {
	afterEach(() => {
		jest.useRealTimers();
	});

	it(`should schedule an interval timer when prune.auto is enabled`, () => {
		jest.useFakeTimers();
		const spy = jest.spyOn(global, 'setInterval');
		const cache = new Cache<SampleT>({cfg: {ttl: 5, prune: {auto: true, interval: 10, minDelay: 0}}});
		expect(spy).toHaveBeenCalled();
		cache.stopAutoPrune();
		spy.mockRestore();
	});

	it(`should not schedule a timer when prune.auto is disabled`, () => {
		jest.useFakeTimers();
		const spy = jest.spyOn(global, 'setInterval');
		new Cache<SampleT>({cfg: {ttl: 5}});
		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});

	it(`should prune expired items when the interval fires`, () => {
		jest.useFakeTimers();
		const cache = new Cache<SampleT>({cfg: {ttl: 5, prune: {auto: true, interval: 10, minDelay: 0}}});
		cache.add({id: 'a'});
		// Force expiry by rewinding the item's creation time.
		const items = (cache as unknown as {items: Map<string, {created: {subDays: (n: number) => void}}>})
			.items;
		items.get('a')!.created.subDays(1);

		jest.advanceTimersByTime(10_000);
		expect(cache.has('a')).toBe(false);
		cache.stopAutoPrune();
	});

	it(`should stop firing after stopAutoPrune`, () => {
		jest.useFakeTimers();
		const cache = new Cache<SampleT>({cfg: {ttl: 5, prune: {auto: true, interval: 10, minDelay: 0}}});
		const pruneSpy = jest.spyOn(cache, 'prune');
		cache.stopAutoPrune();
		jest.advanceTimersByTime(50_000);
		expect(pruneSpy).not.toHaveBeenCalled();
	});
});
