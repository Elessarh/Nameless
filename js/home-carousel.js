/* ============================================================
   NAMELESS - Home page lifecycle
   - Carousel for direct page loads and SPA navigations.
   - Page content is visible immediately, without scroll-triggered reveals.
   ============================================================ */
(function () {
    'use strict';

    var activeControllers = [];

    function cleanup() {
        activeControllers.forEach(function (controller) {
            if (controller && typeof controller.destroy === 'function') controller.destroy();
        });
        activeControllers = [];
    }

    function initCarousel(root) {
        var track = root.querySelector('[data-carousel-track]');
        var prevBtn = root.querySelector('[data-carousel-prev]');
        var nextBtn = root.querySelector('[data-carousel-next]');
        var dotsWrap = root.querySelector('[data-carousel-dots]');
        if (!track) return null;

        var controller = new AbortController();
        var signal = controller.signal;
        var slides = Array.prototype.slice.call(track.children);
        var index = 0;
        var timer = null;
        var autoplayMs = 7000;
        var reduce = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (slides.length <= 1) {
            if (prevBtn) prevBtn.style.display = 'none';
            if (nextBtn) nextBtn.style.display = 'none';
        }

        var dots = [];
        if (dotsWrap) {
            dotsWrap.replaceChildren();
            slides.forEach(function (_slide, i) {
                var dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'nm-carousel-dot';
                dot.setAttribute('role', 'tab');
                dot.setAttribute('aria-label', 'Diapositive ' + (i + 1));
                dot.addEventListener('click', function () { go(i, true); }, { signal: signal });
                dotsWrap.appendChild(dot);
                dots.push(dot);
            });
        }

        function render() {
            track.style.transform = 'translateX(-' + (index * 100) + '%)';
            slides.forEach(function (slide, i) {
                slide.setAttribute('aria-hidden', i !== index ? 'true' : 'false');
                slide.inert = i !== index;
            });
            dots.forEach(function (dot, i) {
                var active = i === index;
                dot.setAttribute('aria-selected', active ? 'true' : 'false');
                dot.tabIndex = active ? 0 : -1;
            });
        }

        function go(target, userAction) {
            var n = slides.length;
            if (!n) return;
            index = ((target % n) + n) % n;
            render();
            if (userAction) restart();
        }

        function start() {
            if (reduce || pausedByUser || slides.length <= 1) return;
            stop();
            timer = window.setInterval(function () { go(index + 1, false); }, autoplayMs);
        }

        function stop() {
            if (timer) {
                window.clearInterval(timer);
                timer = null;
            }
        }

        function restart() {
            stop();
            start();
        }

        if (prevBtn) prevBtn.addEventListener('click', function () { go(index - 1, true); }, { signal: signal });
        if (nextBtn) nextBtn.addEventListener('click', function () { go(index + 1, true); }, { signal: signal });

        root.addEventListener('keydown', function (event) {
            if (event.key === 'ArrowLeft') {
                go(index - 1, true);
                event.preventDefault();
            } else if (event.key === 'ArrowRight') {
                go(index + 1, true);
                event.preventDefault();
            }
        }, { signal: signal });

        root.addEventListener('mouseenter', stop, { signal: signal });
        root.addEventListener('mouseleave', start, { signal: signal });
        root.addEventListener('focusin', stop, { signal: signal });
        root.addEventListener('focusout', start, { signal: signal });
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) stop();
            else start();
        }, { signal: signal });

        render();
        var pause = document.createElement('button');
        var pausedByUser = false;
        pause.type = 'button';
        pause.className = 'nm-carousel-pause';
        pause.dataset.i18nIgnore = '';
        function pauseLabel() {
            var en = window.NamelessI18n && window.NamelessI18n.getLanguage() === 'en';
            pause.textContent = pausedByUser ? (en ? 'Resume slides' : 'Reprendre le défilement') : (en ? 'Pause slides' : 'Suspendre le défilement');
            pause.setAttribute('aria-pressed', String(pausedByUser));
        }
        pause.addEventListener('click', function () {pausedByUser = !pausedByUser; pausedByUser ? stop() : start(); pauseLabel();}, {signal:signal});
        document.addEventListener('nameless:languagechange', pauseLabel, {signal:signal});
        root.appendChild(pause);
        pauseLabel();
        start();

        return {
            destroy: function () {
                stop();
                controller.abort();
                pause.remove();
            }
        };
    }

    function showContent(root) {
        Array.prototype.forEach.call(root.querySelectorAll('.nm-reveal'), function (element) {
            element.style.opacity = '1';
            element.style.transform = 'none';
            element.style.transition = 'none';
        });
    }

    function initHome(root) {
        cleanup();
        var scope = root && root.querySelector ? root : document;
        var carousels = scope.querySelectorAll('[data-carousel]');
        Array.prototype.forEach.call(carousels, function (carousel) {
            var controller = initCarousel(carousel);
            if (controller) activeControllers.push(controller);
        });
        showContent(scope);
    }

    window.NamelessHomePage = {
        init: initHome,
        destroy: cleanup
    };

    document.addEventListener('DOMContentLoaded', function () {
        if (!document.querySelector('[data-carousel]')) return;
        initHome(document);
    });
})();
