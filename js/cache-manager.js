/* cache-manager.js - Système de cache pour optimiser les performances */

class CacheManager {
    constructor() {
        this.cache = new Map();
        this.cacheTimestamps = new Map();
        this.cacheDuration = 5 * 60 * 1000; // 5 minutes par défaut
    }

    /**
     * Définir une durée de cache personnalisée pour une clé
     */
    setCacheDuration(key, duration) {
        this.cacheDuration = duration;
    }

    /**
     * Récupérer une valeur du cache si elle est encore valide
     */
    get(key) {
        const timestamp = this.cacheTimestamps.get(key);
        if (!timestamp) return null;

        const now = Date.now();
        if (now - timestamp > this.cacheDuration) {
            // Cache expiré
            this.cache.delete(key);
            this.cacheTimestamps.delete(key);
            return null;
        }

        return this.cache.get(key);
    }

    /**
     * Stocker une valeur dans le cache
     */
    set(key, value) {
        this.cache.set(key, value);
        this.cacheTimestamps.set(key, Date.now());
    }

    /**
     * Invalider une clé spécifique du cache
     */
    invalidate(key) {
        this.cache.delete(key);
        this.cacheTimestamps.delete(key);
    }

    /**
     * Invalider toutes les clés qui correspondent à un pattern
     */
    invalidatePattern(pattern) {
        const regex = new RegExp(pattern);
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
                this.cacheTimestamps.delete(key);
            }
        }
    }

    /**
     * Vider tout le cache
     */
    clear() {
        this.cache.clear();
        this.cacheTimestamps.clear();
    }

    /**
     * Wrapper pour les requêtes Supabase avec cache automatique
     */
    async fetchWithCache(key, fetchFunction, customDuration = null) {
        // Vérifier le cache d'abord
        const cached = this.get(key);
        if (cached !== null) {
            // console.log(`📦 Cache HIT pour: ${key}`);
            return cached;
        }

        // console.log(`🔄 Cache MISS pour: ${key} - Fetching...`);
        // Exécuter la requête
        const result = await fetchFunction();
        
        // Stocker dans le cache
        if (customDuration) {
            const originalDuration = this.cacheDuration;
            this.cacheDuration = customDuration;
            this.set(key, result);
            this.cacheDuration = originalDuration;
        } else {
            this.set(key, result);
        }

        return result;
    }
}

// Instance globale du cache
window.cacheManager = new CacheManager();
// console.log('✅ Cache Manager initialisé');
