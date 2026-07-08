/* ============================================================
   NAMELESS - Progressive SPA page registry
   Public pages plus the first connected route: Connexion.
   ============================================================ */
(function (global) {
    'use strict';

    var homeRoute = {
        id: 'home',
        path: '/',
        aliases: ['/', '/index.html'],
        title: 'Nameless — Guilde Minecraft',
        css: [],
        scripts: [],
        init: function (root) {
            if (global.NamelessHomePage && typeof global.NamelessHomePage.init === 'function') {
                global.NamelessHomePage.init(root);
            }
        },
        destroy: function () {
            if (global.NamelessHomePage && typeof global.NamelessHomePage.destroy === 'function') {
                global.NamelessHomePage.destroy();
            }
        }
    };

    var routes = {
        '/': homeRoute,
        '/index.html': homeRoute,
        '/pages/quetes.html': {
            id: 'quetes',
            path: '/pages/quetes.html',
            aliases: ['/pages/quetes.html'],
            title: "Quêtes d'Aincrad — Nameless",
            css: [
                'css/components/quetes.css?v=nameless-1.0',
                'css/components/page-hero.css?v=nameless-1.1'
            ],
            scripts: [
                'js/quetes.js?v=spa-public-1.0'
            ],
            init: function (root) {
                if (global.NamelessQuestPage && typeof global.NamelessQuestPage.init === 'function') {
                    global.NamelessQuestPage.init(root);
                }
            },
            destroy: function () {
                if (global.NamelessQuestPage && typeof global.NamelessQuestPage.destroy === 'function') {
                    global.NamelessQuestPage.destroy();
                }
            }
        },
        '/pages/items.html': {
            id: 'items',
            path: '/pages/items.html',
            aliases: ['/pages/items.html'],
            title: "Catalogue d'Items — Nameless",
            css: [
                'css/components/items.css?v=nameless-1.0',
                'css/components/page-hero.css?v=nameless-1.1'
            ],
            scripts: [
                'js/items-catalog-hdv.js?v=20260129b',
                'js/items.js?v=spa-public-1.0'
            ],
            init: function (root) {
                if (global.NamelessItemsPage && typeof global.NamelessItemsPage.init === 'function') {
                    global.NamelessItemsPage.init(root);
                }
            },
            destroy: function () {
                if (global.NamelessItemsPage && typeof global.NamelessItemsPage.destroy === 'function') {
                    global.NamelessItemsPage.destroy();
                }
            }
        },
        '/pages/bestiaire.html': {
            id: 'bestiaire',
            path: '/pages/bestiaire.html',
            aliases: ['/pages/bestiaire.html'],
            title: 'Bestiaire — Nameless',
            css: [
                'css/components/bestiaire.css?v=nameless-1.0',
                'css/components/page-hero.css?v=nameless-1.1'
            ],
            scripts: [
                'js/bestiaire.js?v=spa-public-1.0'
            ],
            init: function (root) {
                if (global.NamelessBestiaryPage && typeof global.NamelessBestiaryPage.init === 'function') {
                    global.NamelessBestiaryPage.init(root);
                }
            },
            destroy: function () {
                if (global.NamelessBestiaryPage && typeof global.NamelessBestiaryPage.destroy === 'function') {
                    global.NamelessBestiaryPage.destroy();
                }
            }
        },
        '/pages/wiki.html': {
            id: 'wiki',
            path: '/pages/wiki.html',
            aliases: ['/pages/wiki.html'],
            title: 'Wiki — Nameless',
            css: [
                'css/components/wiki.css?v=nameless-1.0',
                'css/components/page-hero.css?v=nameless-1.1'
            ],
            scripts: [
                'js/wiki.js?v=spa-public-1.0'
            ],
            init: function (root) {
                if (global.NamelessWikiPage && typeof global.NamelessWikiPage.init === 'function') {
                    global.NamelessWikiPage.init(root);
                }
            },
            destroy: function () {
                if (global.NamelessWikiPage && typeof global.NamelessWikiPage.destroy === 'function') {
                    global.NamelessWikiPage.destroy();
                }
            }
        },
        '/pages/map.html': {
            id: 'map',
            path: '/pages/map.html',
            aliases: ['/pages/map.html'],
            title: "Carte d'Aincrad — Nameless",
            css: [
                'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
                'css/components/map.css?v=nameless-1.0',
                'css/components/page-hero.css?v=nameless-1.1'
            ],
            scripts: [
                'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
                'js/map.js?v=spa-public-1.1'
            ],
            init: function (root) {
                if (global.NamelessMapPage && typeof global.NamelessMapPage.init === 'function') {
                    global.NamelessMapPage.init(root);
                }
            },
            destroy: function () {
                if (global.NamelessMapPage && typeof global.NamelessMapPage.destroy === 'function') {
                    global.NamelessMapPage.destroy();
                }
            }
        },
        '/pages/connexion.html': {
            id: 'connexion',
            path: '/pages/connexion.html',
            aliases: ['/pages/connexion.html'],
            title: 'Connexion - Nameless',
            css: [
                'css/components/connexion.css?v=20260709'
            ],
            scripts: [],
            init: function (root) {
                if (global.NamelessAuthPage && typeof global.NamelessAuthPage.init === 'function') {
                    global.NamelessAuthPage.init(root);
                }
            },
            destroy: function () {
                if (global.NamelessAuthPage && typeof global.NamelessAuthPage.destroy === 'function') {
                    global.NamelessAuthPage.destroy();
                }
            }
        },
        '/pages/profil.html': {
            id: 'profil',
            path: '/pages/profil.html',
            aliases: ['/pages/profil.html'],
            title: 'Mon profil - Nameless',
            css: [
                'css/components/profil.css?v=nameless-1.0'
            ],
            scripts: [
                'js/cache-manager.js',
                'js/profil.js?v=nameless-1.0'
            ],
            init: function (root) {
                if (global.NamelessProfilePage && typeof global.NamelessProfilePage.init === 'function') {
                    global.NamelessProfilePage.init(root);
                }
            },
            destroy: function () {
                if (global.NamelessProfilePage && typeof global.NamelessProfilePage.destroy === 'function') {
                    global.NamelessProfilePage.destroy();
                }
            }
        }
    };

    function normalize(path) {
        if (!path || path === '/') return '/';
        var clean = path.split('?')[0].split('#')[0];
        if (clean === '') return '/';
        if (clean.charAt(0) !== '/') clean = '/' + clean;
        return clean;
    }

    function get(path) {
        return routes[normalize(path)] || null;
    }

    global.NamelessPageRegistry = {
        get: get,
        isAllowed: function (path) {
            return !!get(path);
        },
        normalize: normalize
    };
})(window);
