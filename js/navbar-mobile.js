/* navbar-mobile.js - Gestion améliorée de la navbar mobile */

class MobileNavbar {
    constructor() {
        this.header = document.querySelector('.header');
        this.hamburger = document.getElementById('hamburger');
        this.navMenu = document.getElementById('nav-menu');
        this.lastScrollY = window.scrollY;
        this.scrollThreshold = 10;
        this.isMenuOpen = false;
        
        this.init();
    }
    
    init() {
        if (this.hamburger && this.navMenu) {
            this.setupEventListeners();
            this.createOverlay();
        }
    }
    
    setupEventListeners() {
        // Gestion du hamburger
        this.hamburger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMenu();
        });
        
        // Gestion des liens du menu (fermeture automatique)
        const navLinks = this.navMenu.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                this.closeMenu();
            });
        });
        
        // Fermeture en cliquant sur le fond du menu (pas sur les liens)
        this.navMenu.addEventListener('click', (e) => {
            // Si on clique directement sur le menu (pas sur un lien)
            if (e.target === this.navMenu) {
                this.closeMenu();
            }
        });
        
        // Auto-hide navbar on scroll (mobile only)
        if (window.innerWidth <= 768) {
            window.addEventListener('scroll', this.handleScroll.bind(this));
        }
        
        // Gestion du redimensionnement
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // Fermeture par ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isMenuOpen) {
                this.closeMenu();
            }
        });
    }
    
    createOverlay() {
        // OVERLAY DESACTIVE - Il bloquait les clics sur le menu
        // Créer l'overlay s'il n'existe pas
        /* 
        let overlay = document.querySelector('.nav-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'nav-overlay';
            document.body.appendChild(overlay);
        }
        
        this.overlay = overlay;
        
        // Fermeture par clic sur l'overlay
        this.overlay.addEventListener('click', () => {
            this.closeMenu();
        });
        */
        
        // Créer un overlay factice pour éviter les erreurs
        this.overlay = {
            classList: {
                add: () => {},
                remove: () => {}
            }
        };
    }
    
    toggleMenu() {
        if (this.isMenuOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }
    
    openMenu() {
        this.isMenuOpen = true;
        this.navMenu.classList.add('active');
        this.hamburger.classList.add('active');
        // this.overlay.classList.add('active'); // Désactivé
        document.body.style.overflow = 'hidden'; // Empêcher le scroll du body
        
        // Pas besoin de transform, le CSS gère l'animation
    }
    
    closeMenu() {
        this.isMenuOpen = false;
        this.navMenu.classList.remove('active');
        this.hamburger.classList.remove('active');
        // this.overlay.classList.remove('active'); // Désactivé
        document.body.style.overflow = ''; // Restaurer le scroll du body
        
        // Pas besoin de transform, le CSS gère l'animation
    }
    
    handleScroll() {
        const currentScrollY = window.scrollY;
        
        // Auto-hide navbar (seulement sur mobile)
        if (window.innerWidth <= 768 && !this.isMenuOpen) {
            if (currentScrollY > this.lastScrollY && currentScrollY > this.scrollThreshold) {
                // Scroll vers le bas - cacher la navbar
                this.header.classList.add('hidden');
            } else if (currentScrollY < this.lastScrollY) {
                // Scroll vers le haut - montrer la navbar
                this.header.classList.remove('hidden');
            }
        }
        
        this.lastScrollY = currentScrollY;
    }
    
    handleResize() {
        // Fermer le menu si on passe en desktop
        if (window.innerWidth > 768 && this.isMenuOpen) {
            this.closeMenu();
        }
        
        // Réinitialiser l'auto-hide de la navbar
        if (window.innerWidth > 768) {
            this.header.classList.remove('hidden');
            window.removeEventListener('scroll', this.handleScroll);
        } else {
            window.addEventListener('scroll', this.handleScroll.bind(this));
        }
    }
}

// Initialisation au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
    window.mobileNavbar = new MobileNavbar();
});

// Export pour utilisation externe si nécessaire
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileNavbar;
}