
# [Unreleased]

# [0.2.0] - 2026-07-22

## Fixed
* `cache.add` now properly validates TTL before adding items and rejects any call with a non-number, negative, or non-finite TTL value.
* Updating `@toreda/time` to the latest available version fixed several bugs that could occur related to timeSince, timeUntil, and between specific time unit pairs
* Added stats to track number of hits, misses, adds, deletes, evictions, expirations so that users can track cache performance. 
* Added `touch` method that extends item expiry for item matching `id` which is not yet expired. Expired items are lazily removed.
* Added public `keys()` method to iterate keys in cache.
* Added public `values()` to iterate unexpired registered cache items.

## Maintenance
* Updated project's NPM dependencies.

# [0.1.1] - 2022-04-11

## Fixed
* Added missing `CacheItemId` type to package exports in `index.ts`.

## Maintenance
* Updated all packages to latest available and ran `yarn upgrade`.



[Unreleased]: https://github.com/toreda/cache/releases/compare/v0.1.0...HEAD
[0.1.1]: https://github.com/toreda/cache/releases/compare/v0.1.0...v0.1.1
[0.1.1]: https://github.com/toreda/cache/releases/compare/v0.0.0...v0.1.0
[0.0.0]: https://github.com/toreda/cache/releases
