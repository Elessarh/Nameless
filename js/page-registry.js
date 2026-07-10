/* ============================================================
   NAMELESS - Progressive SPA page registry
   Public clean routes plus Connexion/Profil.
   ============================================================ */
(function (global) {
    'use strict';

    function normalize(path) {
        if (!path || path === '/') return '/';
        var clean = path.split('?')[0].split('#')[0];
        if (clean === '') return '/';
        if (clean.charAt(0) !== '/') clean = '/' + clean;
        return clean.replace(/\/+$/, '') || '/';
    }

    function publicRoute(config) {
        var route = {
            id: config.id,
            path: config.path,
            source: config.source,
            aliases: config.aliases || [],
            title: config.title,
            css: config.css || [],
            scripts: config.scripts || [],
            init: config.init,
            destroy: config.destroy
        };
        route.aliases = route.aliases.concat([route.path, '/' + route.source.replace(/^\/+/, '')]);
        return route;
    }

    var homeRoute = {
        id: 'home',
        path: '/',
        source: 'index.html',
        aliases: ['/', '/index.html'],
        title: 'Nameless - Guilde Minecraft',
        // Déclarés ici pour que l'accueil soit complet même quand la session
        // a démarré sur une route propre servie par 404.html (fallback SPA),
        // dont le <head> ne contient pas les styles/scripts de l'accueil.
        css: [
            'css/nameless-effects.css?v=nameless-1.0',
            'css/components/home.css?v=nameless-1.0'
        ],
        scripts: [
            'js/home-carousel.js?v=spa-public-1.0'
        ],
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

    var routeList = [
        homeRoute,
        publicRoute({
            id: 'carte',
            path: '/carte',
            source: 'pages/map.html',
            title: "Carte d'Aincrad - Nameless",
            css: [
                'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
                'css/components/map.css?v=20260710a',
                'css/components/page-hero.css?v=20260710a'
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
        }),
        publicRoute({
            id: 'bestiaire',
            path: '/bestiaire',
            source: 'pages/bestiaire.html',
            title: 'Bestiaire - Nameless',
            css: [
                'css/components/bestiaire.css?v=nameless-1.0',
                'css/components/page-hero.css?v=20260710a'
            ],
            scripts: [
                'js/bestiaire.js?v=20260710a'
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
        }),
        publicRoute({
            id: 'items',
            path: '/items',
            source: 'pages/items.html',
            title: "Catalogue d'Items - Nameless",
            css: [
                'css/components/items.css?v=nameless-1.0',
                'css/components/page-hero.css?v=20260710a'
            ],
            scripts: [
                'js/items-catalog-hdv.js?v=20260129b',
                'js/items.js?v=20260710a'
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
        }),
        publicRoute({
            id: 'quetes',
            path: '/quetes',
            source: 'pages/quetes.html',
            title: "Quetes d'Aincrad - Nameless",
            css: [
                'css/components/pixel-icons.css?v=20260709',
                'css/components/quetes.css?v=nameless-1.0',
                'css/components/page-hero.css?v=20260710a'
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
        }),
        publicRoute({
            id: 'wiki',
            path: '/wiki',
            source: 'pages/wiki.html',
            title: 'Wiki - Nameless',
            css: [
                'css/components/pixel-icons.css?v=20260709',
                'css/components/wiki.css?v=nameless-1.0',
                'css/components/page-hero.css?v=20260710a'
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
        }),
        publicRoute({
            id: 'connexion',
            path: '/connexion',
            source: 'pages/connexion.html',
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
        }),
        publicRoute({
            id: 'profil',
            path: '/profil',
            source: 'pages/profil.html',
            title: 'Mon profil - Nameless',
            css: [
                'css/components/profil.css?v=nameless-1.3'
            ],
            scripts: [
                'js/cache-manager.js',
                'js/profil.js?v=nameless-2.2'
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
        }),
        publicRoute({
            id: 'admin-dashboard',
            path: '/admin-dashboard',
            source: 'pages/admin-dashboard.html',
            aliases: ['/admin-dashboard.html'],
            title: 'Dashboard admin - Nameless',
            css: [
                'css/components/activity-wall.css?v=20260129b',
                'css/components/admin-dashboard.css?v=nameless-1.2'
            ],
            scripts: [
                'js/cache-manager.js',
                'js/admin-dashboard.js?v=20260709g'
            ],
            init: function (root) {
                if (global.NamelessAdminDashboardPage && typeof global.NamelessAdminDashboardPage.init === 'function') {
                    global.NamelessAdminDashboardPage.init(root);
                }
            },
            destroy: function () {
                if (global.NamelessAdminDashboardPage && typeof global.NamelessAdminDashboardPage.destroy === 'function') {
                    global.NamelessAdminDashboardPage.destroy();
                }
            }
        }),
        publicRoute({
            id: 'espace-guilde',
            path: '/espace-guilde',
            source: 'pages/espace-guilde.html',
            aliases: ['/espace-guilde.html'],
            title: 'Espace guilde - Nameless',
            css: [
                'css/components/guilde.css?v=20260129b',
                'css/components/activity-wall.css?v=20260129b',
                'css/components/guild-chat.css?v=20260129b',
                'css/components/guild-dm.css?v=20260129b',
                'css/components/guilde-nameless.css?v=nameless-1.0'
            ],
            scripts: [
                'js/cache-manager.js',
                'js/espace-guilde.js?v=20260709f',
                'js/guild-chat.js?v=20260709g',
                'js/guild-dm.js?v=20260709g'
            ],
            init: function (root) {
                if (global.NamelessGuildPage && typeof global.NamelessGuildPage.init === 'function') {
                    global.NamelessGuildPage.init(root);
                }
                if (global.NamelessGuildChat && typeof global.NamelessGuildChat.init === 'function') {
                    global.NamelessGuildChat.init(root);
                }
                if (global.NamelessGuildDm && typeof global.NamelessGuildDm.init === 'function') {
                    global.NamelessGuildDm.init(root);
                }
            },
            destroy: function () {
                if (global.NamelessGuildDm && typeof global.NamelessGuildDm.destroy === 'function') {
                    global.NamelessGuildDm.destroy();
                }
                if (global.NamelessGuildChat && typeof global.NamelessGuildChat.destroy === 'function') {
                    global.NamelessGuildChat.destroy();
                }
                if (global.NamelessGuildPage && typeof global.NamelessGuildPage.destroy === 'function') {
                    global.NamelessGuildPage.destroy();
                }
            }
        })
    ];

    var routes = {};
    routeList.forEach(function (route) {
        routes[normalize(route.path)] = route;
        route.aliases.forEach(function (alias) {
            routes[normalize(alias)] = route;
        });
    });

    function get(path) {
        return routes[normalize(path)] || null;
    }

    global.NamelessPageRegistry = {
        get: get,
        routes: routeList.slice(),
        isAllowed: function (path) {
            return !!get(path);
        },
        normalize: normalize
    };
})(window);
