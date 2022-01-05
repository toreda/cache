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

import {CacheItem} from '../../src/cache/item';
import type {Cacheable} from '../../src/cacheable';
import {Defaults} from '../../src/defaults';
import {timeNow} from '@toreda/time';

interface SampleT extends Cacheable {
	id: string;
}

const MOCK_ID = 'aaa-1907414';

describe('CacheItem<T>', () => {
	let instance: CacheItem<SampleT>;

	beforeAll(() => {
		instance = new CacheItem<SampleT>({
			id: 'aaaa'
		});
	});

	beforeEach(() => {
		instance.created.setNow();
		instance.updated(0);
		instance.ttl(Defaults.CacheItem.TTL);
	});

	describe('Ctor', () => {
		let sampleTtl: number;
		let sampleItem: SampleT;
		let ctorInstance: CacheItem<SampleT>;

		beforeAll(() => {
			sampleItem = {
				id: 'aaa-1947194714971_781641'
			};

			sampleTtl = 1917;
			ctorInstance = new CacheItem<SampleT>(sampleItem, sampleTtl);
		});

		it(`should initialize data from data arg`, () => {
			const data: SampleT = {
				id: 'U-1-971497141947'
			};
			const custom = new CacheItem<SampleT>(data);
			expect(custom.data).toStrictEqual(data);
		});

		it(`should initialize 'updated' timestamp with value 0`, () => {
			expect(ctorInstance.updated()).toBe(0);
		});

		it(`should initialize ttl property using ttl arg when provided`, () => {
			expect(ctorInstance.ttl()).toBe(sampleTtl);
		});

		it(`should initialize data property using data arg`, () => {
			expect(ctorInstance.data).toStrictEqual(sampleItem);
		});

		it(`should use Default Cache Item TTL value when ttl arg is undefined`, () => {
			const custom = new CacheItem<SampleT>(sampleItem, undefined);
			expect(custom.ttl()).toBe(Defaults.CacheItem.TTL);
		});

		it(`should use Default Cache Item TTL value when ttl arg is null`, () => {
			const custom = new CacheItem<SampleT>(sampleItem, null as any);
			expect(custom.ttl()).toBe(Defaults.CacheItem.TTL);
		});

		it(`should use Default Cache Item TTL value when ttl arg is a truthy non-number`, () => {
			const custom = new CacheItem<SampleT>(sampleItem, 'aaaaaa' as any);
			expect(custom.ttl()).toBe(Defaults.CacheItem.TTL);
		});

		it(`should initialize ttl property using ttl arg when ttl value is 0`, () => {
			const custom = new CacheItem<SampleT>(sampleItem, 0);
			expect(custom.ttl()).toBe(0);
		});

		it(`should not create expired item when TTL is not provided`, () => {
			const custom = new CacheItem<SampleT>(sampleItem);
			expect(custom.expired()).toBe(false);
		});

		it(`should not create expired item when TTL is provided`, () => {
			const ttl = 310;
			const custom = new CacheItem<SampleT>(sampleItem, ttl);
			expect(custom.expired()).toBe(false);
		});
	});

	describe('Impl', () => {
		describe('update', () => {
			it(`should set 'updated' timestamp to current now`, () => {
				instance.updated(0);
				instance.update();
				const now = timeNow();
				expect(instance.updated()).toBeCloseTo(now(), 1);
			});
		});

		describe('expired', () => {
			it(`should return false when ttl is 0`, () => {
				instance.ttl(0);
				expect(instance.expired()).toBe(false);
			});

			it(`should return true when time since creation exceeds TTL`, () => {
				instance.ttl(10);
				instance.created.subSeconds(3000);
				expect(instance.expired()).toBe(true);
			});

			it(`should return false when time since creation is in the past but TTL is 0`, () => {
				instance.ttl(0);
				instance.updated(0);
				instance.created.subDays(300);
				expect(instance.expired()).toBe(false);
			});

			it(`should return false when updated time is used but in the past and TTL is 0`, () => {
				instance.ttl(0);
				instance.updated.setNow();
				instance.updated.subDays(100);
				expect(instance.expired()).toBe(false);
			});

			it(`should return false when time elapsed since last update exceeds TTL`, () => {
				instance.ttl(10);
				instance.updated.setNow();
				instance.updated.subDays(100);
				expect(instance.expired()).toBe(true);
			});
		});
	});
});
