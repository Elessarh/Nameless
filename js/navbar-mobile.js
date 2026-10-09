/* Persistent navigation controller shared by direct loads and SPA routes. */
class MobileNavbar {
    constructor() {
        this.header = document.querySelector('.header');
        this.hamburger = document.getElementById('hamburger');
        this.navMenu = document.getElementById('nav-menu');
        this.lastScrollY = window.scrollY;
        this.scrollThreshold = 10;
        this.isMenuOpen = false;
        this.savedOverflow = '';
        this.inertElements = [];
        this.handleScroll = this.handleScroll.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.init();
    }
    init() {
        if (!this.header || !this.hamburger || !this.navMenu) return;
        // This stateful label is updated here, rather than restored by i18n's
        // remembered static attributes when the menu changes state.
        this.hamburger.setAttribute('data-i18n-ignore', '');
        this.updateMenuLabel();
        document.addEventListener('nameless:languagechange', () => this.updateMenuLabel());
        this.hamburger.addEventListener('click', () => this.toggleMenu());
        this.navMenu.addEventListener('click', (event) => {
            if (event.target.closest('a') || event.target === this.navMenu) this.closeMenu();
        });
        window.addEventListener('scroll', this.handleScroll, { passive: true });
        window.addEventListener('resize', this.handleResize);
        this.header.addEventListener('focusin', () => this.header.classList.remove('hidden'));
        document.addEventListener('keydown', (event) => {
            if (!this.isMenuOpen) return;
            if (event.target.closest?.('dialog[open]')) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                this.closeMenu(true);
            } else if (event.key === 'Tab') {
                const focusable = [...this.header.querySelectorAll('a[href], button:not([disabled])')]
                    .filter((element) => element.getClientRects().length);
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first?.focus();
                }
            }
        });
    }
    toggleMenu() {
        if (this.isMenuOpen) this.closeMenu(true);
        else this.openMenu();
    }
    updateMenuLabel() {
        const english = document.documentElement.lang === 'en';
        this.hamburger.setAttribute('aria-label', this.isMenuOpen
            ? (english ? 'Close menu' : 'Fermer le menu')
            : (english ? 'Open menu' : 'Ouvrir le menu'));
    }
    openMenu() {
        if (window.innerWidth > 768 || this.isMenuOpen) return;
        this.isMenuOpen = true;
        this.header.classList.remove('hidden');
        this.navMenu.classList.add('active');
        this.hamburger.classList.add('active');
        this.hamburger.setAttribute('aria-expanded', 'true');
        this.updateMenuLabel();
        this.savedOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        this.inertElements = [...document.querySelectorAll('main, footer')].map((element) => ({ element, inert: element.inert }));
        this.inertElements.forEach(({ element }) => { element.inert = true; });
        this.navMenu.querySelector('a[href], button:not([disabled])')?.focus();
    }
    closeMenu(restoreFocus = false) {
        if (!this.isMenuOpen) return;
        this.isMenuOpen = false;
        this.navMenu.classList.remove('active');
        this.hamburger.classList.remove('active');
        this.hamburger.setAttribute('aria-expanded', 'false');
        this.updateMenuLabel();
        document.body.style.overflow = this.savedOverflow;
        this.inertElements.forEach(({ element, inert }) => { element.inert = inert; });
        this.inertElements = [];
        if (restoreFocus) this.hamburger.focus();
    }
    handleScroll() {
        this.header.classList.remove('hidden');
        this.lastScrollY = window.scrollY;
    }
    handleResize() {
        if (window.innerWidth > 768) {
            this.closeMenu();
            this.header.classList.remove('hidden');
        }
        this.lastScrollY = window.scrollY;
    }
}
document.addEventListener('DOMContentLoaded', () => {
    if (!window.mobileNavbar) window.mobileNavbar = new MobileNavbar();
});
if (typeof module !== 'undefined' && module.exports) module.exports = MobileNavbar;
