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

import type {CfgEvictTieBreak} from './evict';

/**
 * Segmentation config — probation + protected regions (SLRU, 2Q, ARC).
 *
 * @category Cache Config
 */
export interface CfgSegments {
	/** When `true`, cache is split into probation + protected regions. Default `false`. */
	enabled: boolean;
	/** Protected region size as a fraction of `capacityMax`. Default `0.8`. */
	protectedRatio: number;
	/** Probation budget as a fraction of `capacityMax` (2Q kin). Default `0.25`. */
	probationRatio: number;
	/** Basis used to pick a probation eviction target. Default `access` (SLRU); `insertion` = 2Q A1in. */
	probationBasis: CfgEvictTieBreak;
	/** When `true`, a probation-region hit promotes the item to protected. Default `true`. */
	promoteOnHit: boolean;
}
