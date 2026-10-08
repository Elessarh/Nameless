/* Keep the existing path for old cached route registries.
   Home now offers visible links instead of rotating slides. */
(function (global) {
    'use strict';
    var controller = null;
    var motionPaused = false;

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
        var reducedMotion = typeof global.matchMedia === 'function' ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;

        function updateMotion() {
            var reduce = reducedMotion && reducedMotion.matches;
            var paused = motionPaused || reduce;
            home.dataset.motionPaused = String(!!paused);
            if (!motionButton) return;
            var english = global.NamelessI18n && global.NamelessI18n.getLanguage() === 'en';
            motionButton.disabled = !!reduce;
            motionButton.setAttribute('aria-pressed', String(!!paused));
            motionButton.setAttribute('aria-label', reduce ? (english ? 'Still scenery (reduced motion)' : 'Décor fixe (mouvements réduits)') : paused ? (english ? 'Resume scenery' : 'Animer le décor') : (english ? 'Pause scenery' : 'Pause du décor'));
            var label = motionButton.querySelector('[data-home-motion-label]');
            if (label) label.textContent = reduce ? (english ? 'Still scenery' : 'Décor fixe') : paused ? (english ? 'Resume scenery' : 'Animer le décor') : (english ? 'Pause scenery' : 'Pause du décor');
        }
        updateMotion();
        if (motionButton) motionButton.addEventListener('click', function () { motionPaused = !motionPaused; updateMotion(); }, { signal: signal });
        document.addEventListener('nameless:languagechange', updateMotion, { signal: signal });
        if (reducedMotion) {
            if (reducedMotion.addEventListener) {
                reducedMotion.addEventListener('change', updateMotion);
                signal.addEventListener('abort', function () { reducedMotion.removeEventListener('change', updateMotion); }, { once: true });
            } else if (reducedMotion.addListener) {
                reducedMotion.addListener(updateMotion);
                signal.addEventListener('abort', function () { reducedMotion.removeListener(updateMotion); }, { once: true });
            }
        }

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
