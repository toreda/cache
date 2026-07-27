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
 * Per-operation settings for `get` — controls whether a get counts as an access and whether
 * it slides the expiration window.
 *
 * @category Cache Config
 */
export interface CfgGetOp {
	/** When `true`, a `get` counts as an access for eviction accounting. Default `true`. */
	countsAsAccess: boolean;
	/** When `true`, a `get` refreshes the item's expiration window. Default `false`. */
	slidesExpiration: boolean;
}

/**
 * Per-operation settings for `has`.
 *
 * @category Cache Config
 */
export interface CfgHasOp {
	/** When `true`, a `has` counts as an access for eviction accounting. Default `false`. */
	countsAsAccess: boolean;
	/** When `true`, a `has` refreshes the item's expiration window. Default `false`. */
	slidesExpiration: boolean;
}

/**
 * Per-operation settings for `touch`. `touch` always slides expiration (its purpose).
 *
 * @category Cache Config
 */
export interface CfgTouchOp {
	/** When `true`, a `touch` counts as an access for eviction accounting. Default `true`. */
	countsAsAccess: boolean;
}
