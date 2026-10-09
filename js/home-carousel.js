/* Keep the existing path for old cached route registries.
   Home now offers visible links instead of rotating slides. */
(function (global) {
    'use strict';
    var controller = null;
    var motionPaused = false;
    var motionStorageKey = 'nameless-world-motion-paused';
    try { motionPaused = global.sessionStorage.getItem(motionStorageKey) === 'true'; } catch (_) {}

    function destroy() {
        if (controller) controller.abort();
        controller = null;
    }

    function init(root) {
        destroy();
        var scope = root && root.querySelector ? root : document;
        var home = scope.matches && scope.matches('[data-home]') ? scope : scope.querySelector('[data-home]');
        if (!home) return;
        controller = new AbortController();
        var signal = controller.signal;
        var feedback = home.querySelector('[data-home-search-status]');
        var motionButton = home.querySelector('[data-home-motion]');
        var hero = home.querySelector('.home-hero');
        var reducedMotion = typeof global.matchMedia === 'function' ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;
        var finePointer = typeof global.matchMedia === 'function' ? global.matchMedia('(hover: hover) and (pointer: fine)') : null;
        var heroVisible = false;
        var pointerInside = false;
        var bounds = null;
        var frame = null;
        var depthX = 0;
        var depthY = 0;
        var observer = null;

        function resetDepth() {
            if (frame !== null) global.cancelAnimationFrame(frame);
            frame = null;
            depthX = 0;
            depthY = 0;
            home.style.setProperty('--home-depth-x', '0px');
            home.style.setProperty('--home-depth-y', '0px');
        }

        function paused() {
            return motionPaused || !!(reducedMotion && reducedMotion.matches);
        }

        function suspended() {
            return document.hidden || document.visibilityState === 'hidden' || !heroVisible;
        }

        function canDepth() {
            return !signal.aborted && pointerInside && bounds && bounds.width > 0 && bounds.height > 0 &&
                global.innerWidth > 768 && finePointer && finePointer.matches && !paused() && !suspended();
        }

        function measureBounds() {
            bounds = hero ? hero.getBoundingClientRect() : null;
        }

        function updateSuspension() {
            home.dataset.motionSuspended = String(!!suspended());
            if (!canDepth()) resetDepth();
        }

        function updateMotion() {
            var reduce = reducedMotion && reducedMotion.matches;
            var isPaused = paused();
            home.dataset.motionPaused = String(!!isPaused);
            updateSuspension();
            if (!motionButton) return;
            var english = global.NamelessI18n && global.NamelessI18n.getLanguage() === 'en';
            motionButton.disabled = !!reduce;
            motionButton.setAttribute('aria-pressed', String(!!isPaused));
            motionButton.setAttribute('aria-label', reduce ? (english ? 'Still scenery (reduced motion)' : 'Décor fixe (mouvements réduits)') : isPaused ? (english ? 'Resume scenery' : 'Animer le décor') : (english ? 'Pause scenery' : 'Pause du décor'));
            var label = motionButton.querySelector('[data-home-motion-label]');
            if (label) label.textContent = reduce ? (english ? 'Still scenery' : 'Décor fixe') : isPaused ? (english ? 'Resume scenery' : 'Animer le décor') : (english ? 'Pause scenery' : 'Pause du décor');
        }
        updateMotion();
        if (motionButton) motionButton.addEventListener('click', function () {
            motionPaused = !motionPaused;
            try { global.sessionStorage.setItem(motionStorageKey, String(motionPaused)); } catch (_) {}
            updateMotion();
        }, { signal: signal });
        document.addEventListener('nameless:languagechange', updateMotion, { signal: signal });
        document.addEventListener('visibilitychange', updateSuspension, { signal: signal });

        function watchMedia(media) {
            if (!media) return;
            if (media.addEventListener) {
                media.addEventListener('change', updateMotion);
                signal.addEventListener('abort', function () { media.removeEventListener('change', updateMotion); }, { once: true });
            } else if (media.addListener) {
                media.addListener(updateMotion);
                signal.addEventListener('abort', function () { media.removeListener(updateMotion); }, { once: true });
            }
        }
        watchMedia(reducedMotion);
        watchMedia(finePointer);

        if (hero) {
            hero.addEventListener('pointerenter', function () { pointerInside = true; measureBounds(); }, { signal: signal });
            hero.addEventListener('pointerleave', function () { pointerInside = false; bounds = null; resetDepth(); }, { signal: signal });
            hero.addEventListener('pointermove', function (event) {
                if (event.pointerType === 'touch' || !canDepth() || typeof global.requestAnimationFrame !== 'function') return;
                // Coordinates are coalesced; no layout is read inside an animation frame.
                depthX = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1)) * 10;
                depthY = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1)) * 5;
                if (frame !== null) return;
                frame = global.requestAnimationFrame(function () {
                    frame = null;
                    if (signal.aborted) return;
                    if (!canDepth()) { resetDepth(); return; }
                    home.style.setProperty('--home-depth-x', depthX.toFixed(2) + 'px');
                    home.style.setProperty('--home-depth-y', depthY.toFixed(2) + 'px');
                });
            }, { signal: signal });
            global.addEventListener('resize', function () {
                if (pointerInside) measureBounds();
                resetDepth();
            }, { signal: signal });

            if (typeof global.IntersectionObserver === 'function') {
                try {
                    observer = new global.IntersectionObserver(function (entries) {
                        if (signal.aborted) return;
                        entries.forEach(function (entry) {
                            if (entry.target === hero) heroVisible = !!entry.isIntersecting;
                        });
                        updateSuspension();
                    }, { threshold: 0 });
                    observer.observe(hero);
                } catch (_) {
                    if (observer) observer.disconnect();
                    observer = null;
                }
            }
            // Without visibility observation, decoration stays still rather than running offscreen.
        }
        signal.addEventListener('abort', function () {
            resetDepth();
            if (observer) observer.disconnect();
            home.dataset.motionSuspended = 'true';
        }, { once: true });

        function unavailable() {
            if (signal.aborted || !feedback) return;
            var english = global.NamelessI18n && global.NamelessI18n.getLanguage() === 'en';
            feedback.textContent = english ? 'Search is loading. Try again in a moment.' : 'La recherche se charge. Réessayez dans un instant.';
        }

        home.querySelectorAll('[data-home-search]').forEach(function (button) {
            button.addEventListener('click', function () {
                if (feedback) feedback.textContent = '';
                if (global.NamelessGlobalSearch && typeof global.NamelessGlobalSearch.open === 'function') {
                    try {
                        var result = global.NamelessGlobalSearch.open();
                        if (result && typeof result.catch === 'function') result.catch(unavailable);
                    } catch (_) { unavailable(); }
                    return;
                }
                var trigger = document.querySelector('.nm-search-trigger');
                if (trigger) trigger.click();
                else unavailable();
            }, { signal: signal });
        });
    }

    global.NamelessHomePage = { init: init, destroy: destroy };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { init(document); }, { once: true });
    } else init(document);
})(window);
