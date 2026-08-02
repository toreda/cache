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
 * Admission policy: `always` admits every valid item; `frequency` uses a frequency sketch to
 * decide whether a newcomer displaces the eviction target (W-TinyLFU).
 *
 * @category Cache Config
 */
export type CfgAdmissionPolicy = 'always' | 'frequency';

/**
 * Admission config — answers "does a new item get in at all?".
 *
 * @category Cache Config
 */
export interface CfgAdmission {
	/** Admission policy. Default `always`. */
	policy: CfgAdmissionPolicy;
	/** W-TinyLFU entry window size as a fraction of `capacityMax`. Default `0.01`. */
	windowRatio: number;
	/** Frequency sketch counter-halving threshold. Default `10 * capacityMax`. */
	sketchResetThreshold: number;
}
