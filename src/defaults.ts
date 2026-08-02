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
 * Default values used when no value is provided. Grouped to mirror `CfgData`. Every default
 * reproduces pre-1.0 behavior: insertion-order eviction, no segments/ghosts/admission.
 *
 * @category Cache Config
 */
export class Defaults {
	public static CacheItem = {
		/** Time to Live (seconds). Time before before a cache item expires. */
		TTL: 30
	} as const;

	public static Cache = {
		/**
		 * Hard cap on concurrent cache elements. Used when `capacityMax` is not
		 * provided in cache config. `0` means unbounded.
		 */
		CapacityMax: 1000,
		/** Initial size of empty cache. */
		InitialSize: 0,
		/** Default TTL (seconds) for items added without an explicit ttl. `0` = never expire. */
		Ttl: 30,
		Get: {
			/** When `true`, a `get` call counts as an access for eviction accounting. */
			CountsAsAccess: true,
			/** When `true`, a `get` refreshes the item's expiration window. */
			SlidesExpiration: false
		},
		Has: {
			/** When `true`, a `has` call counts as an access for eviction accounting. */
			CountsAsAccess: false,
			/** When `true`, a `has` refreshes the item's expiration window. */
			SlidesExpiration: false
		},
		Touch: {
			/** When `true`, a `touch` call counts as an access for eviction accounting. */
			CountsAsAccess: true
		},
		Prune: {
			/** When `true`, an interval timer prunes expired items automatically. */
			Auto: false,
			/** Interval (seconds) between auto-prune runs. Defaults to `MinDelay`. */
			Interval: 10,
			/** Minimum number of seconds allowed between prune calls. */
			MinDelay: 10
		},
		Evict: {
			/** Which metadata axis chooses the eviction target at capacity. */
			Basis: 'insertion',
			/** Direction along the basis: `oldest` or `newest`. */
			Order: 'oldest',
			/** When `true`, accessed items get one skip before eviction (CLOCK). */
			SecondChance: false,
			/** Tie-break for frequency ties. */
			TieBreak: 'access'
		},
		Segments: {
			/** When `true`, cache is split into probation + protected regions. */
			Enabled: false,
			/** Protected region size as a fraction of `capacityMax`. */
			ProtectedRatio: 0.8,
			/** Probation budget as a fraction of `capacityMax` (2Q kin). */
			ProbationRatio: 0.25,
			/** Basis used to pick a probation eviction target. */
			ProbationBasis: 'access',
			/** When `true`, a probation-region hit promotes the item to protected. */
			PromoteOnHit: true
		},
		Ghosts: {
			/** When `true`, a bounded registry of recently-evicted ids is kept. */
			Enabled: false,
			/** Ghost registry size as a fraction of `capacityMax` (2Q kout). */
			SizeRatio: 0.5,
			/** When `true`, ghosts are split into recency/frequency lists (ARC B1/B2). */
			PerSegment: false
		},
		/** When `true`, ghost hits shift the probation/protected target (ARC's p). */
		Adaptive: false,
		Admission: {
			/** Admission policy: `always` admits, `frequency` compares via a sketch. */
			Policy: 'always',
			/** W-TinyLFU entry window size as a fraction of `capacityMax`. */
			WindowRatio: 0.01,
			/** Frequency sketch counter-halving threshold. `0` = derived from capacity. */
			SketchResetThreshold: 0
		}
	} as const;
}
