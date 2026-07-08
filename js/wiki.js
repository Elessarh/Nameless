/* ============================================
   WIKI PAGE — JavaScript
   Sidebar navigation, search, collapsible groups
   Lifecycle-compatible (direct load + SPA views).
   ============================================ */

(function () {
    'use strict';

    let wikiController = null;
    let searchTimeout = null;

    function initWiki(root) {
        destroyWiki();

        // --- DOM refs ---
        const sidebar = document.getElementById('wiki-sidebar');
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const sidebarOverlay = document.getElementById('sidebar-overlay');
        const searchInput = document.getElementById('wiki-search');
        const searchResults = document.getElementById('wiki-search-results');
        const navContainer = document.getElementById('wiki-nav');

        // Rien à faire si la vue Wiki n'est pas présente
        if (!navContainer && !searchInput && !document.querySelector('.wiki-page')) return;

        wikiController = new AbortController();
        const opts = { signal: wikiController.signal };

        // --- All pages ---
        const allPages = document.querySelectorAll('.wiki-page');
        const allNavLinks = document.querySelectorAll('[data-page]');

        // Build search index from page content
        const searchIndex = [];
        allPages.forEach(page => {
            const id = page.id.replace('page-', '');
            const title = page.querySelector('h1')?.textContent || id;
            const text = page.textContent || '';
            // Find the nav link label for this page
            const navLink = document.querySelector(`[data-page="${id}"]`);
            const section = navLink?.closest('.wiki-nav-group')?.querySelector('.wiki-nav-group-header')?.textContent?.replace('▼', '').trim() || '';
            searchIndex.push({ id, title, text: text.toLowerCase(), section });
        });

        // --- Page Navigation ---
        function navigateTo(pageId, pushState = true) {
            // Hide all pages
            allPages.forEach(p => p.classList.remove('active'));
            // Show target
            const target = document.getElementById('page-' + pageId);
            if (target) {
                target.classList.add('active');
            } else {
                // Fallback to accueil
                document.getElementById('page-accueil')?.classList.add('active');
                pageId = 'accueil';
            }

            // Update nav active state
            allNavLinks.forEach(link => {
                if (link.dataset.page === pageId) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });

            // Expand parent group if collapsed
            const activeLink = document.querySelector(`[data-page="${pageId}"]`);
            if (activeLink) {
                const group = activeLink.closest('.wiki-nav-group');
                if (group && group.classList.contains('collapsed')) {
                    group.classList.remove('collapsed');
                    const children = group.querySelector('.wiki-nav-group-children');
                    if (children) children.style.maxHeight = children.scrollHeight + 'px';
                }
                // Scroll nav to show active item
                activeLink.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }

            // Update URL hash
            if (pushState) {
                history.pushState(null, '', '#' + pageId);
            }

            // Close mobile sidebar
            closeSidebar();

            // Scroll content to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // --- Click handlers for nav links ---
        allNavLinks.forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                const pageId = link.dataset.page;
                if (pageId) navigateTo(pageId);
            }, opts);
        });

        // --- Click handlers for data-goto cards ---
        document.addEventListener('click', e => {
            const gotoEl = e.target.closest('[data-goto]');
            if (gotoEl) {
                e.preventDefault();
                navigateTo(gotoEl.dataset.goto);
            }
        }, opts);

        // --- Collapsible Groups ---
        document.querySelectorAll('.wiki-nav-group-header').forEach(header => {
            const group = header.parentElement;
            const children = group.querySelector('.wiki-nav-group-children');
            if (!children) return;

            // Set initial max-height
            children.style.maxHeight = children.scrollHeight + 'px';

            header.addEventListener('click', () => {
                group.classList.toggle('collapsed');
                if (group.classList.contains('collapsed')) {
                    children.style.maxHeight = '0';
                } else {
                    children.style.maxHeight = children.scrollHeight + 'px';
                }
            }, opts);
        });

        // --- Search ---
        function performSearch() {
            const query = searchInput.value.trim().toLowerCase();
            // Rendu 100% DOM (createElement/textContent) — pas d'innerHTML avec du
            // contenu, même issu du wiki statique.
            searchResults.innerHTML = '';
            if (query.length < 2) {
                searchResults.classList.remove('active');
                return;
            }

            const results = searchIndex.filter(item =>
                item.title.toLowerCase().includes(query) || item.text.includes(query)
            ).slice(0, 10);

            if (results.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'wiki-search-result-item is-empty';
                empty.textContent = 'Aucun résultat';
                searchResults.appendChild(empty);
            } else {
                results.forEach(r => {
                    const item = document.createElement('div');
                    item.className = 'wiki-search-result-item';
                    item.dataset.page = r.id;
                    item.appendChild(document.createTextNode(r.title));
                    if (r.section) {
                        const sec = document.createElement('span');
                        sec.className = 'result-section';
                        sec.textContent = r.section;
                        item.appendChild(sec);
                    }
                    item.addEventListener('click', () => {
                        navigateTo(item.dataset.page);
                        searchResults.classList.remove('active');
                        searchInput.value = '';
                    }, opts);
                    searchResults.appendChild(item);
                });
            }
            searchResults.classList.add('active');
        }

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(performSearch, 150);
            }, opts);

            searchInput.addEventListener('focus', () => {
                if (searchInput.value.trim().length >= 2) performSearch();
            }, opts);

            searchInput.addEventListener('keydown', e => {
                if (e.key === 'Escape') {
                    searchResults.classList.remove('active');
                    searchInput.blur();
                }
            }, opts);
        }

        document.addEventListener('click', e => {
            if (!e.target.closest('.wiki-search-wrapper')) {
                if (searchResults) searchResults.classList.remove('active');
            }
        }, opts);

        // --- Mobile sidebar ---
        function openSidebar() {
            sidebar.classList.add('open');
            sidebarOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closeSidebar() {
            if (sidebar) sidebar.classList.remove('open');
            if (sidebarOverlay) sidebarOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }

        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                if (sidebar.classList.contains('open')) {
                    closeSidebar();
                } else {
                    openSidebar();
                }
            }, opts);
        }

        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', closeSidebar, opts);
        }

        // --- Hash navigation on load ---
        function handleHash() {
            const hash = location.hash.replace('#', '');
            if (hash) {
                navigateTo(hash, false);
            }
        }

        window.addEventListener('hashchange', () => handleHash(), opts);
        handleHash();
    }

    function destroyWiki() {
        if (wikiController) { wikiController.abort(); wikiController = null; }
        if (searchTimeout) { clearTimeout(searchTimeout); searchTimeout = null; }
        document.body.style.overflow = '';
    }

    window.NamelessWikiPage = { init: initWiki, destroy: destroyWiki };

    function autoStart() {
        if (window.NamelessSpaRouter && window.NamelessSpaRouter.controlsLifecycle) return;
        initWiki(document);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoStart);
    } else {
        autoStart();
    }
})();
