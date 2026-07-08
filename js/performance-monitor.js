/* performance-monitor.js - Moniteur de performance pour Iron Oath */

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            pageLoadTime: 0,
            dbQueries: 0,
            cacheHits: 0,
            cacheMisses: 0,
            totalRequests: 0,
            errors: []
        };
        this.startTime = performance.now();
        this.init();
    }

    init() {
        // Mesurer le temps de chargement de la page
        window.addEventListener('load', () => {
            this.metrics.pageLoadTime = performance.now() - this.startTime;
        });

        // Intercepter les logs du cache
        this.monitorCache();
        
        // Afficher les métriques après 5 secondes
        setTimeout(() => this.displayMetrics(), 5000);
    }

    monitorCache() {
        const originalLog = console.log;
        console.log = (...args) => {
            const message = args.join(' ');
            
            // Compter les cache hits/misses
            if (message.includes('📦 Cache HIT')) {
                this.metrics.cacheHits++;
            } else if (message.includes('🔄 Cache MISS')) {
                this.metrics.cacheMisses++;
                this.metrics.dbQueries++;
            }
            
            // Compter les requêtes totales
            if (message.includes('chargé') || message.includes('charge')) {
                this.metrics.totalRequests++;
            }
            
            originalLog.apply(console, args);
        };
    }

    recordError(error, context = '') {
        this.metrics.errors.push({
            message: error.message || error,
            context: context,
            timestamp: new Date().toISOString()
        });
    }

    displayMetrics() {
        
        const cacheEfficiency = this.metrics.cacheHits + this.metrics.cacheMisses > 0
            ? ((this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100).toFixed(1)
            : 0;
        
        
        if (this.metrics.errors.length > 0) {
            this.metrics.errors.forEach(err => {
            });
        } else {
        }
        
        
        // Évaluation
        this.evaluatePerformance();
    }

    evaluatePerformance() {
        
        // Temps de chargement
        if (this.metrics.pageLoadTime < 1500) {
        } else if (this.metrics.pageLoadTime < 2500) {
        } else {
        }
        
        // Requêtes DB
        if (this.metrics.dbQueries < 5) {
        } else if (this.metrics.dbQueries < 10) {
        } else {
        }
        
        // Cache
        const cacheEfficiency = this.metrics.cacheHits + this.metrics.cacheMisses > 0
            ? ((this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100)
            : 0;
            
        if (cacheEfficiency > 70) {
        } else if (cacheEfficiency > 40) {
        } else if (cacheEfficiency > 0) {
        } else {
        }
        
    }

    getMetrics() {
        return this.metrics;
    }

    reset() {
        this.metrics = {
            pageLoadTime: 0,
            dbQueries: 0,
            cacheHits: 0,
            cacheMisses: 0,
            totalRequests: 0,
            errors: []
        };
        this.startTime = performance.now();
    }
}

// Activer le moniteur de performance en mode développement
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.perfMonitor = new PerformanceMonitor();
}
