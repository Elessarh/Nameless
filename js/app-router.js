/* ============================================================
   NAMELESS - Progressive public SPA router (phase 1)
   - Strict allowlist is defined in js/page-registry.js
   - Keeps the shell, navbar, footer and audio player alive.
   - Does not execute scripts from fetched HTML documents.
   ============================================================ */
(function (global) {
    'use strict';

    var registry = global.NamelessPageRegistry;
    if (!registry) return;

    var appView = null;
    var basePath = '/';
    var rootHref = global.location.origin + '/';
    var currentRoute = null;
    var navToken = 0;

    global.NamelessSpaRouter = {
        controlsLifecycle: true,
        navigate: navigate
    };

    function detectBasePath() {
        var script = document.currentScript || document.querySelector('script[src*="js/app-router.js"]');
        if (!script) return '/';

        var src = script.getAttribute('src') || '';
        var url = new URL(src, document.baseURI);
        var marker = '/js/app-router.js';
        var idx = url.pathname.indexOf(marker);
        if (idx === -1) return '/';
        var base = url.pathname.slice(0, idx + 1);
        return base || '/';
    }

    function routePathFromUrl(url) {
        if (url.origin !== global.location.origin) return null;
        var path = url.pathname;
        if (path === basePath.slice(0, -1)) return '/';
        if (path.indexOf(basePath) !== 0) return null;

        var relative = path.slice(basePath.length);
        if (!relative || relative === '/') return '/';
        return registry.normalize('/' + relative.replace(/^\/+/, ''));
    }

    function urlForRoute(routePath) {
        if (routePath === '/') return rootHref;
        return new URL(routePath.replace(/^\/+/, ''), rootHref).href;
    }

    function sourceUrlForRoute(route) {
        var source = route.source || (route.path === '/' ? 'index.html' : route.path.replace(/^\/+/, ''));
        return new URL(source.replace(/^\/+/, ''), rootHref).href;
    }

    function isPlainLeftClick(event) {
        return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    }

    function shouldIgnoreLink(anchor, event) {
        if (!anchor || !isPlainLeftClick(event)) return true;
        if (anchor.hasAttribute('download')) return true;

        var target = (anchor.getAttribute('target') || '').toLowerCase();
        if (target && target !== '_self') return true;

        var rawHref = anchor.getAttribute('href');
        if (!rawHref || rawHref.charAt(0) === '#') return true;

        var url = new URL(rawHref, document.baseURI);
        if (url.origin !== global.location.origin) return true;

        var currentPath = routePathFromUrl(new URL(global.location.href));
        var targetPath = routePathFromUrl(url);
        if (url.hash && currentPath === targetPath) return true;

        return false;
    }

    function normalizePersistentShellLinks() {
        var roots = Array.prototype.slice.call(document.querySelectorAll('header, footer'));
        roots.forEach(function (root) {
            root.querySelectorAll('a[href]').forEach(function (anchor) {
                var raw = anchor.getAttribute('href');
                if (!raw || raw.charAt(0) === '#') return;
                if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.indexOf('//') === 0) return;
                if (raw.indexOf('../') === 0) return;
                var url = new URL(raw, document.baseURI);
                var routePath = routePathFromUrl(url);
                var route = registry.get(routePath);
                anchor.href = route ? urlForRoute(route.path) : new URL(raw.replace(/^\.\//, ''), rootHref).href;
            });
        });
    }

    function normalizePersistentHeadLinks() {
        document.querySelectorAll('head link[href]').forEach(function (link) {
            var rel = (link.getAttribute('rel') || '').toLowerCase();
            if (rel.indexOf('icon') === -1 && rel !== 'preload') return;

            var raw = link.getAttribute('href');
            if (!raw || raw.charAt(0) === '#') return;
            if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.indexOf('//') === 0) return;
            if (raw.indexOf('../') === 0) return;
            link.href = new URL(raw.replace(/^\.\//, ''), rootHref).href;
        });
    }

    function ensureStyles(route) {
        var css = route.css || [];
        return Promise.all(css.map(function (href) {
            var url = new URL(href, rootHref).href;
            var exists = Array.prototype.some.call(document.querySelectorAll('link[rel="stylesheet"]'), function (link) {
                return link.href === url;
            });
            if (exists) return Promise.resolve();

            return new Promise(function (resolve) {
                var link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = url;
                link.dataset.spaCss = route.id;
                link.addEventListener('load', resolve, { once: true });
                link.addEventListener('error', resolve, { once: true });
                document.head.appendChild(link);
            });
        }));
    }

    function ensureScripts(route) {
        var scripts = route.scripts || [];
        return scripts.reduce(function (chain, src) {
            return chain.then(function () {
                var url = new URL(src, rootHref).href;
                var exists = Array.prototype.some.call(document.querySelectorAll('script[src]'), function (script) {
                    return script.src === url;
                });
                if (exists) return Promise.resolve();

                return new Promise(function (resolve) {
                    var script = document.createElement('script');
                    script.src = url;
                    script.defer = true;
                    script.dataset.spaScript = route.id;
                    script.addEventListener('load', resolve, { once: true });
                    script.addEventListener('error', resolve, { once: true });
                    document.body.appendChild(script);
                });
            });
        }, Promise.resolve());
    }

    function copyMainAttributes(nextMain) {
        Array.prototype.slice.call(appView.attributes).forEach(function (attr) {
            if (attr.name !== 'id') appView.removeAttribute(attr.name);
        });

        Array.prototype.slice.call(nextMain.attributes).forEach(function (attr) {
            if (attr.name !== 'id') appView.setAttribute(attr.name, attr.value);
        });

        appView.id = 'main-content';
    }

    function applyDocument(doc, route) {
        var nextMain = doc.querySelector('main#main-content') || doc.querySelector('main');
        if (!nextMain) return false;

        if (currentRoute && currentRoute.destroy) currentRoute.destroy();

        copyMainAttributes(nextMain);
        appView.replaceChildren.apply(appView, Array.prototype.map.call(nextMain.childNodes, function (node) {
            return document.importNode(node, true);
        }));

        document.title = doc.title || route.title || document.title;
        document.body.className = doc.body ? doc.body.className : '';
        updateNavState(route);
        closeMobileNav();
        return true;
    }

    function updateNavState(route) {
        document.querySelectorAll('.nav-link').forEach(function (link) {
            var linkRoute = null;
            try {
                var url = new URL(link.href, document.baseURI);
                linkRoute = registry.get(routePathFromUrl(url));
            } catch (e) {
                linkRoute = null;
            }

            var active = !!(linkRoute && linkRoute.id === route.id);
            link.classList.toggle('active', active);
            if (active) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
    }

    function closeMobileNav() {
        if (global.mobileNavbar && typeof global.mobileNavbar.closeMenu === 'function') {
            global.mobileNavbar.closeMenu();
        }
    }

    function fetchDocument(route) {
        return fetch(sourceUrlForRoute(route), { credentials: 'same-origin' })
            .then(function (response) {
                if (!response.ok) throw new Error('Route fetch failed');
                return response.text();
            })
            .then(function (html) {
                return new DOMParser().parseFromString(html, 'text/html');
            });
    }

    function activateRoute(route, root, options) {
        options = options || {};
        currentRoute = route;
        if (route.init) route.init(root);
        if (options.scroll !== false) global.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function navigate(routePath, options) {
        options = options || {};
        var route = registry.get(routePath);
        if (!route || !appView) return Promise.resolve(false);

        var sameRoute = currentRoute && currentRoute.id === route.id;
        if (sameRoute && !options.force) {
            updateNavState(route);
            if (options.push !== false) history.pushState({ route: route.path }, '', options.url || urlForRoute(route.path));
            return Promise.resolve(true);
        }

        var token = ++navToken;
        return fetchDocument(route)
            .then(function (doc) {
                if (token !== navToken) return false;
                return ensureStyles(route).then(function () {
                    return ensureScripts(route);
                }).then(function () {
                    if (token !== navToken) return false;
                    if (options.push !== false) {
                        history.pushState({ route: route.path }, '', options.url || urlForRoute(route.path));
                    }
                    if (!applyDocument(doc, route)) return false;
                    activateRoute(route, appView, options);
                    return true;
                });
            })
            .catch(function () {
                return false;
            });
    }

    function onClick(event) {
        var target = event.target;
        var anchor = target && target.closest ? target.closest('a[href]') : null;
        if (shouldIgnoreLink(anchor, event)) return;

        var url = new URL(anchor.getAttribute('href'), document.baseURI);
        var routePath = routePathFromUrl(url);
        var route = registry.get(routePath);
        if (!route) return;

        event.preventDefault();
        navigate(route.path).then(function (handled) {
            if (!handled) global.location.href = url.href;
        });
    }

    function onPopState() {
        var routePath = routePathFromUrl(new URL(global.location.href));
        var route = registry.get(routePath);
        if (!route) return;
        navigate(routePath, { push: false, force: true, scroll: true });
    }

    function boot() {
        appView = document.getElementById('main-content') || document.querySelector('main');
        if (!appView) return;

        basePath = detectBasePath();
        rootHref = global.location.origin + basePath;
        normalizePersistentShellLinks();
        normalizePersistentHeadLinks();

        var routePath = routePathFromUrl(new URL(global.location.href));
        var route = registry.get(routePath);
        if (!route) return;

        history.replaceState({ route: route.path }, '', global.location.href);
        if (document.body && document.body.dataset.spaFallback === 'true') {
            currentRoute = null;
            navigate(route.path, { push: false, force: true, scroll: false });
        } else {
            currentRoute = route;
            updateNavState(route);
            activateRoute(route, appView, { scroll: false });
        }

        document.addEventListener('click', onClick);
        global.addEventListener('popstate', onPopState);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})(window);
