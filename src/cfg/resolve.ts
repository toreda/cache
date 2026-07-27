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

import {booleanValue, numberValue} from '@toreda/strong-types';

import type {CfgData} from './data';
import type {CfgEvictBasis, CfgEvictOrder, CfgEvictTieBreak} from './evict';
import type {CfgAdmissionPolicy} from './admission';
import type {CfgPartial} from './partial';
import {Defaults} from '../defaults';

/**
 * Return `value` when it is one of `allowed`, otherwise `fallback`. Mirrors the per-field
 * fall-back-to-default pattern used elsewhere for enum-valued cfg options.
 */
function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
	if (typeof value === 'string' && (allowed as readonly string[]).indexOf(value) !== -1) {
		return value as T;
	}

	return fallback;
}

const EVICT_BASES: readonly CfgEvictBasis[] = ['insertion', 'access', 'frequency', 'random', 'none'];
const EVICT_ORDERS: readonly CfgEvictOrder[] = ['oldest', 'newest'];
const TIE_BREAKS: readonly CfgEvictTieBreak[] = ['insertion', 'access'];
const ADMISSION_POLICIES: readonly CfgAdmissionPolicy[] = ['always', 'frequency'];

/**
 * Merge a caller-provided `CfgPartial` over `Defaults` group-by-group, producing a fully-resolved
 * `CfgData`. Every field is validated per-type using the same `numberValue`/boolean checks the
 * pre-1.0 constructor used — invalid types fall back to their default rather than throwing.
 *
 * Derived defaults: `prune.interval` defaults to the resolved `prune.minDelay`;
 * `admission.sketchResetThreshold` defaults to `10 * capacityMax`.
 * @param cfg		Optional partial config to merge over defaults.
 * @returns			Fully-resolved, concrete `CfgData`.
 *
 * @category Cache Config
 */
export function cfgResolve(cfg?: CfgPartial): CfgData {
	const D = Defaults.Cache;

	const capacityMax = numberValue(cfg?.capacityMax, D.CapacityMax);
	const minDelay = numberValue(cfg?.prune?.minDelay, D.Prune.MinDelay);
	const admissionThreshold = numberValue(cfg?.admission?.sketchResetThreshold, 0);

	return {
		capacityMax: capacityMax,
		initialSize: numberValue(cfg?.initialSize, D.InitialSize),
		ttl: numberValue(cfg?.ttl, D.Ttl),
		get: {
			countsAsAccess: booleanValue(cfg?.get?.countsAsAccess, D.Get.CountsAsAccess),
			slidesExpiration: booleanValue(cfg?.get?.slidesExpiration, D.Get.SlidesExpiration)
		},
		has: {
			countsAsAccess: booleanValue(cfg?.has?.countsAsAccess, D.Has.CountsAsAccess),
			slidesExpiration: booleanValue(cfg?.has?.slidesExpiration, D.Has.SlidesExpiration)
		},
		touch: {
			countsAsAccess: booleanValue(cfg?.touch?.countsAsAccess, D.Touch.CountsAsAccess)
		},
		prune: {
			auto: booleanValue(cfg?.prune?.auto, D.Prune.Auto),
			interval: numberValue(cfg?.prune?.interval, minDelay),
			minDelay: minDelay
		},
		evict: {
			basis: enumValue(cfg?.evict?.basis, EVICT_BASES, D.Evict.Basis),
			order: enumValue(cfg?.evict?.order, EVICT_ORDERS, D.Evict.Order),
			secondChance: booleanValue(cfg?.evict?.secondChance, D.Evict.SecondChance),
			tieBreak: enumValue(cfg?.evict?.tieBreak, TIE_BREAKS, D.Evict.TieBreak)
		},
		segments: {
			enabled: booleanValue(cfg?.segments?.enabled, D.Segments.Enabled),
			protectedRatio: numberValue(cfg?.segments?.protectedRatio, D.Segments.ProtectedRatio),
			probationRatio: numberValue(cfg?.segments?.probationRatio, D.Segments.ProbationRatio),
			probationBasis: enumValue(cfg?.segments?.probationBasis, TIE_BREAKS, D.Segments.ProbationBasis),
			promoteOnHit: booleanValue(cfg?.segments?.promoteOnHit, D.Segments.PromoteOnHit)
		},
		ghosts: {
			enabled: booleanValue(cfg?.ghosts?.enabled, D.Ghosts.Enabled),
			sizeRatio: numberValue(cfg?.ghosts?.sizeRatio, D.Ghosts.SizeRatio),
			perSegment: booleanValue(cfg?.ghosts?.perSegment, D.Ghosts.PerSegment)
		},
		adaptive: booleanValue(cfg?.adaptive, D.Adaptive),
		admission: {
			policy: enumValue(cfg?.admission?.policy, ADMISSION_POLICIES, D.Admission.Policy),
			windowRatio: numberValue(cfg?.admission?.windowRatio, D.Admission.WindowRatio),
			sketchResetThreshold: admissionThreshold > 0 ? admissionThreshold : 10 * capacityMax
		}
	};
}
