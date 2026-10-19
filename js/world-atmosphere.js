/* PageAtmosphere: a viewport layer outside every route's content container. */
(function (global) {
    'use strict';
    var root = document.documentElement;
    var themes = {home:'aincrad', carte:'aincrad', wiki:'aincrad', bestiaire:'forest', items:'armory', 'espace-guilde':'guild', profil:'guild', 'admin-dashboard':'guild', connexion:'guild', quetes:'dungeon'};
    var scenes = {
        aincrad:['/assets/art-v4/aincrad-1280.webp','/assets/art-v4/aincrad-960.webp'],
        forest:['/assets/art-v4/forest-1280.webp','/assets/art-v4/forest-640.webp'],
        armory:['/assets/art-v4/workshop-1280.webp','/assets/art-v4/workshop-640.webp'],
        guild:['/assets/art-v4/guild-1280.webp','/assets/art-v4/guild-640.webp'],
        dungeon:['/assets/art-v5/kobold-arena-1280.webp','/assets/art-v5/kobold-arena-640.webp'],
        wiki:['/assets/art-v6/archives-1672.webp','/assets/art-v6/archives-640.webp'],
        carte:['/assets/art-v4/guild-1280.webp','/assets/art-v4/guild-640.webp']
    };
    var motion = null;
    var motionPage = null;
    var revealed = new WeakSet();
    var reducedMotion = null;
    try { reducedMotion = global.matchMedia('(prefers-reduced-motion: reduce)'); } catch (_) {}

    // These are independent reading/choice units, never their enclosing panels.
    // Map geometry, forms, live announcements and account screens stay untouched.
    var revealSelectors = {
        home: '.home-signature,.home-title,.home-description,.home-actions,.home-access .home-entry,.home-selection .home-record,.home-guild-card',
        wiki: '.wiki-codex-intro > .wiki-kicker,.wiki-codex-intro > h1,.wiki-codex-intro > p,.wiki-portal,.wiki-category',
        items: '#items-grid > .item-card',
        bestiaire: '#creatures-grid > .creature-card'
    };

    function syncMotion(page) {
        motionPage = page;
        if (motion) motion();
        motion = null;
        var selector = revealSelectors[page];
        var scope = document.getElementById('main-content');
        // Content is fully visible without this enhancement, including old browsers.
        if (!selector || !scope || document.hidden || !reducedMotion || reducedMotion.matches ||
            typeof global.IntersectionObserver !== 'function' ||
            typeof global.Element.prototype.animate !== 'function') return;

        var alive = true;
        var observer = null;
        var mutations = null;
        var frame = null;
        var pending = new Set();
        var active = new Map();
        var compact = global.innerWidth <= 768;
        var independentTranslation = global.CSS && typeof global.CSS.supports === 'function' && global.CSS.supports('translate', '0 1px');

        function cancel(target) {
            var animation = active.get(target);
            active.delete(target);
            if (animation) {
                animation.onfinish = null;
                animation.oncancel = null;
                try { animation.cancel(); } catch (_) {}
            }
        }

        function release(target) {
            pending.delete(target);
            if (observer) observer.unobserve(target);
            cancel(target);
        }

        function focused(target) {
            return target === document.activeElement || target.contains(document.activeElement);
        }

        function reveal(entries) {
            if (!alive) return;
            var order = 0;
            entries.forEach(function (entry) {
                var target = entry.target;
                if (!entry.isIntersecting || !pending.has(target)) return;
                pending.delete(target);
                observer.unobserve(target);
                if (!target.isConnected || !scope.contains(target) || document.hidden || reducedMotion.matches || focused(target)) return;
                var first = {opacity: 0.55};
                var last = {opacity: 1};
                // Individual translate leaves each card's hover transform independent.
                if (independentTranslation) {
                    first.translate = '0 ' + (compact ? '4px' : '7px');
                    last.translate = '0 0';
                }
                try {
                    var animation = target.animate([first, last], {
                        duration: compact ? 240 : 320,
                        delay: Math.min(order++, 5) * (compact ? 14 : 28),
                        easing: 'cubic-bezier(.16,1,.3,1)',
                        // Apply the first frame during the brief stagger, then
                        // release the effect entirely on completion/cancellation.
                        fill: 'backwards'
                    });
                    active.set(target, animation);
                    var complete = function () {
                        if (active.get(target) !== animation) return;
                        active.delete(target);
                        animation.onfinish = null;
                        animation.oncancel = null;
                    };
                    animation.onfinish = complete;
                    animation.oncancel = complete;
                } catch (_) { cancel(target); }
            });
        }

        function scan() {
            frame = null;
            if (!alive) return;
            pending.forEach(function (target) { if (!target.isConnected || !scope.contains(target)) release(target); });
            active.forEach(function (_, target) { if (!target.isConnected || !scope.contains(target)) cancel(target); });
            // Catalogue pages contain 48 results. Bound work even if a faulty render
            // inserts more; untouched content remains immediately readable.
            Array.prototype.slice.call(scope.querySelectorAll(selector), 0, 64).forEach(function (target) {
                if (revealed.has(target)) return;
                revealed.add(target);
                if (focused(target)) return;
                pending.add(target);
                observer.observe(target);
            });
        }

        function interacted(event) {
            pending.forEach(function (target) { if (target === event.target || target.contains(event.target)) release(target); });
            active.forEach(function (_, target) { if (target === event.target || target.contains(event.target)) cancel(target); });
        }

        function cleanup() {
            alive = false;
            if (observer) observer.disconnect();
            if (mutations) mutations.disconnect();
            if (frame !== null) global.cancelAnimationFrame(frame);
            pending.clear();
            active.forEach(function (_, target) { cancel(target); });
            scope.removeEventListener('focusin', interacted);
            scope.removeEventListener('pointerdown', interacted);
        }

        try {
            observer = new global.IntersectionObserver(reveal, {threshold: 0.08});
            motion = cleanup;
            scan();
            scope.addEventListener('focusin', interacted);
            scope.addEventListener('pointerdown', interacted);
            var grid = page === 'items' ? scope.querySelector('#items-grid') : page === 'bestiaire' ? scope.querySelector('#creatures-grid') : null;
            if (grid && typeof global.MutationObserver === 'function') {
                mutations = new global.MutationObserver(function () {
                    if (!alive || frame !== null) return;
                    if (typeof global.requestAnimationFrame === 'function') frame = global.requestAnimationFrame(scan);
                    else scan();
                });
                // Observe only result replacement, not tooltips, metadata or attributes.
                mutations.observe(grid, {childList: true});
            }
        } catch (_) { cleanup(); motion = null; }
    }
    function pageFromPath() {
        var path=global.location.pathname;
        if (/\/boss\//.test(path)) return 'boss';
        var leaf=path.split('/').filter(Boolean).pop() || 'home';
        leaf=leaf.replace(/\.html$/,'');
        return leaf==='index' ? 'home' : leaf;
    }
    function mount() {
        var layer=document.getElementById('nm-page-atmosphere');
        if (layer || !document.body) return layer;
        layer=document.createElement('div');
        layer.id='nm-page-atmosphere'; layer.className='nm-page-atmosphere';
        layer.setAttribute('aria-hidden','true'); layer.setAttribute('inert','');
        var picture=document.createElement('picture'); picture.className='nm-page-atmosphere__scene';
        var source=document.createElement('source'); source.media='(max-width: 768px)';
        var img=document.createElement('img'); img.alt=''; img.width=1672; img.height=941; img.decoding='async';
        picture.appendChild(source); picture.appendChild(img); layer.appendChild(picture);
        ['light','mist','veil'].forEach(function(name){var plane=document.createElement('span'); plane.className='nm-page-atmosphere__'+name; layer.appendChild(plane);});
        document.body.prepend(layer); root.dataset.worldShell='true';
        return layer;
    }
    function sync(route) {
        var page=route || pageFromPath();
        var theme = themes[route];
        if (!theme) {
            var path = global.location.pathname;
            theme = /\/boss\/|quetes/.test(path) ? 'dungeon' : /bestiaire/.test(path) ? 'forest' : /items/.test(path) ? 'armory' : /guilde|profil|admin|connexion/.test(path) ? 'guild' : 'aincrad';
        }
        root.dataset.worldAtmosphere = theme;
        root.dataset.worldPage=page;
        var layer=mount();
        if (!layer) return;
        var img=layer.querySelector('img'), source=layer.querySelector('source');
        if (page==='home') {img.removeAttribute('src'); source.removeAttribute('srcset');}
        else {
            var art=scenes[page] || scenes[theme];
            // Let picture choose its mobile source before activating the fallback image.
            if (source.getAttribute('srcset')!==art[1]) source.setAttribute('srcset',art[1]);
            if (img.getAttribute('src')!==art[0]) img.setAttribute('src',art[0]);
        }
        syncMotion(page);
    }
    function visibility() {
        root.dataset.worldHidden = String(!!document.hidden);
        syncMotion(motionPage || pageFromPath());
    }
    global.NamelessWorldAtmosphere = {sync:sync};
    sync();
    root.dataset.worldHidden = String(!!document.hidden);
    document.addEventListener('visibilitychange', visibility);
    if (reducedMotion) {
        var updateMotion = function () { syncMotion(motionPage || pageFromPath()); };
        if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', updateMotion);
        else if (reducedMotion.addListener) reducedMotion.addListener(updateMotion);
    }
})(window);
