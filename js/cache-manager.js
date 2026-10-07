/* In-memory cache. Private entries are cleared by the authentication lifecycle. */
class CacheManager {
    constructor() {
        this.cache = new Map();
        this.cacheTimestamps = new Map();
        this.cacheDurations = new Map();
        this.pending = new Map();
        this.cacheDuration = 5 * 60 * 1000;
        this.generation = 0;
        this.revisions = new Map();
    }
    setCacheDuration(key, duration) {
        if (Number.isFinite(duration) && duration >= 0) this.cacheDurations.set(key, duration);
    }
    get(key) {
        if (!this.cacheTimestamps.has(key)) return null;
        const duration = this.cacheDurations.get(key) ?? this.cacheDuration;
        if (Date.now() - this.cacheTimestamps.get(key) >= duration) {
            this.cache.delete(key);
            this.cacheTimestamps.delete(key);
            return null;
        }
        return this.cache.get(key);
    }
    set(key, value, duration) {
        if (duration !== undefined) this.setCacheDuration(key, duration);
        this.cache.set(key, value);
        this.cacheTimestamps.set(key, Date.now());
    }
    invalidate(key) {
        this.cache.delete(key);
        this.cacheTimestamps.delete(key);
        this.pending.delete(key);
        this.revisions.set(key, (this.revisions.get(key) || 0) + 1);
    }
    invalidatePattern(pattern) {
        const regex = new RegExp(pattern);
        for (const key of new Set([...this.cache.keys(), ...this.pending.keys()])) {
            regex.lastIndex = 0;
            if (regex.test(key)) this.invalidate(key);
        }
    }
    clear() {
        this.generation++;
        this.cache.clear();
        this.cacheTimestamps.clear();
        this.cacheDurations.clear();
        this.pending.clear();
        this.revisions.clear();
    }
    async fetchWithCache(key, fetchFunction, duration) {
        const cached = this.get(key);
        if (cached !== null) return cached;
        if (this.pending.has(key)) return this.pending.get(key);
        const generation = this.generation;
        const revision = this.revisions.get(key) || 0;
        const request = Promise.resolve().then(fetchFunction).then(result => {
            // An old account's in-flight request must never refill a cleared cache.
            if (generation === this.generation && revision === (this.revisions.get(key) || 0)
                && !(result && result.error)) this.set(key, result, duration);
            return result;
        }).finally(() => {
            if (this.pending.get(key) === request) this.pending.delete(key);
        });
        this.pending.set(key, request);
        return request;
    }
}
window.cacheManager = new CacheManager();
