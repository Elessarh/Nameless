/* ============================================
   WIKI PAGE — JavaScript
   Sidebar navigation, search, collapsible groups
   Lifecycle-compatible (direct load + SPA views).
   ============================================ */

(function () {
    'use strict';

    let wikiController = null;
    let searchTimeout = null;
    let closeActiveSidebar = null;
    const normalizeSearch = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const scrollBehavior = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

    function initWiki(root) {
        destroyWiki();

        // --- DOM refs ---
        const sidebar = document.getElementById('wiki-sidebar');
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const sidebarOverlay = document.getElementById('sidebar-overlay');
        const searchInput = document.getElementById('wiki-search');
        const searchResults = document.getElementById('wiki-search-results');
        const navContainer = document.getElementById('wiki-nav');
        const wikiContent = document.querySelector('.wiki-content');
        let sidebarOpen = false;
        let sidebarOverflow = '';
        let contentInert = false;

        // Rien à faire si la vue Wiki n'est pas présente
        if (!navContainer && !searchInput && !document.querySelector('.wiki-page')) return;

        wikiController = new AbortController();
        const opts = { signal: wikiController.signal };

        // --- All pages ---
        const allPages = document.querySelectorAll('.wiki-page');
        const allNavLinks = document.querySelectorAll('[data-page]');

        allPages.forEach(page => {
            const breadcrumb = page.querySelector('.wiki-breadcrumb');
            if (breadcrumb) { breadcrumb.setAttribute('role', 'navigation'); breadcrumb.setAttribute('aria-label', "Fil d'Ariane"); }
            const headings = Array.from(page.querySelectorAll('h2, h3'));
            if (headings.length < 3 || page.querySelector('.wiki-toc')) return;
            const toc = document.createElement('nav');
            toc.className = 'wiki-toc';
            toc.setAttribute('aria-label', 'Dans cet article');
            const title = document.createElement('strong'); title.textContent = 'Dans cet article'; toc.appendChild(title);
            const list = document.createElement('ul');
            headings.forEach((heading, index) => {
                if (!heading.id) heading.id = page.id + '-section-' + (index + 1);
                const row = document.createElement('li');
                const link = document.createElement('a');
                link.href = '#' + page.id.replace('page-', '') + '/' + heading.id;
                link.textContent = heading.textContent.trim();
                row.appendChild(link); list.appendChild(row);
            });
            toc.appendChild(list);
            page.querySelector('h1')?.after(toc);
        });

        // Build search index from page content
        const searchIndex = [];
        allPages.forEach(page => {
            const id = page.id.replace('page-', '');
            const title = page.querySelector('h1')?.textContent || id;
            const text = page.textContent || '';
            // Find the nav link label for this page
            const navLink = document.querySelector(`[data-page="${id}"]`);
            const section = navLink?.closest('.wiki-nav-group')?.querySelector('.wiki-nav-group-header')?.textContent?.replace('▼', '').trim() || '';
            searchIndex.push({ id, title, text: normalizeSearch(text), section });
        });

        // --- Page Navigation ---
        function navigateTo(pageId, pushState = true, sectionId = null) {
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
                    link.setAttribute('aria-current', 'page');
                } else {
                    link.classList.remove('active');
                    link.removeAttribute('aria-current');
                }
            });

            // Expand parent group if collapsed
            const activeLink = document.querySelector(`[data-page="${pageId}"]`);
            if (activeLink) {
                const group = activeLink.closest('.wiki-nav-group');
                if (group && group.classList.contains('collapsed')) {
                    group.classList.remove('collapsed');
                    const children = group.querySelector('.wiki-nav-group-children');
                    if (children) { children.hidden = false; children.style.maxHeight = children.scrollHeight + 'px'; }
                    group.querySelector('.wiki-nav-group-header')?.setAttribute('aria-expanded', 'true');
                }
                // Scroll nav to show active item
                activeLink.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() });
            }

            // Update URL hash
            if (pushState) {
                history.pushState(history.state, '', '#' + pageId + (sectionId ? '/' + sectionId : ''));
            }

            // Close mobile sidebar
            closeSidebar();

            // Scroll content to top
            const heading = sectionId ? document.getElementById(sectionId) : document.getElementById('page-' + pageId)?.querySelector('h1');
            if (heading && document.getElementById('page-' + pageId)?.contains(heading)) {
                heading.tabIndex = -1;
                heading.focus({ preventScroll: true });
                if (sectionId) heading.scrollIntoView({ block: 'start', behavior: scrollBehavior() });
                else window.scrollTo({ top: 0, behavior: scrollBehavior() });
            }
        }

        // --- Click handlers for nav links ---
        allNavLinks.forEach(link => {
            link.addEventListener('click', e => {
                if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button > 0) return;
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
        document.querySelectorAll('[data-goto]').forEach(card => {
            card.tabIndex = 0;
            card.setAttribute('role', 'button');
            card.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateTo(card.dataset.goto); }
            }, opts);
        });

        // --- Collapsible Groups ---
        document.querySelectorAll('.wiki-nav-group-header').forEach(header => {
            const group = header.parentElement;
            const children = group.querySelector('.wiki-nav-group-children');
            if (!children) return;

            // Set initial max-height
            children.style.maxHeight = children.scrollHeight + 'px';
            children.hidden = group.classList.contains('collapsed');
            header.setAttribute('aria-expanded', children.hidden ? 'false' : 'true');

            header.addEventListener('click', () => {
                group.classList.toggle('collapsed');
                children.hidden = group.classList.contains('collapsed');
                header.setAttribute('aria-expanded', children.hidden ? 'false' : 'true');
                if (group.classList.contains('collapsed')) {
                    children.style.maxHeight = '0';
                } else {
                    children.style.maxHeight = children.scrollHeight + 'px';
                }
            }, opts);
        });

        // --- Search ---
        function performSearch() {
            const query = normalizeSearch(searchInput.value);
            // Rendu 100% DOM (createElement/textContent) — pas d'innerHTML avec du
            // contenu, même issu du wiki statique.
            searchResults.innerHTML = '';
            if (query.length < 2) {
                searchResults.classList.remove('active');
                searchInput.setAttribute('aria-expanded', 'false');
                return;
            }

            const results = searchIndex.filter(item =>
                normalizeSearch(item.title).includes(query) || item.text.includes(query)
            ).slice(0, 10);

            if (results.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'wiki-search-result-item is-empty';
                empty.textContent = 'Aucun résultat';
                searchResults.appendChild(empty);
            } else {
                results.forEach(r => {
                    const item = document.createElement('button');
                    item.type = 'button';
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
                        searchInput.setAttribute('aria-expanded', 'false');
                        searchInput.value = '';
                    }, opts);
                    item.addEventListener('keydown', e => {
                        if (e.key === 'ArrowDown') { e.preventDefault(); item.nextElementSibling?.focus(); }
                        if (e.key === 'ArrowUp') { e.preventDefault(); (item.previousElementSibling || searchInput).focus(); }
                        if (e.key === 'Escape') { searchResults.classList.remove('active'); searchInput.setAttribute('aria-expanded', 'false'); searchInput.focus(); }
                    }, opts);
                    searchResults.appendChild(item);
                });
            }
            searchResults.classList.add('active');
            searchInput.setAttribute('aria-expanded', 'true');
        }

        if (searchInput) {
            searchInput.setAttribute('aria-controls', 'wiki-search-results');
            searchInput.setAttribute('aria-expanded', 'false');
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
                    searchInput.setAttribute('aria-expanded', 'false');
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    searchResults.querySelector('button')?.focus();
                }
            }, opts);
        }

        document.addEventListener('click', e => {
            if (!e.target.closest('.wiki-search-wrapper')) {
                if (searchResults) searchResults.classList.remove('active');
                searchInput?.setAttribute('aria-expanded', 'false');
            }
        }, opts);

        // --- Mobile sidebar ---
        function openSidebar() {
            if (!sidebar || window.innerWidth > 900 || sidebarOpen) return;
            sidebarOpen = true;
            sidebarOverflow = document.body.style.overflow;
            if (wikiContent) { contentInert = wikiContent.inert; wikiContent.inert = true; }
            sidebar.classList.add('open');
            sidebar.inert = false;
            sidebarOverlay.classList.add('active');
            sidebarToggle?.setAttribute('aria-expanded', 'true');
            document.body.style.overflow = 'hidden';
            searchInput?.focus();
        }

        function closeSidebar(restoreFocus = false) {
            if (sidebar) sidebar.classList.remove('open');
            if (sidebar) sidebar.inert = window.innerWidth <= 900;
            if (sidebarOverlay) sidebarOverlay.classList.remove('active');
            sidebarToggle?.setAttribute('aria-expanded', 'false');
            if (sidebarOpen) {
                sidebarOpen = false;
                document.body.style.overflow = sidebarOverflow;
                if (wikiContent) wikiContent.inert = contentInert;
                if (restoreFocus) sidebarToggle?.focus();
            }
        }
        closeActiveSidebar = closeSidebar;

        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                if (sidebar.classList.contains('open')) {
                    closeSidebar(true);
                } else {
                    openSidebar();
                }
            }, opts);
        }

        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => closeSidebar(true), opts);
        }
        if (sidebar) sidebar.inert = window.innerWidth <= 900;
        document.addEventListener('keydown', e => {
            if (!sidebarOpen || (e.target.closest && e.target.closest('dialog[open]'))) return;
            if (e.key === 'Escape') { e.preventDefault(); closeSidebar(true); }
            if (e.key === 'Tab') {
                const controls = Array.from(sidebar.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]'))
                    .filter(control => control.tabIndex >= 0 && !control.closest('[hidden], .wiki-search-results:not(.active)'));
                if (sidebarToggle) controls.push(sidebarToggle);
                const first = controls[0], last = controls[controls.length - 1];
                const outside = !sidebar.contains(document.activeElement) && document.activeElement !== sidebarToggle;
                if (e.shiftKey && (document.activeElement === first || outside)) { e.preventDefault(); last?.focus(); }
                else if (!e.shiftKey && (document.activeElement === last || outside)) { e.preventDefault(); first?.focus(); }
            }
        }, opts);
        window.addEventListener('resize', () => {
            if (window.innerWidth > 900) closeSidebar();
            if (sidebar) sidebar.inert = window.innerWidth <= 900 && !sidebarOpen;
        }, opts);

        // --- Hash navigation on load ---
        function handleHash() {
            const hash = location.hash.replace('#', '');
            if (hash) {
                const [pageId, sectionId] = hash.split('/');
                navigateTo(pageId, false, sectionId);
            } else {
                navigateTo('accueil', false);
            }
        }

        window.addEventListener('hashchange', () => handleHash(), opts);
        document.addEventListener('nameless:routechange', handleHash, opts);
        handleHash();
    }

    function destroyWiki() {
        if (closeActiveSidebar) { closeActiveSidebar(); closeActiveSidebar = null; }
        if (wikiController) { wikiController.abort(); wikiController = null; }
        if (searchTimeout) { clearTimeout(searchTimeout); searchTimeout = null; }
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
