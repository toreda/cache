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

/**
 * Caller-facing cache config: every top-level field optional AND every group's fields optional.
 * This is the type of `CacheInit.cfg`. Written explicitly (not a generic DeepPartial) so each
 * group's shape stays visible and pinnable by wrapper types.
 *
 * @category Cache Config
 */
export interface CfgPartial {
	capacityMax?: number;
	initialSize?: number;
	ttl?: number;
	get?: Partial<CfgGetOp>;
	has?: Partial<CfgHasOp>;
	touch?: Partial<CfgTouchOp>;
	prune?: Partial<CfgPrune>;
	evict?: Partial<CfgEvict>;
	segments?: Partial<CfgSegments>;
	ghosts?: Partial<CfgGhosts>;
	adaptive?: boolean;
	admission?: Partial<CfgAdmission>;
}
