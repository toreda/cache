/**
 *	MIT License
 *
 *	Copyright (c) 2019 - 2022 Toreda, Inc.
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

import type {CacheIdFn} from './cache/id/fn';
import type {CacheItemId} from './cache/item/id';

/**
 * Cacheable objects implement all API properties & functions needed to
 * be cached.
 *
 * @category Object API
 */
export interface Cacheable {
	/**
	 * 	Allow property checks & probing using index or hasOwnProperty, otherwise properties not explicitly
	 * 	defined cannot be used, even to check if they exist.
	 */
	[k: string]: unknown;
	/**
	 * Globally unique ID. Strings must be be a valid id. ID functions such as Strong Types like
	 * `Id` & Text` or other helpers must return a globally unique identifier.
	 */
	id: CacheItemId | CacheIdFn<CacheItemId>;
}
