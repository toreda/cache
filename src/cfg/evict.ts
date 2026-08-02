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

/**
 * Which metadata axis chooses the eviction target when the cache is full.
 *
 * @category Cache Config
 */
export type CfgEvictBasis = 'insertion' | 'access' | 'frequency' | 'random' | 'none';

/**
 * Direction along the eviction basis.
 *
 * @category Cache Config
 */
export type CfgEvictOrder = 'oldest' | 'newest';

/**
 * Tie-break rule used when the eviction basis produces a tie.
 *
 * @category Cache Config
 */
export type CfgEvictTieBreak = 'insertion' | 'access';

/**
 * Eviction ordering config — answers "who leaves when the cache is full?".
 *
 * @category Cache Config
 */
export interface CfgEvict {
	/** Which metadata axis chooses the eviction target. `none` disables eviction. Default `insertion`. */
	basis: CfgEvictBasis;
	/** Direction along the basis. Default `oldest` (least/most for frequency). */
	order: CfgEvictOrder;
	/** When `true`, accessed items are skipped once before eviction (CLOCK). Default `false`. */
	secondChance: boolean;
	/** Tie-break for frequency ties. Default `access`. */
	tieBreak: CfgEvictTieBreak;
}
