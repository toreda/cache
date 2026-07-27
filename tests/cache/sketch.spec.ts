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

import {CountMinSketch} from '../../src/cache/sketch';

describe('CountMinSketch', () => {
	it(`should size width to the smallest power of two >= 4x capacity, min 16`, () => {
		expect(new CountMinSketch(1, 0).width).toBe(16);
		expect(new CountMinSketch(4, 0).width).toBe(16);
		expect(new CountMinSketch(5, 0).width).toBe(32);
		expect(new CountMinSketch(100, 0).width).toBe(512);
	});

	it(`should estimate 0 for an unseen id`, () => {
		const sketch = new CountMinSketch(50, 0);
		expect(sketch.estimate('never')).toBe(0);
	});

	it(`should never under-estimate the true count`, () => {
		const sketch = new CountMinSketch(50, 100000);
		for (let i = 0; i < 7; i++) {
			sketch.increment('hot');
		}
		expect(sketch.estimate('hot')).toBeGreaterThanOrEqual(7);
	});

	it(`should rank a frequent id above a rare one`, () => {
		const sketch = new CountMinSketch(50, 100000);
		for (let i = 0; i < 10; i++) {
			sketch.increment('hot');
		}
		sketch.increment('cold');
		expect(sketch.estimate('hot')).toBeGreaterThan(sketch.estimate('cold'));
	});

	it(`should cap counters at 15`, () => {
		const sketch = new CountMinSketch(50, 100000);
		for (let i = 0; i < 50; i++) {
			sketch.increment('spam');
		}
		expect(sketch.estimate('spam')).toBe(15);
	});

	it(`should halve counters when the reset threshold is reached`, () => {
		// threshold 8 -> after 8 increments of 'x', counters halve from 8 to 4.
		const sketch = new CountMinSketch(50, 8);
		for (let i = 0; i < 8; i++) {
			sketch.increment('x');
		}
		expect(sketch.estimate('x')).toBe(4);
	});

	it(`should be deterministic across instances`, () => {
		const a = new CountMinSketch(50, 100000);
		const b = new CountMinSketch(50, 100000);
		for (let i = 0; i < 5; i++) {
			a.increment('id');
			b.increment('id');
		}
		expect(a.estimate('id')).toBe(b.estimate('id'));
	});
});
