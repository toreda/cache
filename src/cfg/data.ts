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

import type {CfgAdmission} from './admission';
import type {CfgEvict} from './evict';
import type {CfgGetOp, CfgHasOp, CfgTouchOp} from './ops';
import type {CfgGhosts} from './ghosts';
import type {CfgPrune} from './prune';
import type {CfgSegments} from './segments';

export type {CfgAdmission, CfgAdmissionPolicy} from './admission';
export type {CfgEvict, CfgEvictBasis, CfgEvictOrder, CfgEvictTieBreak} from './evict';
export type {CfgGetOp, CfgHasOp, CfgTouchOp} from './ops';
export type {CfgGhosts} from './ghosts';
export type {CfgPrune} from './prune';
export type {CfgSegments} from './segments';

/**
 * Fully-resolved cache configuration. Data-only and serializable — a cache "type" is just a
 * complete assignment of these flags. Constructed by `cfgResolve` from a `CfgPartial`; every
 * field is present with a concrete value once resolved.
 *
 * @category Cache Config
 */
export interface CfgData {
	// ── Capacity ──────────────────────────────────────────────
	/** Maximum number of items. `0` = unbounded. */
	capacityMax: number;
	/** Initial size hint for an empty cache. */
	initialSize: number;

	// ── Expiration ────────────────────────────────────────────
	/** Default TTL (seconds) for items added without an explicit ttl. `0` = never expire. */
	ttl: number;

	// ── Per-operation settings ────────────────────────────────
	get: CfgGetOp;
	has: CfgHasOp;
	touch: CfgTouchOp;

	// ── Prune ─────────────────────────────────────────────────
	prune: CfgPrune;

	// ── Eviction ──────────────────────────────────────────────
	evict: CfgEvict;

	// ── Segmentation ──────────────────────────────────────────
	segments: CfgSegments;

	// ── Ghost registry (ids only, no item data) ───────────────
	ghosts: CfgGhosts;

	// ── Adaptivity ────────────────────────────────────────────
	/** When `true`, ghost hits shift the probation/protected target (ARC's p). */
	adaptive: boolean;

	// ── Admission ─────────────────────────────────────────────
	admission: CfgAdmission;
}
