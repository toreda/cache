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

import type {CfgData} from './data';
import type {LogLike} from '@toreda/shared-types';

/** True when `value` is strictly inside the open interval (0, 1). */
function ratioInRange(value: number): boolean {
	return Number.isFinite(value) && value > 0 && value < 1;
}

/**
 * Validate a fully-resolved `CfgData` against the design doc's init-time rules. Contradictory
 * combinations `throw`; suspicious-but-legal combinations `log.warn` and proceed.
 *
 * Errors (throw):
 * - `admission.policy: 'frequency'` with `evict.basis: 'none'`.
 * - `adaptive: true` without segments + ghosts + `ghosts.perSegment`.
 * - `ghosts.enabled` with `evict.basis: 'none'`.
 * - `evict.secondChance` with `evict.basis: 'random'`.
 * - ratio fields outside (0, 1); `protectedRatio + probationRatio > 1` with segments enabled.
 *
 * Warnings (log, proceed):
 * - `evict.*` set with `capacityMax: 0`.
 * - `prune.auto` with no ttl configured.
 * - `countsAsAccess` feeding nothing.
 * - `evict.order` set with basis random/none.
 * @param cfg		Resolved config to validate.
 * @param log		Optional log used for warnings.
 * @returns			void
 * @throws			`Error` naming both conflicting fields when a rule is violated.
 *
 * @category Cache Config
 */
export function cfgValidate(cfg: CfgData, log?: LogLike): void {
	// ── Errors ────────────────────────────────────────────────
	if (cfg.admission.policy === 'frequency' && cfg.evict.basis === 'none') {
		throw new Error(
			`cfg invalid: admission.policy 'frequency' requires an eviction target but evict.basis is 'none'.`
		);
	}

	if (cfg.adaptive && !(cfg.segments.enabled && cfg.ghosts.enabled && cfg.ghosts.perSegment)) {
		throw new Error(
			`cfg invalid: adaptive requires segments.enabled, ghosts.enabled, and ghosts.perSegment.`
		);
	}

	if (cfg.ghosts.enabled && cfg.evict.basis === 'none') {
		throw new Error(`cfg invalid: ghosts.enabled requires eviction but evict.basis is 'none'.`);
	}

	if (cfg.evict.secondChance && cfg.evict.basis === 'random') {
		throw new Error(`cfg invalid: evict.secondChance is incompatible with evict.basis 'random'.`);
	}

	const ratios: {name: string; value: number}[] = [
		{name: 'segments.protectedRatio', value: cfg.segments.protectedRatio},
		{name: 'segments.probationRatio', value: cfg.segments.probationRatio},
		{name: 'ghosts.sizeRatio', value: cfg.ghosts.sizeRatio},
		{name: 'admission.windowRatio', value: cfg.admission.windowRatio}
	];
	for (const ratio of ratios) {
		if (!ratioInRange(ratio.value)) {
			throw new Error(`cfg invalid: ${ratio.name} must be within the open interval (0, 1).`);
		}
	}

	if (cfg.segments.enabled && cfg.segments.protectedRatio + cfg.segments.probationRatio > 1) {
		throw new Error(
			`cfg invalid: segments.protectedRatio + segments.probationRatio must not exceed 1 when segments are enabled.`
		);
	}

	// ── Warnings ──────────────────────────────────────────────
	if (cfg.capacityMax === 0 && cfg.evict.basis !== 'none') {
		log?.warn(
			`cfg: evict.basis '${cfg.evict.basis}' set with capacityMax 0 (unbounded) — eviction can never trigger.`
		);
	}

	if (cfg.prune.auto && cfg.ttl === 0) {
		log?.warn(`cfg: prune.auto is enabled but no ttl is configured — auto-prune has nothing to remove.`);
	}

	const accessFeedsNothing =
		(cfg.evict.basis === 'insertion' || cfg.evict.basis === 'random' || cfg.evict.basis === 'none') &&
		!cfg.get.slidesExpiration &&
		!cfg.has.slidesExpiration &&
		!cfg.segments.enabled &&
		cfg.admission.policy !== 'frequency';
	if (
		accessFeedsNothing &&
		(cfg.get.countsAsAccess || cfg.has.countsAsAccess || cfg.touch.countsAsAccess)
	) {
		log?.warn(
			`cfg: countsAsAccess is set but nothing consumes access accounting (basis insertion/random/none, no sliding, no segments, no frequency admission).`
		);
	}

	if ((cfg.evict.basis === 'random' || cfg.evict.basis === 'none') && cfg.evict.order !== 'oldest') {
		log?.warn(
			`cfg: evict.order '${cfg.evict.order}' has no effect with evict.basis '${cfg.evict.basis}'.`
		);
	}
}
