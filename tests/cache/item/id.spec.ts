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

import {idMake, textMake} from '@toreda/strong-types';

import type {CacheItemId} from '../../../src/cache/item/id';
import type {Cacheable} from '../../../src/cacheable';
import {cacheItemId} from '../../../src/cache/item/id';

describe('cacheItemId', () => {
	it(`should return null when item arg is undefined`, () => {
		expect(cacheItemId(undefined as any)).toBeNull();
	});

	it(`should return null when item arg is null`, () => {
		expect(cacheItemId(null as any)).toBeNull();
	});

	it(`should return null when item is an empty object`, () => {
		const item: Cacheable = {} as any;
		expect(cacheItemId(item)).toBeNull();
	});

	it(`should return id string property from item arg`, () => {
		const id = 'aa-1971947-967141947';
		const sampleItem = {id: id};

		expect(cacheItemId(sampleItem)).toBe(id);
	});

	it(`should return null when id property exists but is a non-string`, () => {
		const sampleItem = {id: 11111} as any;

		expect(cacheItemId(sampleItem)).toBeNull();
	});

	it(`should return id value when id is a Strong Text (@toreda/strong-types)`, () => {
		const id = '11-1080814-1047810481';
		const sampleItem = {id: textMake(id)};

		expect(cacheItemId(sampleItem)).toBe(id);
	});

	it(`should return id value when id is a Strong Id (@toreda/strong-types)`, () => {
		const id: CacheItemId = '12-09149714-97149714';
		const sampleItem = {id: idMake(id)};

		expect(cacheItemId(sampleItem)).toBe(id);
	});

	it(`should return null when id is a function but returns undefined`, () => {
		const sampleItem = {id: () => undefined} as any;

		expect(cacheItemId(sampleItem)).toBeNull();
	});

	it(`should return null when id is a function but returns null`, () => {
		const sampleItem = {id: () => null} as any;

		expect(cacheItemId(sampleItem)).toBeNull();
	});

	it(`should return null when id is a function but returns a truthy non-string`, () => {
		const sampleItem = {id: () => 111111 as any} as any;

		expect(cacheItemId(sampleItem)).toBeNull();
	});
});
