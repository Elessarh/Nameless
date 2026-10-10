/* Wiki codex: genuine article navigation, search and reading landmarks.
   Compatible with direct loads and the SPA view lifecycle. */
(function () {
    'use strict';

    let wikiController = null;
    let searchTimeout = null;
    let closeActiveSidebar = null;
    let sectionObserver = null;
    const normalizeSearch = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const scrollBehavior = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    const t = (fr, en) => window.NamelessI18n?.getLanguage() === 'en' ? en : fr;
    const textOnly = element => {
        if (!element) return '';
        const clone = element.cloneNode(true);
        clone.querySelectorAll('[aria-hidden="true"], .nm-pixel-icon, .nav-emoji, .group-chevron').forEach(icon => icon.remove());
        return clone.textContent.replace(/\s+/g, ' ').trim();
    };
    const generated = (tag, className) => {
        const element = document.createElement(tag);
        element.className = className;
        element.setAttribute('data-i18n-ignore', '');
        return element;
    };

    function initWiki(root) {
        destroyWiki();
        const scope = root && root.querySelector ? root : document;
        const sidebar = scope.querySelector('#wiki-sidebar');
        const sidebarToggle = scope.querySelector('#sidebar-toggle');
        const sidebarOverlay = scope.querySelector('#sidebar-overlay');
        const searchInput = scope.querySelector('#wiki-search');
        const searchResults = scope.querySelector('#wiki-search-results');
        const navContainer = scope.querySelector('#wiki-nav');
        const wikiContent = scope.querySelector('.wiki-content');
        const allPages = Array.from(scope.querySelectorAll('.wiki-page'));
        if (!allPages.length) return;

        // Fresh SPA nodes start in French even when English is already active.
        // Translate the source synchronously before building ignored projections;
        // the i18n MutationObserver runs after this lifecycle initialization.
        window.NamelessI18n?.apply(scope);

        wikiController = new AbortController();
        const opts = { signal: wikiController.signal };
        const pagesById = new Map(allPages.map(page => [page.id.replace(/^page-/, ''), page]));
        const sidebarLinks = Array.from(navContainer?.querySelectorAll('a[data-page]') || []);
        const navById = new Map(sidebarLinks.map(link => [link.dataset.page, link]));
        let searchIndex = [];
        let sidebarOpen = false;
        let sidebarOverflow = '';
        let contentInert = false;
        let lastHash = null;
        let activeArticle = null;
        let activeSection = null;

        // These relationships link existing standalone articles, without invented guides.
        const standaloneRelated = {
            faq: ['premiers-pas', 'aide'],
            devlogs: ['roadmap'],
            roadmap: ['devlogs'],
            races: ['systeme-classe'],
            'familier-monture': ['debuter'],
            aide: ['faq', 'premiers-pas']
        };

        function categoryFor(pageId) {
            const group = navById.get(pageId)?.closest('.wiki-nav-group');
            return textOnly(group?.querySelector('.wiki-nav-group-header')) || t("Guide d'Aincrad", 'Aincrad guide');
        }

        function articleLink(pageId, className) {
            const link = document.createElement('a');
            link.href = '#' + pageId;
            link.dataset.page = pageId;
            if (className) link.className = className;
            return link;
        }

        function articleHeadings(page) {
            return Array.from(page.querySelector('.wiki-article-body')?.querySelectorAll('h2, h3') || []);
        }

        function prepareArticle(page) {
            if (page.id === 'page-accueil') return;
            if (!page.querySelector('.wiki-reading-layout')) {
                // Move the original nodes; translations and existing event handlers retain their identity.
                page.querySelector('.wiki-toc')?.remove();
                const layout = document.createElement('div');
                layout.className = 'wiki-reading-layout';
                const body = document.createElement('div');
                body.className = 'wiki-article-body';
                Array.from(page.childNodes).forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE && (node.matches('.wiki-breadcrumb, h1, .wiki-article-label'))) return;
                    body.appendChild(node);
                });
                layout.appendChild(body);
                page.appendChild(layout);
            }
            if (!page.querySelector('.wiki-article-label')) page.querySelector('h1')?.before(generated('p', 'wiki-article-label'));
            articleHeadings(page).forEach((heading, index) => {
                // Never derive IDs from translated labels: existing public section URLs remain stable.
                if (!heading.id) heading.id = page.id + '-section-' + (index + 1);
            });
            if (!page.querySelector('.wiki-related')) page.appendChild(generated('section', 'wiki-related'));
            if (!page.querySelector('.wiki-article-pagination')) page.appendChild(generated('nav', 'wiki-article-pagination'));
        }

        function refreshArticle(page) {
            const pageId = page.id.replace(/^page-/, '');
            if (pageId === 'accueil') return;
            page.querySelector('.wiki-article-label').textContent = categoryFor(pageId);
            const breadcrumb = page.querySelector('.wiki-breadcrumb');
            if (breadcrumb) {
                breadcrumb.setAttribute('role', 'navigation');
                breadcrumb.setAttribute('aria-label', t("Fil d'Ariane", 'Breadcrumb'));
            }
            const layout = page.querySelector('.wiki-reading-layout');
            const headings = articleHeadings(page);
            let toc = layout.querySelector('.wiki-toc');
            if (headings.length >= 2) {
                if (!toc) { toc = generated('nav', 'wiki-toc'); layout.appendChild(toc); }
                toc.setAttribute('aria-label', t('Dans cet article', 'On this page'));
                const title = document.createElement('strong');
                title.textContent = t('Dans cet article', 'On this page');
                const list = document.createElement('ul');
                headings.forEach(heading => {
                    const row = document.createElement('li');
                    if (heading.tagName === 'H3') row.className = 'wiki-toc-subsection';
                    const link = articleLink(pageId);
                    link.href += '/' + heading.id;
                    link.dataset.section = heading.id;
                    link.textContent = textOnly(heading);
                    row.appendChild(link);
                    list.appendChild(row);
                });
                toc.replaceChildren(title, list);
            } else if (toc) toc.remove();
            layout.classList.toggle('has-toc', headings.length >= 2);

            const group = navById.get(pageId)?.closest('.wiki-nav-group');
            const groupIds = Array.from(group?.querySelectorAll('a[data-page]') || []).map(link => link.dataset.page).filter(id => pagesById.has(id));
            const index = groupIds.indexOf(pageId);
            const relatedIds = (groupIds.length ? groupIds.filter(id => id !== pageId) : standaloneRelated[pageId] || []).filter(id => pagesById.has(id)).slice(0, 3);
            const related = page.querySelector('.wiki-related');
            related.replaceChildren();
            related.hidden = !relatedIds.length;
            if (relatedIds.length) {
                const title = document.createElement('h2');
                title.textContent = t('Poursuivre la lecture', 'Continue reading');
                const links = document.createElement('div');
                links.className = 'wiki-related-links';
                relatedIds.forEach(id => {
                    const link = articleLink(id);
                    const label = document.createElement('small');
                    label.textContent = categoryFor(id);
                    const name = document.createElement('strong');
                    name.textContent = textOnly(pagesById.get(id).querySelector('h1'));
                    link.append(label, name);
                    links.appendChild(link);
                });
                related.append(title, links);
            }
            const pagination = page.querySelector('.wiki-article-pagination');
            pagination.setAttribute('aria-label', t('Navigation entre les guides', 'Guide navigation'));
            pagination.replaceChildren();
            [[groupIds[index - 1], 'prev', t('Guide précédent', 'Previous guide')], [groupIds[index + 1], 'next', t('Guide suivant', 'Next guide')]].forEach(([id, direction, text]) => {
                if (!id || index < 0) return;
                const link = articleLink(id, 'wiki-article-' + direction);
                link.setAttribute('rel', direction);
                const label = document.createElement('small');
                label.textContent = text;
                const name = document.createElement('strong');
                name.textContent = textOnly(pagesById.get(id).querySelector('h1'));
                link.append(label, name);
                pagination.appendChild(link);
            });
            pagination.hidden = !pagination.childElementCount;
        }

        function setActiveSection(page, sectionId) {
            activeSection = sectionId;
            page.querySelectorAll('.wiki-toc a').forEach(link => {
                const active = link.dataset.section === sectionId;
                link.classList.toggle('active', active);
                if (active) link.setAttribute('aria-current', 'location');
                else link.removeAttribute('aria-current');
            });
        }

        function observeArticle(page, sectionId) {
            sectionObserver?.disconnect();
            sectionObserver = null;
            const headings = articleHeadings(page);
            setActiveSection(page, headings.some(heading => heading.id === sectionId) ? sectionId : headings[0]?.id || null);
            if (!headings.length || typeof window.IntersectionObserver !== 'function') return;
            const offset = Math.ceil(document.querySelector('.header')?.getBoundingClientRect().height || 72) + 24;
            const observer = new IntersectionObserver(() => {
                if (opts.signal.aborted || activeArticle !== page || !page.isConnected) return;
                const passed = headings.filter(heading => heading.getBoundingClientRect().top <= offset + 1);
                setActiveSection(page, (passed[passed.length - 1] || headings[0]).id);
            }, { rootMargin: '-' + offset + 'px 0px -60% 0px', threshold: 0 });
            sectionObserver = observer;
            headings.forEach(heading => observer.observe(heading));
        }

        function refreshProjections() {
            allPages.forEach(refreshArticle);
            searchIndex = allPages.filter(page => page.id !== 'page-accueil').map(page => {
                const id = page.id.replace(/^page-/, '');
                return { id, title: textOnly(page.querySelector('h1')), text: normalizeSearch(page.querySelector('.wiki-article-body')?.textContent), section: categoryFor(id) };
            });
            scope.querySelectorAll('[data-wiki-guide-count]').forEach(count => { count.textContent = String(searchIndex.length); });
            if (activeArticle) setActiveSection(activeArticle, activeSection);
            updateSidebarToggle();
            if (searchInput?.value.trim().length >= 2) performSearch();
        }

        allPages.forEach(prepareArticle);

        function expandGroup(group, expanded) {
            const children = group?.querySelector('.wiki-nav-group-children');
            if (!children) return;
            group.classList.toggle('collapsed', !expanded);
            children.hidden = !expanded;
            children.style.maxHeight = expanded ? 'none' : '0';
            group.querySelector('.wiki-nav-group-header')?.setAttribute('aria-expanded', String(expanded));
        }

        function navigateTo(pageId, pushState = true, sectionId = null) {
            if (!pagesById.has(pageId)) pageId = 'accueil';
            const target = pagesById.get(pageId);
            if (!target) return;
            const section = sectionId ? document.getElementById(sectionId) : null;
            const heading = section && target.querySelector('.wiki-article-body')?.contains(section) ? section : target.querySelector('h1');
            allPages.forEach(page => page.classList.toggle('active', page === target));
            activeArticle = target;
            // TOC entries have a location state of their own, rather than duplicate page states.
            scope.querySelectorAll('[data-page]:not([data-section])').forEach(link => {
                const active = link.dataset.page === pageId;
                link.classList.toggle('active', active);
                if (active) link.setAttribute('aria-current', 'page');
                else link.removeAttribute('aria-current');
            });
            const activeLink = navById.get(pageId);
            const group = activeLink?.closest('.wiki-nav-group');
            if (group) expandGroup(group, true);
            if (activeLink && navContainer && (window.innerWidth > 900 || sidebarOpen)) {
                // Confine the reveal to the index. scrollIntoView would also shift the document.
                const linkBounds = activeLink.getBoundingClientRect();
                const navBounds = navContainer.getBoundingClientRect();
                if (linkBounds.top < navBounds.top) navContainer.scrollTop += linkBounds.top - navBounds.top;
                else if (linkBounds.bottom > navBounds.bottom) navContainer.scrollTop += linkBounds.bottom - navBounds.bottom;
            }
            const hash = '#' + pageId + (heading === section && section ? '/' + section.id : '');
            if (pushState && location.hash !== hash) history.pushState(history.state, '', hash);
            lastHash = location.hash;
            closeSidebar();
            observeArticle(target, heading === section ? sectionId : null);
            if (heading) {
                heading.tabIndex = -1;
                heading.focus({ preventScroll: true });
                if (heading === section) heading.scrollIntoView({ block: 'start', behavior: scrollBehavior() });
                else window.scrollTo({ top: 0, behavior: scrollBehavior() });
            }
        }

        // Delegation includes native links generated for related guides and new home portals.
        scope.addEventListener('click', event => {
            if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button > 0) return;
            const searchButton = event.target.closest('[data-wiki-search]');
            if (searchButton) {
                event.preventDefault();
                openSidebar();
                searchInput?.focus();
                return;
            }
            const link = event.target.closest('[data-page], [data-goto]');
            if (!link || !wikiContent?.contains(link) && !sidebar?.contains(link)) return;
            const pageId = link.dataset.page || link.dataset.goto;
            if (!pagesById.has(pageId)) return;
            event.preventDefault();
            navigateTo(pageId, true, link.dataset.section);
        }, opts);
        scope.querySelectorAll('[data-goto]:not(a)').forEach(card => {
            card.tabIndex = 0;
            card.setAttribute('role', 'button');
            card.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigateTo(card.dataset.goto); }
            }, opts);
        });

        scope.querySelectorAll('.wiki-nav-group-header').forEach(header => {
            expandGroup(header.parentElement, false);
            header.addEventListener('click', () => expandGroup(header.parentElement, header.getAttribute('aria-expanded') !== 'true'), opts);
        });

        function closeSearch(restoreFocus = false) {
            // Focusing the field may rerender results; hide them after that focus event.
            if (restoreFocus) searchInput?.focus();
            searchResults?.classList.remove('active');
            searchInput?.setAttribute('aria-expanded', 'false');
        }

        function performSearch() {
            if (!searchInput || !searchResults) return;
            const query = normalizeSearch(searchInput.value);
            searchResults.replaceChildren();
            if (query.length < 2) { closeSearch(); return; }
            const results = searchIndex.filter(item => normalizeSearch(item.title).includes(query) || item.text.includes(query)).slice(0, 10);
            if (!results.length) {
                const empty = generated('div', 'wiki-search-result-item is-empty');
                empty.textContent = t('Aucun guide trouvé', 'No guides found');
                searchResults.appendChild(empty);
            }
            results.forEach(result => {
                const item = generated('button', 'wiki-search-result-item');
                item.type = 'button';
                item.dataset.page = result.id;
                item.appendChild(document.createTextNode(result.title));
                const category = document.createElement('span');
                category.className = 'result-section';
                category.textContent = result.section;
                item.appendChild(category);
                item.addEventListener('click', event => {
                    event.preventDefault();
                    navigateTo(result.id);
                    closeSearch();
                    searchInput.value = '';
                }, opts);
                item.addEventListener('keydown', event => {
                    if (event.key === 'ArrowDown') { event.preventDefault(); (item.nextElementSibling || item).focus(); }
                    if (event.key === 'ArrowUp') { event.preventDefault(); (item.previousElementSibling || searchInput).focus(); }
                    if (event.key === 'Escape') { event.preventDefault(); closeSearch(true); }
                }, opts);
                searchResults.appendChild(item);
            });
            searchResults.classList.add('active');
            searchInput.setAttribute('aria-expanded', 'true');
        }

        if (searchInput) {
            searchInput.setAttribute('aria-controls', 'wiki-search-results');
            searchInput.setAttribute('aria-expanded', 'false');
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(performSearch, 100);
            }, opts);
            searchInput.addEventListener('focus', () => { if (searchInput.value.trim().length >= 2) performSearch(); }, opts);
            searchInput.addEventListener('keydown', event => {
                if (event.key === 'Escape' && searchResults?.classList.contains('active')) { event.preventDefault(); closeSearch(); }
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    const results = searchResults?.querySelectorAll('button');
                    if (!results?.length || !searchResults.classList.contains('active')) return;
                    event.preventDefault();
                    results[event.key === 'ArrowUp' ? results.length - 1 : 0].focus();
                }
            }, opts);
        }
        document.addEventListener('click', event => {
            if (!event.target.closest('.wiki-search-wrapper')) closeSearch();
        }, opts);

        function updateSidebarToggle() {
            sidebarToggle?.setAttribute('aria-label', sidebarOpen ? t('Fermer le menu des guides', 'Close guide menu') : t('Ouvrir le menu des guides', 'Open guide menu'));
            const label = sidebarToggle?.querySelector('[data-wiki-toggle-label]');
            if (label) { label.setAttribute('data-i18n-ignore', ''); label.textContent = sidebarOpen ? t('Fermer', 'Close') : 'Guides'; }
        }

        function openSidebar() {
            if (!sidebar || window.innerWidth > 900 || sidebarOpen) return;
            sidebarOpen = true;
            sidebarOverflow = document.body.style.overflow;
            if (wikiContent) { contentInert = wikiContent.inert; wikiContent.inert = true; }
            sidebar.classList.add('open');
            sidebar.inert = false;
            sidebarOverlay?.classList.add('active');
            sidebarToggle?.setAttribute('aria-expanded', 'true');
            document.body.style.overflow = 'hidden';
            updateSidebarToggle();
            searchInput?.focus();
        }

        function closeSidebar(restoreFocus = false) {
            sidebar?.classList.remove('open');
            if (sidebar) sidebar.inert = window.innerWidth <= 900;
            sidebarOverlay?.classList.remove('active');
            sidebarToggle?.setAttribute('aria-expanded', 'false');
            if (sidebarOpen) {
                sidebarOpen = false;
                document.body.style.overflow = sidebarOverflow;
                if (wikiContent) wikiContent.inert = contentInert;
                if (restoreFocus) sidebarToggle?.focus();
            }
            updateSidebarToggle();
        }
        closeActiveSidebar = closeSidebar;
        document.addEventListener('click', event => {
            if (sidebarOpen && event.target.closest?.('#hamburger')) closeSidebar();
        }, { signal: opts.signal, capture: true });
        sidebarToggle?.addEventListener('click', () => sidebarOpen ? closeSidebar(true) : openSidebar(), opts);
        sidebarOverlay?.addEventListener('click', () => closeSidebar(true), opts);
        if (sidebar) sidebar.inert = window.innerWidth <= 900;
        document.addEventListener('keydown', event => {
            if (!sidebarOpen || event.defaultPrevented || event.target.closest?.('dialog[open]')) return;
            if (event.key === 'Escape') { event.preventDefault(); closeSidebar(true); }
            if (event.key === 'Tab') {
                const controls = Array.from(sidebar.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]'))
                    .filter(control => control.tabIndex >= 0 && !control.closest('[hidden], .wiki-search-results:not(.active)'));
                if (sidebarToggle) controls.push(sidebarToggle);
                const first = controls[0], last = controls[controls.length - 1];
                const outside = !sidebar.contains(document.activeElement) && document.activeElement !== sidebarToggle;
                if (event.shiftKey && (document.activeElement === first || outside)) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && (document.activeElement === last || outside)) { event.preventDefault(); first?.focus(); }
            }
        }, opts);
        window.addEventListener('resize', () => {
            if (window.innerWidth > 900) closeSidebar();
            if (sidebar) sidebar.inert = window.innerWidth <= 900 && !sidebarOpen;
        }, opts);

        function handleHash(event) {
            if (event && /^(hashchange|popstate)$/.test(event.type) && lastHash === location.hash) return;
            let hash = location.hash.slice(1);
            try { hash = decodeURIComponent(hash); } catch (error) { /* Invalid fragments retain the normal overview fallback. */ }
            const [pageId, sectionId] = hash.split('/');
            navigateTo(pageId || 'accueil', false, sectionId);
        }
        document.addEventListener('nameless:languagechange', refreshProjections, opts);
        window.addEventListener('hashchange', handleHash, opts);
        window.addEventListener('popstate', handleHash, opts);
        document.addEventListener('nameless:routechange', handleHash, opts);
        refreshProjections();
        handleHash();
    }

    function destroyWiki() {
        sectionObserver?.disconnect();
        sectionObserver = null;
        if (closeActiveSidebar) { closeActiveSidebar(); closeActiveSidebar = null; }
        if (wikiController) { wikiController.abort(); wikiController = null; }
        if (searchTimeout) { clearTimeout(searchTimeout); searchTimeout = null; }
    }

    window.NamelessWikiPage = { init: initWiki, destroy: destroyWiki };
    function autoStart() {
        if (window.NamelessSpaRouter?.controlsLifecycle) return;
        initWiki(document);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoStart, { once: true });
    else autoStart();
})();
