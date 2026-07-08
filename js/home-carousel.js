/* ============================================================
   NAMELESS - Home page lifecycle
   - Carousel for direct page loads and SPA navigations.
   - Reveal effects can be re-run when the home view is injected.
   ============================================================ */
(function () {
    'use strict';

    var activeControllers = [];
    var activeRevealObserver = null;

    function cleanup() {
        activeControllers.forEach(function (controller) {
            if (controller && typeof controller.destroy === 'function') controller.destroy();
        });
        activeControllers = [];

        if (activeRevealObserver && typeof activeRevealObserver.disconnect === 'function') {
            activeRevealObserver.disconnect();
        }
        activeRevealObserver = null;
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
            if (reduce || slides.length <= 1) return;
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
        start();

        return {
            destroy: function () {
                stop();
                controller.abort();
            }
        };
    }

    function initReveal(root) {
        var revealEls = Array.prototype.slice.call(root.querySelectorAll('.nm-reveal'));
        if (!revealEls.length) return null;

        var reduce = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (reduce || !('IntersectionObserver' in window)) {
            revealEls.forEach(function (el) {
                el.style.opacity = '1';
                el.style.transform = 'none';
            });
            return null;
        }

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry, i) {
                if (!entry.isIntersecting) return;
                window.setTimeout(function () {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, i * 90);
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });

        revealEls.forEach(function (el) {
            el.style.transition = 'opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)';
            observer.observe(el);
        });

        return observer;
    }

    function initHome(root) {
        cleanup();
        var scope = root && root.querySelector ? root : document;
        var carousels = scope.querySelectorAll('[data-carousel]');
        Array.prototype.forEach.call(carousels, function (carousel) {
            var controller = initCarousel(carousel);
            if (controller) activeControllers.push(controller);
        });
        activeRevealObserver = initReveal(scope);
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
