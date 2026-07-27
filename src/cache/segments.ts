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

import type {CacheItem} from './item';
import type {CacheItemId} from './item/id';
import type {CfgData} from '../cfg/data';
import type {PolicyMeta} from './policy/data';

/**
 * Read-only view of the owning cache that the segmentation module needs. Kept minimal so the
 * module never reaches into private cache internals it should not.
 */
export interface SegmentsHost<ItemT> {
	/** Live map of cached items (insertion-ordered). Never mutated by the module. */
	readonly items: Map<CacheItemId, CacheItem<ItemT>>;
	/** Get or create the `PolicyMeta` slot on an item. */
	policyMeta(item: CacheItem<ItemT>): PolicyMeta;
	/** Current capacity cap (`0` = unbounded). */
	readonly capacityMax: number;
}

/**
 * Internal probation/protected segmentation accounting (SLRU, 2Q, ARC). Instantiated by `Cache`
 * only when `cfg.segments.enabled`. Tracks per-segment counts and item membership via
 * `PolicyMeta.segment`; runs off internal paths and never depends on user events.
 *
 * @category Cache
 */
export class CacheSegments<ItemT> {
	private readonly host: SegmentsHost<ItemT>;
	private readonly cfg: CfgData;
	/** Number of items currently tagged `protected`. */
	public protectedCount: number;
	/** Number of items currently tagged `probation`. */
	public probationCount: number;
	/**
	 * Optional adaptive protected budget (ARC's p). When set (phase 4), it overrides the static
	 * `floor(protectedRatio * capacityMax)` budget.
	 */
	public adaptiveTarget: number | null;

	constructor(host: SegmentsHost<ItemT>, cfg: CfgData) {
		this.host = host;
		this.cfg = cfg;
		this.protectedCount = 0;
		this.probationCount = 0;
		this.adaptiveTarget = null;
	}

	/** Resolved protected-region budget (item count). */
	public protectedBudget(): number {
		if (this.adaptiveTarget !== null) {
			return this.adaptiveTarget;
		}

		return Math.floor(this.cfg.segments.protectedRatio * this.host.capacityMax);
	}

	/** Resolved probation-region budget (item count) — 2Q A1in size. */
	public probationBudget(): number {
		return Math.floor(this.cfg.segments.probationRatio * this.host.capacityMax);
	}

	/**
	 * Tag a newly-added item. New items enter probation by default; ghost-hit promotion (phase 4)
	 * may pass `segment: 'protected'` directly.
	 */
	public onAdded(
		id: CacheItemId,
		item: CacheItem<ItemT>,
		segment: PolicyMeta['segment'] = 'probation'
	): void {
		const meta = this.host.policyMeta(item);
		meta.segment = segment;
		if (segment === 'protected') {
			this.protectedCount++;
		} else {
			this.probationCount++;
		}

		this.enforceProtectedBudget(id);
	}

	/**
	 * Handle a qualifying access. A probation hit promotes to protected when `promoteOnHit`; a
	 * protected-region overflow then demotes the lowest-priority protected member.
	 */
	public onAccessed(id: CacheItemId, item: CacheItem<ItemT>): void {
		const meta = this.host.policyMeta(item);
		if (meta.segment === 'probation' && this.cfg.segments.promoteOnHit) {
			meta.segment = 'protected';
			this.probationCount--;
			this.protectedCount++;
			this.enforceProtectedBudget(id);
		}
	}

	/** Decrement the segment count of a removed item. Called for every removal reason. */
	public onRemoved(_id: CacheItemId, item: CacheItem<ItemT>): void {
		const meta = item.policyData as PolicyMeta | undefined;
		if (!meta || !meta.segment) {
			return;
		}

		if (meta.segment === 'protected') {
			this.protectedCount = Math.max(0, this.protectedCount - 1);
		} else {
			this.probationCount = Math.max(0, this.probationCount - 1);
		}
	}

	/** Zero all counts. */
	public reset(): void {
		this.protectedCount = 0;
		this.probationCount = 0;
		this.adaptiveTarget = null;
	}

	/**
	 * When the protected count exceeds its budget, demote the protected member with the lowest
	 * `lastAccessSeq` back to probation. `exemptId` is never demoted (the item just promoted).
	 */
	private enforceProtectedBudget(exemptId: CacheItemId): void {
		const budget = this.protectedBudget();
		while (this.protectedCount > budget) {
			const victim = this.lowestProtected(exemptId);
			if (victim === null) {
				break;
			}

			const meta = this.host.policyMeta(victim.item);
			meta.segment = 'probation';
			this.protectedCount = Math.max(0, this.protectedCount - 1);
			this.probationCount++;
		}
	}

	/** Protected member with the lowest `lastAccessSeq`, excluding `exemptId`. */
	private lowestProtected(exemptId: CacheItemId): {id: CacheItemId; item: CacheItem<ItemT>} | null {
		let found: {id: CacheItemId; item: CacheItem<ItemT>} | null = null;
		let best = 0;

		for (const [id, item] of this.host.items) {
			if (id === exemptId) {
				continue;
			}

			const meta = item.policyData as PolicyMeta | undefined;
			if (meta?.segment !== 'protected') {
				continue;
			}

			if (found === null || item.lastAccessSeq < best) {
				found = {id: id, item: item};
				best = item.lastAccessSeq;
			}
		}

		return found;
	}
}
