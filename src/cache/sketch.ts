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

import type {CacheItemId} from './item/id';

/** Number of independent rows (hash functions) in the sketch. */
const ROWS = 4;
/** Maximum value a counter can hold (4-bit saturation). */
const MAX_COUNT = 15;
/** Per-row FNV-1a offset seeds. One fixed constant per row keeps `increment` deterministic. */
const ROW_SEEDS: readonly number[] = [0x811c9dc5, 0x01000193, 0x85ebca6b, 0xc2b2ae35];
/** FNV-1a 32-bit prime. */
const FNV_PRIME = 0x01000193;

/**
 * Count-Min Sketch over item-id strings for frequency-based admission (TinyLFU). Four rows of
 * `Uint8Array` counters saturating at 15; `estimate` returns the row minimum. Counters halve
 * once the total increment count reaches `resetThreshold`, giving the sketch a decaying memory
 * of frequency. Fully deterministic — no `Math.random`.
 *
 * @category Cache
 */
export class CountMinSketch {
	/** Number of counter columns per row — a power of two so hashing masks cheaply. */
	public readonly width: number;
	private readonly mask: number;
	private readonly rows: Uint8Array[];
	private readonly resetThreshold: number;
	private total: number;

	constructor(capacityMax: number, resetThreshold: number) {
		this.width = CountMinSketch.widthFor(capacityMax);
		this.mask = this.width - 1;
		this.resetThreshold = resetThreshold > 0 ? resetThreshold : 10 * Math.max(1, capacityMax);
		this.total = 0;

		this.rows = [];
		for (let r = 0; r < ROWS; r++) {
			this.rows.push(new Uint8Array(this.width));
		}
	}

	/** Smallest power of two ≥ `4 * capacityMax`, minimum 16. */
	private static widthFor(capacityMax: number): number {
		const target = Math.max(16, 4 * Math.max(1, capacityMax));
		let width = 16;
		while (width < target) {
			width *= 2;
		}

		return width;
	}

	/** FNV-1a 32-bit hash of `id` seeded per row, masked to the sketch width. */
	private slot(id: CacheItemId, row: number): number {
		let hash = ROW_SEEDS[row] >>> 0;
		for (let i = 0; i < id.length; i++) {
			hash ^= id.charCodeAt(i) & 0xff;
			hash = Math.imul(hash, FNV_PRIME) >>> 0;
		}

		return hash & this.mask;
	}

	/**
	 * Bump every row counter for `id` (rows already saturated at 15 are skipped) and the total-ops
	 * counter. When the total reaches the reset threshold, halve all counters and the total.
	 */
	public increment(id: CacheItemId): void {
		for (let r = 0; r < ROWS; r++) {
			const idx = this.slot(id, r);
			if (this.rows[r][idx] < MAX_COUNT) {
				this.rows[r][idx]++;
			}
		}

		this.total++;
		if (this.total >= this.resetThreshold) {
			this.halve();
		}
	}

	/** Estimated frequency of `id` — the minimum across all rows. */
	public estimate(id: CacheItemId): number {
		let min = MAX_COUNT;
		for (let r = 0; r < ROWS; r++) {
			const value = this.rows[r][this.slot(id, r)];
			if (value < min) {
				min = value;
			}
		}

		return min;
	}

	/** Reset every counter and the total to 0. */
	public reset(): void {
		for (let r = 0; r < ROWS; r++) {
			this.rows[r].fill(0);
		}

		this.total = 0;
	}

	/** Integer-halve every counter and the total (frequency decay). */
	private halve(): void {
		for (let r = 0; r < ROWS; r++) {
			const row = this.rows[r];
			for (let i = 0; i < row.length; i++) {
				row[i] = row[i] >> 1;
			}
		}

		this.total = this.total >> 1;
	}
}
