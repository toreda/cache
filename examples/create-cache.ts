import {Cache} from '@toreda/cache';

interface User {
	[k: string]: unknown;
	id: string;
	name: string;
}

// A default cache: insertion-order eviction, 30s TTL, capacity 1000.
const cache = new Cache<User>({
	cfg: {
		capacityMax: 100,
		ttl: 300
	},
	events: {
		onItemEvict: (item: User, id: string): void => {
			console.log(`evicted ${id}`, item);
		}
	}
});

cache.add({id: 'u-1', name: 'Ada'});

const user = cache.getOrAdd('u-2', (id: string): User => ({id: id, name: 'Grace'}));
console.log(user, cache.size);
