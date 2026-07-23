import {type CfgData} from '../cfg/data';

export interface CacheInit<ItemT> {
	/**
	 *	Optional validator invoked each time cache.add is called. Items are added to cache when
	 * validator returns true, and rejected when it returns false. Allows custom or extended cache
	 * types to provide custom item validation. When `itemValidator` is not provided, validation
	 * is skipped entirely and all items are accepted.
	 */
	itemValidator?: (item?: ItemT | null) => boolean;
	cfg?: Partial<CfgData>;
}
