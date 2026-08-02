import {PolicySegment} from './segment';

/**
 * Internal per-item metadata owned by feature modules and stored in `CacheItem.policyData`.
 * Not part of the public API.
 *
 * @category Cache
 */
export interface PolicyMeta {
	/** CLOCK reference bit — set on qualifying access, cleared during the second-chance sweep. */
	referenced?: boolean;
	/** Segmentation membership. */
	segment?: PolicySegment;
}
