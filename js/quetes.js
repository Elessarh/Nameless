// quetes.js - Quetes d'Aincrad (refonte Nameless)
// Lifecycle-compatible page module for direct multi-page loads and SPA views.
(function () {
    'use strict';

    var activeInstance = null;

    class QuestSystem {
        constructor(root) {
            this.root = root && root.querySelector ? root : document;
            this.container = null;
            this.paginationEl = null;
            this.emptyEl = null;
            this.controller = new AbortController();
            this.questsPerPage = 8;
            this.currentPage = 1;
            this.currentTier = '1';
            this.currentFilter = 'all';
            this.search = '';
            this.allQuests = [];
            this.filtered = [];
        }

        $(selector) {
            if (this.root.matches && this.root.matches(selector)) return this.root;
            return this.root.querySelector(selector);
        }

        $all(selector) {
            return Array.prototype.slice.call(this.root.querySelectorAll(selector));
        }

        on(target, type, handler, options) {
            if (!target) return;
            options = options || {};
            options.signal = this.controller.signal;
            target.addEventListener(type, handler, options);
        }

        setup() {
            this.container = this.$('.quetes-container') || this.root;
            this.paginationEl = this.$('.quest-pagination');

            if (!this.container || !this.$('.quest-section')) return;

            var tierSelect = this.$('#tier-select');
            if (tierSelect) this.currentTier = tierSelect.value || '1';

            this.loadQuests();
            this.wireControls();
            this.applyFilters();
            this.render();
        }

        destroy() {
            this.controller.abort();
            if (this.emptyEl && this.emptyEl.parentNode) {
                this.emptyEl.parentNode.removeChild(this.emptyEl);
            }
            this.emptyEl = null;
            this.allQuests = [];
            this.filtered = [];
        }

        loadQuests() {
            this.allQuests = [];
            this.$all('.quest-section .quest-step').forEach(function (step) {
                var section = step.closest('.quest-section');
                var group = step.closest('.secondary-quest-group, .quest-step-group');
                this.allQuests.push({
                    el: step,
                    section: section,
                    group: group,
                    tier: section ? section.getAttribute('data-tier') : '1',
                    category: section ? section.getAttribute('data-category') : '',
                    text: (step.textContent || '').toLowerCase()
                });
            }, this);
        }

        wireControls() {
            var filterBtns = this.$all('.quest-filter-btn');
            filterBtns.forEach(function (btn) {
                this.on(btn, 'click', function () {
                    filterBtns.forEach(function (b) { b.classList.remove('active'); });
                    btn.classList.add('active');
                    this.currentFilter = btn.getAttribute('data-filter') || 'all';
                    this.currentPage = 1;
                    this.applyFilters();
                    this.render();
                }.bind(this));
            }, this);

            var tierSelect = this.$('#tier-select');
            this.on(tierSelect, 'change', function () {
                this.currentTier = tierSelect.value;
                this.currentPage = 1;
                this.applyFilters();
                this.render();
            }.bind(this));

            var searchInput = this.$('#quest-search-input');
            this.on(searchInput, 'input', function () {
                this.search = searchInput.value.trim().toLowerCase();
                this.currentPage = 1;
                this.applyFilters();
                this.render();
            }.bind(this));

            this.on(this.paginationEl, 'click', function (event) {
                var btn = event.target.closest('[data-page]');
                if (!btn || btn.disabled) return;
                var page = parseInt(btn.dataset.page, 10);
                if (!isNaN(page)) this.goToPage(page);
            }.bind(this));

            this.on(this.container, 'click', function (event) {
                var coord = event.target.closest('.coordinates');
                if (!coord) return;
                event.preventDefault();
                var x = coord.getAttribute('data-x');
                var y = coord.getAttribute('data-y');
                var section = coord.closest('.quest-section');
                var tier = section ? section.getAttribute('data-tier') : '1';
                if (x && y) {
                    var target = '/carte?x=' + encodeURIComponent(x) +
                        '&y=' + encodeURIComponent(y) + '&floor=' + encodeURIComponent(tier);
                    if (window.NamelessSpaRouter && typeof window.NamelessSpaRouter.navigate === 'function') {
                        window.NamelessSpaRouter.navigate('/carte', { url: target });
                    } else {
                        window.location.href = target;
                    }
                }
            }.bind(this));
        }

        applyFilters() {
            this.filtered = this.allQuests.filter(function (quest) {
                var okTier = quest.tier === this.currentTier;
                var okCat = this.currentFilter === 'all' || quest.category === this.currentFilter;
                var okSearch = !this.search || quest.text.indexOf(this.search) !== -1;
                return okTier && okCat && okSearch;
            }, this);
        }

        render() {
            this.$all('.quest-section').forEach(function (section) { section.style.display = 'none'; });
            this.$all('.secondary-quest-group, .quest-step-group').forEach(function (group) { group.style.display = 'none'; });
            this.allQuests.forEach(function (quest) { quest.el.style.display = 'none'; });

            this.updateTierIndicator();

            if (this.filtered.length === 0) {
                this.showEmpty();
                this.renderPagination();
                return;
            }

            this.hideEmpty();

            var total = Math.ceil(this.filtered.length / this.questsPerPage);
            if (this.currentPage > total) this.currentPage = total;
            var start = (this.currentPage - 1) * this.questsPerPage;
            var pageQuests = this.filtered.slice(start, start + this.questsPerPage);
            var sections = new Set();
            var groups = new Set();

            pageQuests.forEach(function (quest) {
                quest.el.style.display = 'block';
                if (quest.section) sections.add(quest.section);
                if (quest.group) groups.add(quest.group);
            });

            sections.forEach(function (section) { section.style.display = 'block'; });
            groups.forEach(function (group) { group.style.display = 'block'; });
            this.renderPagination();
        }

        renderPagination() {
            var el = this.paginationEl;
            if (!el) return;
            el.replaceChildren();

            var total = Math.ceil(this.filtered.length / this.questsPerPage);
            if (total <= 1) return;

            var info = document.createElement('div');
            info.className = 'pagination-info';
            info.textContent = 'Page ' + this.currentPage + ' sur ' + total +
                ' (' + this.filtered.length + ' quête' + (this.filtered.length > 1 ? 's' : '') + ')';
            el.appendChild(info);

            var controls = document.createElement('div');
            controls.className = 'pagination-controls';
            controls.appendChild(this.makePageButton('‹', this.currentPage - 1, { disabled: this.currentPage === 1 }));

            var maxShow = 7;
            var startPage = Math.max(1, this.currentPage - Math.floor(maxShow / 2));
            var endPage = Math.min(total, startPage + maxShow - 1);
            if (endPage - startPage < maxShow - 1) startPage = Math.max(1, endPage - maxShow + 1);

            if (startPage > 1) {
                controls.appendChild(this.makePageButton('1', 1));
                if (startPage > 2) controls.appendChild(this.makeEllipsis());
            }

            for (var i = startPage; i <= endPage; i++) {
                controls.appendChild(this.makePageButton(String(i), i, { active: i === this.currentPage }));
            }

            if (endPage < total) {
                if (endPage < total - 1) controls.appendChild(this.makeEllipsis());
                controls.appendChild(this.makePageButton(String(total), total));
            }

            controls.appendChild(this.makePageButton('›', this.currentPage + 1, { disabled: this.currentPage === total }));
            el.appendChild(controls);
        }

        makePageButton(label, page, opts) {
            opts = opts || {};
            var button = document.createElement('button');
            button.className = 'pagination-btn' + (opts.active ? ' active' : '');
            button.textContent = label;
            if (opts.disabled) button.disabled = true;
            else button.dataset.page = String(page);
            return button;
        }

        makeEllipsis() {
            var span = document.createElement('span');
            span.className = 'pagination-ellipsis';
            span.textContent = '…';
            return span;
        }

        goToPage(page) {
            var total = Math.ceil(this.filtered.length / this.questsPerPage);
            if (page < 1 || page > total) return;
            this.currentPage = page;
            this.render();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        updateTierIndicator() {
            var indicator = this.$('#quests-tier-indicator');
            if (indicator) indicator.textContent = 'Palier ' + this.currentTier + ' sélectionné';
        }

        showEmpty() {
            if (!this.emptyEl) {
                this.emptyEl = document.createElement('div');
                this.emptyEl.className = 'quests-empty';
                this.emptyEl.appendChild(document.createElement('h3'));
                this.emptyEl.appendChild(document.createElement('p'));
                if (this.paginationEl && this.paginationEl.parentNode) {
                    this.paginationEl.parentNode.insertBefore(this.emptyEl, this.paginationEl.nextSibling);
                } else {
                    this.container.appendChild(this.emptyEl);
                }
            }

            var h = this.emptyEl.querySelector('h3');
            var p = this.emptyEl.querySelector('p');
            if (this.search) {
                h.textContent = 'Aucune quête trouvée';
                p.textContent = 'Aucun résultat pour « ' + this.search + ' » au palier ' + this.currentTier + '.';
            } else {
                h.textContent = 'Palier ' + this.currentTier + ' en préparation';
                p.textContent = 'Les quêtes de ce palier arrivent bientôt. Paliers disponibles : 1 et 2.';
            }
            this.emptyEl.style.display = 'block';
        }

        hideEmpty() {
            if (this.emptyEl) this.emptyEl.style.display = 'none';
        }
    }

    function init(root) {
        destroy();
        var scope = root && root.querySelector ? root : document;
        if (!scope.querySelector('.quest-section') && !(scope.matches && scope.matches('.quetes-container'))) return null;
        activeInstance = new QuestSystem(scope);
        activeInstance.setup();
        window.questSystem = activeInstance;
        return activeInstance;
    }

    function destroy() {
        if (activeInstance && typeof activeInstance.destroy === 'function') activeInstance.destroy();
        activeInstance = null;
        if (window.questSystem) window.questSystem = null;
    }

    window.NamelessQuestPage = {
        init: init,
        destroy: destroy
    };

    function autoStart() {
        if (window.NamelessSpaRouter && window.NamelessSpaRouter.controlsLifecycle) return;
        init(document);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoStart);
    } else {
        autoStart();
    }
})();
