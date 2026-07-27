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
import type {CfgData} from '../cfg/data';
import type {PolicySegment} from './policy/data';

/** Which ghost list an id came from / lives in. */
export type GhostList = 'recency' | 'frequency';

/**
 * Bounded registry of recently-evicted item ids (ids only — no item data). Used by 2Q and ARC to
 * detect re-references. Instantiated by `Cache` only when `cfg.ghosts.enabled`. With `perSegment`
 * the registry splits into a recency list (evicted from probation, ARC B1) and a frequency list
 * (evicted from protected, ARC B2); otherwise a single list is used.
 *
 * @category Cache
 */
export class CacheGhosts {
	private readonly cfg: CfgData;
	private readonly capacity: () => number;
	/** Recency list (probation evictions). Insertion-ordered. */
	private readonly recency: Map<CacheItemId, true>;
	/** Frequency list (protected evictions). Insertion-ordered. Only used when `perSegment`. */
	private readonly frequency: Map<CacheItemId, true>;

	constructor(cfg: CfgData, capacity: () => number) {
		this.cfg = cfg;
		this.capacity = capacity;
		this.recency = new Map<CacheItemId, true>();
		this.frequency = new Map<CacheItemId, true>();
	}

	/** Number of ids currently in the recency list. */
	public get recencyCount(): number {
		return this.recency.size;
	}

	/** Number of ids currently in the frequency list. */
	public get frequencyCount(): number {
		return this.frequency.size;
	}

	/**
	 * Record the eviction of `id` from `segment`. In per-segment mode, protected evictions go to
	 * the frequency list and everything else to recency; otherwise all go to a single (recency)
	 * list. Oldest ids beyond the size budget are trimmed.
	 */
	public recordEviction(id: CacheItemId, segment?: PolicySegment): void {
		const list = this.listFor(segment);
		// Re-insert at the tail (freshest) — delete first so ordering reflects recency.
		list.delete(id);
		list.set(id, true);
		this.trim(list);
	}

	/**
	 * Check whether `id` is a ghost. On a hit the id is removed from its list and its list name is
	 * returned; otherwise `null`.
	 */
	public hit(id: CacheItemId): GhostList | null {
		if (this.recency.delete(id)) {
			return 'recency';
		}

		if (this.frequency.delete(id)) {
			return 'frequency';
		}

		return null;
	}

	/** Drop all ghost ids. */
	public reset(): void {
		this.recency.clear();
		this.frequency.clear();
	}

	/** The list a `segment`'s evictions belong in. */
	private listFor(segment?: PolicySegment): Map<CacheItemId, true> {
		if (this.cfg.ghosts.perSegment && segment === 'protected') {
			return this.frequency;
		}

		return this.recency;
	}

	/** Trim `list` to `floor(sizeRatio * capacityMax)`, evicting oldest ids first. */
	private trim(list: Map<CacheItemId, true>): void {
		const cap = this.capacity();
		if (cap <= 0) {
			return;
		}

		const budget = Math.max(1, Math.floor(this.cfg.ghosts.sizeRatio * cap));
		while (list.size > budget) {
			const oldest = list.keys().next();
			if (oldest.done) {
				break;
			}

			list.delete(oldest.value);
		}
	}
}
