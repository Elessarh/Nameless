/* map.js - Gestion de la carte du monde */

// Variables globales
let questLayers = null;
let map = null; // Variable globale pour la carte
let currentMapOverlay = null; // Overlay de la carte actuelle
let currentFloor = 1; // Palier actuel

// A focused result must remain readable in its surroundings. Zoom level 4 was
// effectively a pixel-level view on CRS.Simple and made search navigation
// disorienting, especially on mobile.
const SEARCH_FOCUS_ZOOM_DESKTOP = 1;
const SEARCH_FOCUS_ZOOM_MOBILE = 0;

function focusMapLocation(latLng) {
    if (!map) return;
    const preferredZoom = window.innerWidth <= 768
        ? SEARCH_FOCUS_ZOOM_MOBILE
        : SEARCH_FOCUS_ZOOM_DESKTOP;
    const targetZoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), preferredZoom));
    map.setView(latLng, targetZoom, { animate: true });
}

// Cycle de vie SPA (nettoyage Leaflet + écouteurs)
let mapController = null;
let mapResizeTimer = null;

// Configuration des cartes par palier
const floorMaps = {
    1: '../assets/carte.png',
    2: '../assets/Palier2-map.png',
    3: '../assets/Palier3-map.png'
};

// Configuration des bounds par palier
// Palier 1: Nord: X=2560, Z=85 | Sud: X=2560, Z=5036 | Ouest: X=85, Z=2560 | Est: X=5036, Z=2560
// Palier 2: Sud: x=0, z=1059 | Ouest: x=-1059, z=0 | Nord: x=0, z=-1059 | Est: x=1059, z=0
const floorConfig = {
    1: {
        bounds: [[85, 85], [5036, 5036]],
        maxBounds: [[-1000, -1000], [6120, 6120]],
        coordOffset: { x: 0, z: 5121 },
        center: [2560, 2560]
    },
    2: {
        // Palier 2: bounds corrigés pour compenser la marge sud de l'image
        // L'image a une marge en bas, le terrain visible ne va pas jusqu'au bord
        // Calcul: étirement de l'image pour que les coordonnées correspondent
        bounds: [[3842, -1059], [6180, 1059]],
        maxBounds: [[3300, -1500], [6700, 1500]],
        coordOffset: { x: 0, z: 5121 },
        center: [5121, 0]
    },
    3: {
        bounds: [[0, 0], [2000, 2000]], // À configurer plus tard
        maxBounds: [[-500, -500], [2500, 2500]],
        coordOffset: { x: 0, z: 0 },
        center: [1000, 1000]
    }
};

// Groupes de couches pour organiser les marqueurs
const layerGroups = {
    questesSecondaires: L.layerGroup(),
    questesPrincipales: L.layerGroup(),
    donjons: L.layerGroup(),
    villes: L.layerGroup(),
    monstres: L.layerGroup(),
    marchands: L.layerGroup()
};

// Groupes de couches pour le Palier 2
const layerGroupsFloor2 = {
    questesSecondaires: L.layerGroup(),
    questesPrincipales: L.layerGroup(),
    donjons: L.layerGroup(),
    villes: L.layerGroup(),
    monstres: L.layerGroup(),
    marchands: L.layerGroup()
};

// Données des quêtes pour le Palier 2
const questDataFloor2 = [
    // QUÊTES PRINCIPALES - Palier 2
    {
        id: 'floor2-quest-1',
        name: 'Parler au Maître Épéiste',
        type: 'principale',
        step: 1,
        coordinates: [-40, -888],
        npc: 'Maître Épéiste',
        description: 'Commencez votre aventure au Palier 2'
    },
    {
        id: 'floor2-quest-2',
        name: 'Trouver Artheon à Urbus',
        type: 'principale',
        step: 2,
        coordinates: [10, -666],
        npc: 'Elyra',
        description: 'Coordonnées d\'Artheon : X: 133, Z: -375, Y: 140'
    },
    {
        id: 'floor2-quest-3',
        name: 'Tuer 20 Taureaux',
        type: 'principale',
        step: 3,
        coordinates: [133, -375],
        npc: 'Artheon',
        description: 'Éliminez 20 taureaux dans la zone'
    },
    {
        id: 'floor2-quest-4',
        name: 'Parler à Bantu',
        type: 'principale',
        step: 4,
        coordinates: [133, -375],
        npc: 'Artheon',
        description: 'Rendez-vous auprès de Bantu'
    },
    {
        id: 'floor2-quest-5',
        name: 'Tuer 25 Loups',
        type: 'principale',
        step: 5,
        coordinates: [-586, -255],
        npc: 'Bantu',
        description: 'Éliminez 25 loups, puis allez voir Kwabena en X: -437, Z: -441, Y: 146'
    },
    {
        id: 'floor2-quest-6',
        name: 'Obtenir 10 Planches d\'Acacia et 1 Lingot d\'Onyx Pur',
        type: 'principale',
        step: 6,
        coordinates: [-437, -441],
        npc: 'Kwabena',
        description: 'Rassemblez les matériaux demandés'
    },
    {
        id: 'floor2-quest-7',
        name: 'Parler à Kwabeno',
        type: 'principale',
        step: 7,
        coordinates: [-427, -427],
        npc: 'Kwabeno',
        description: 'Discutez avec Kwabeno'
    },
    {
        id: 'floor2-quest-8',
        name: 'Obtenir 10 Écailles Fulgurantes et 10 Cornes de Taureaux',
        type: 'principale',
        step: 8,
        coordinates: [-427, -427],
        npc: 'Kwabeno',
        description: 'Collectez les matériaux rares'
    },
    {
        id: 'floor2-quest-9',
        name: 'Contacter Yaa',
        type: 'principale',
        step: 9,
        coordinates: [743, -259],
        npc: 'Fanny',
        description: 'Établissez le contact avec Yaa'
    },
    
    // QUÊTES SECONDAIRES - Palier 2
    {
        id: 'floor2-secondary-1',
        name: 'Obtenir 15 Peaux de Sangliers et 15 Peau Épaisse',
        type: 'secondaire',
        step: 'S',
        coordinates: [695, -277],
        npc: 'Minutiare',
        description: 'Collectez les peaux demandées pour Minutiare'
    },
    {
        id: 'floor2-secondary-2',
        name: 'Obtenir 10 Minerais d\'Onyx Impur',
        type: 'secondaire',
        step: 'S',
        coordinates: [725, -302],
        npc: 'Shii',
        description: 'Récupérez les minerais d\'onyx impur pour Shii'
    },
    {
        id: 'floor2-secondary-3',
        name: 'Obtenir 30 Minerais de Bauxite',
        type: 'secondaire',
        step: 'S',
        coordinates: [116, -307],
        npc: 'Charles',
        description: 'Collectez 30 minerais de bauxite pour Charles'
    },
    {
        id: 'floor2-secondary-4',
        name: 'Obtenir 4 Plumes Enflammées, 4 Plumes Ondoyantes, 4 Plumes Terreuses',
        type: 'secondaire',
        step: 'S',
        coordinates: [111, -391],
        npc: 'Ifa',
        description: 'Collectez les différentes plumes élémentaires pour Ifa'
    },
    // Quêtes de Bronn
    {
        id: 'floor2-quest-10',
        name: 'Obtenir 20 Bûches d\'Acacia et 20 Bûches de Chêne',
        type: 'principale',
        step: 10,
        coordinates: [638, -267],
        npc: 'Bronn',
        description: 'Collectez les bûches pour Bronn'
    },
    {
        id: 'floor2-quest-11',
        name: 'Obtenir 20 Planches d\'Acacia et 20 Planches de Chêne',
        type: 'principale',
        step: 11,
        coordinates: [638, -267],
        npc: 'Bronn',
        description: 'Fabriquez les planches pour Bronn'
    },
    {
        id: 'floor2-quest-12',
        name: 'Obtenir 20 Planches de Chêne, 20 Planches d\'Acacia et 10 Bûches de Bouleau',
        type: 'principale',
        step: 12,
        coordinates: [638, -267],
        npc: 'Bronn',
        description: 'Dernière livraison pour Bronn'
    },
    {
        id: 'floor2-quest-13',
        name: 'Parler à la Statue de Yaa',
        type: 'principale',
        step: 13,
        coordinates: [740, -255],
        npc: 'Statue',
        description: 'Parlez à la Statue de Yaa'
    },
    
    // QUÊTES SECONDAIRES SUPPLÉMENTAIRES - Palier 2
    {
        id: 'floor2-secondary-5',
        name: 'Obtenir 6 Fourrures de Loup et 6 Peaux d\'Ours',
        type: 'secondaire',
        step: 'S',
        coordinates: [106, -383],
        npc: 'Ife',
        description: 'Collectez les fourrures et peaux pour Ife'
    },
    {
        id: 'floor2-secondary-6',
        name: 'Vaincre 30 Harpies de Feu / Foudre',
        type: 'secondaire',
        step: 'S',
        coordinates: [-434, 271],
        npc: 'Sissou',
        description: 'Éliminez les harpies pour Sissou'
    },
    {
        id: 'floor2-secondary-7',
        name: 'Vaincre 5 Harpie de Feu, 5 Harpie de Foudre, 5 Harpie de Terre',
        type: 'secondaire',
        step: 'S',
        coordinates: [-486, 268],
        npc: 'Frank',
        description: 'Éliminez les différentes harpies pour Frank'
    },
    {
        id: 'floor2-secondary-8',
        name: 'Vaincre 50 Harpies de Terre',
        type: 'secondaire',
        step: 'S',
        coordinates: [-431, 280],
        npc: 'Poris',
        description: 'Éliminez 50 harpies de terre pour Poris'
    },
    {
        id: 'floor2-secondary-9',
        name: 'Vaincre les 4 Boss: Gardien du Sanctuaire, Rugiboeuf, Velindra, Magnus Colosse',
        type: 'secondaire',
        step: 'S',
        coordinates: [-204, -688],
        npc: 'Chasseur de Dragon',
        description: 'Vaincre dans l\'ordre: 1 Gardien du Sanctuaire, 1 Rugiboeuf le Gardien, 1 Velindra la Tisseuse, 1 Magnus Colosse de Veines'
    },
    {
        id: 'floor2-secondary-10',
        name: 'Retrouver Relax le chat',
        type: 'secondaire',
        step: 'S',
        coordinates: [-554, -263],
        npc: 'Itamii',
        description: 'Retrouvez Relax le chat pour Itamii'
    },
    {
        id: 'floor2-secondary-11',
        name: 'Obtenir 10 Miel',
        type: 'secondaire',
        step: 'S',
        coordinates: [-576, -256],
        npc: 'Baraka',
        description: 'Collectez du miel pour Baraka'
    },
    {
        id: 'floor2-secondary-12',
        name: 'Obtenir 15 Oeufs d\'Harpie d\'Eau et 10 Graisse d\'Ours',
        type: 'secondaire',
        step: 'S',
        coordinates: [-564, -255],
        npc: 'Mansa',
        description: 'Collectez les ingrédients pour Mansa'
    },
    {
        id: 'floor2-secondary-13',
        name: 'Obtenir 3 Plumes Corrompues',
        type: 'secondaire',
        step: 'S',
        coordinates: [-587, -245],
        npc: 'Nora',
        description: 'Collectez les plumes corrompues pour Nora'
    },
    {
        id: 'floor2-secondary-14',
        name: 'Vaincre 30 Squelettes dans le Sanctuaire de Keshûn',
        type: 'secondaire',
        step: 'S',
        coordinates: [-42, 205],
        npc: 'SamaelTVS',
        description: 'Éliminez les squelettes pour SamaelTVS'
    },
    {
        id: 'floor2-secondary-15',
        name: 'Obtenir 1 Sac de Toile, 1 Anneau sans nom, 1 Carnet Froissé',
        type: 'secondaire',
        step: 'S',
        coordinates: [620, -566],
        npc: 'Elyen',
        description: 'Collectez les objets mystérieux pour Elyen'
    },
    {
        id: 'floor2-secondary-16',
        name: 'Obtenir Champignogno et 2 Herbes Parfumées',
        type: 'secondaire',
        step: 'S',
        coordinates: [-160, 10],
        npc: 'Havca',
        description: 'Collectez les ingrédients pour Havca'
    },
    // Quête principale Yuko
    {
        id: 'floor2-quest-16',
        name: 'Obtenir 30 Bûches de Chêne, 10 Fourrures de Loup, 20 Minerais de Charbon',
        type: 'principale',
        step: 16,
        coordinates: [-611, -247],
        npc: 'Yuko',
        description: 'Collectez les ressources pour Yuko'
    }
];

function initMapView() {
    // N'initialiser que si le conteneur de carte est présent
    if (!document.getElementById('game-map')) return;
    // Nettoyer une éventuelle instance précédente (navigation SPA)
    destroyMapView();
    mapController = new AbortController();
    // Repartir de groupes de calques vides pour éviter les marqueurs dupliqués
    Object.values(layerGroups).forEach(g => g.clearLayers());
    Object.values(layerGroupsFloor2).forEach(g => g.clearLayers());

    // Système de coordonnées basé sur les points de référence fournis
    // Nord: X=2560, Z=85  |  Sud: X=2560, Z=5036  |  Ouest: X=85, Z=2560  |  Est: X=5036, Z=2560
    // 
    // Conversion pour Leaflet CRS.Simple:
    // X du jeu = lng dans Leaflet (85 à 5036)
    // Z du jeu = inversé dans Leaflet (Z=85 -> lat=5036, Z=5036 -> lat=85)
    // 
    // Bounds Leaflet: [[lat_min, lng_min], [lat_max, lng_max]]
    // lat_min = 85 (correspond à Z=5036 du jeu - Sud)
    // lat_max = 5036 (correspond à Z=85 du jeu - Nord)  
    // lng_min = 85 (correspond à X=85 du jeu - Ouest)
    // lng_max = 5036 (correspond à X=5036 du jeu - Est)
    const bounds = [[85, 85], [5036, 5036]];
    
    // Centre de la carte: X=2560, Z=2560 du jeu
    // En Leaflet: lat = 5121-2560 = 2561, lng = 2560
    const centerLat = 5121 - 2560; // 2561 dans Leaflet pour Z=2560 du jeu
    const centerLng = 2560;        // X=2560 du jeu
    
    // Initialisation de la carte Leaflet avec zoom ultra-précis
    map = L.map('game-map', {
        crs: L.CRS.Simple,
        minZoom: -6,    // Zoom out très éloigné pour vue d'ensemble complète
        maxZoom: 10,    // Zoom ULTRA rapproché pour voir les pixels individuels
        zoom: -3,       // Zoom initial (vue d'ensemble)
        center: [centerLat, centerLng], // Centre de la carte [lat_leaflet, lng_leaflet]
        zoomControl: true,
        attributionControl: false,
        // Limiter le déplacement aux bounds de la carte avec une marge élargie
        maxBounds: [[-1000, -1000], [6120, 6120]], // Marge très élargie pour le zoom extrême
        maxBoundsViscosity: 0.5, // Résistance réduite pour plus de liberté
        // Améliorer les performances pour le zoom extrême
        preferCanvas: false, // Désactiver canvas pour zoom pixel-parfait
        // Contrôle ultra-fin du déplacement et zoom
        zoomSnap: 0.05, // Incréments de zoom ultra-fins
        zoomDelta: 0.3, // Sensibilité molette plus fine
        wheelPxPerZoomLevel: 120, // Contrôle précis de la molette
        // Options avancées pour zoom élevé
        bounceAtZoomLimits: false,
        doubleClickZoom: 'center', // Double-clic pour centrer et zoomer
        boxZoom: true,  // Zoom par sélection rectangulaire
        keyboard: true, // Contrôles clavier
        scrollWheelZoom: true,
        touchZoom: true // Support tactile amélioré
    });
    
    // Charger l'image de la carte
    currentMapOverlay = L.imageOverlay(floorMaps[1], bounds);
    currentMapOverlay.addTo(map);
    
    // Fonction de changement de palier (extraite pour réutilisation)
    function changeFloor(selectedFloor, showNotification = true) {
        // Vérifier si la carte existe pour ce palier
        if (!floorMaps[selectedFloor]) {
            console.warn('❌ Floor', selectedFloor, 'does not exist');
            return false;
        }
        
        console.log('🔄 Changing floor to:', selectedFloor);
        
        // Retirer l'ancienne carte
        if (currentMapOverlay) {
            map.removeLayer(currentMapOverlay);
        }
        
        // Obtenir la configuration pour ce palier
        const floorCfg = floorConfig[selectedFloor];
        const newBounds = floorCfg?.bounds || bounds;
        const newMaxBounds = floorCfg?.maxBounds || [[-1000, -1000], [6120, 6120]];
        const newCenter = floorCfg?.center || [2560, 2560];
        
        // Mettre à jour les maxBounds pour ce palier
        map.setMaxBounds(newMaxBounds);
        
        // Charger la nouvelle carte avec les bounds appropriés
        currentMapOverlay = L.imageOverlay(floorMaps[selectedFloor], newBounds);
        currentMapOverlay.addTo(map);
        
        // Mettre l'overlay en arrière-plan (derrière les marqueurs)
        currentMapOverlay.bringToBack();
        
        currentFloor = selectedFloor;
        console.log('✅ currentFloor set to:', currentFloor);
        
        // Gestion des marqueurs selon le palier
        if (selectedFloor === 1) {
            // Masquer les marqueurs du palier 2
            Object.values(layerGroupsFloor2).forEach(group => {
                map.removeLayer(group);
            });
            
            // Réafficher les marqueurs du palier 1 selon les toggles
            const toggles = [
                { id: 'toggle-quetes-principales', layer: layerGroups.questesPrincipales },
                { id: 'toggle-quetes-secondaires', layer: layerGroups.questesSecondaires },
                { id: 'toggle-donjons', layer: layerGroups.donjons },
                { id: 'toggle-villes', layer: layerGroups.villes },
                { id: 'toggle-monstres', layer: layerGroups.monstres },
                { id: 'toggle-marchands', layer: layerGroups.marchands }
            ];
            
            toggles.forEach(toggle => {
                const checkbox = document.getElementById(toggle.id);
                if (checkbox && checkbox.checked) {
                    map.addLayer(toggle.layer);
                }
            });
        } else if (selectedFloor === 2) {
            // Masquer tous les marqueurs du palier 1
            Object.values(layerGroups).forEach(group => {
                map.removeLayer(group);
            });
            
            // Afficher les marqueurs du palier 2 selon les toggles
            const toggles = [
                { id: 'toggle-quetes-principales', layer: layerGroupsFloor2.questesPrincipales },
                { id: 'toggle-quetes-secondaires', layer: layerGroupsFloor2.questesSecondaires }
            ];
            
            toggles.forEach(toggle => {
                const checkbox = document.getElementById(toggle.id);
                if (checkbox && checkbox.checked) {
                    map.addLayer(toggle.layer);
                }
            });
        } else {
            // Palier 3 ou autre : masquer tous les marqueurs
            Object.values(layerGroups).forEach(group => {
                map.removeLayer(group);
            });
            Object.values(layerGroupsFloor2).forEach(group => {
                map.removeLayer(group);
            });
        }
        
        // Ajuster la vue pour le nouveau palier
        map.invalidateSize();
        
        // Reconstruire les éléments recherchables pour le nouveau palier
        if (typeof rebuildSearchableItems === 'function') {
            rebuildSearchableItems();
        }
        
        // Utiliser setTimeout pour s'assurer que l'image est chargée
        setTimeout(() => {
            if (!map) return;
            map.fitBounds(newBounds, {
                padding: [50, 50],
                animate: true,
                maxZoom: 2
            });
        }, 100);
        
        if (showNotification) {
            // Notification du changement
            const notification = L.popup({
                closeButton: false,
                autoClose: true,
                autoPan: false,
                className: 'floor-change-popup'
            })
            .setLatLng(newCenter)
            .setContent(`
                <div style="font-family: 'Orbitron', sans-serif; text-align: center; padding: 5px;">
                    <strong style="color: #00ffaa;"><span class="map-popup-symbol town" aria-hidden="true"></span><span>Palier ${selectedFloor}</span></strong><br>
                    <small style="color: #888;">Carte chargée avec succès</small>
                </div>
            `)
            .openOn(map);
            
            setTimeout(() => {
                if (map) map.closePopup(notification);
            }, 2000);
        }
        
        // Sauvegarder l'état avec le nouveau palier
        saveMapState();
        
        return true;
    }

    // Gestionnaire de changement de palier
    const floorSelect = document.getElementById('floor-select');
    if (floorSelect) {
        floorSelect.addEventListener('change', function() {
            const selectedFloor = parseInt(this.value);
            changeFloor(selectedFloor, true);
        });
    }
    
    // Fonction pour lire les paramètres URL et centrer la carte
    function checkURLParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const x = urlParams.get('x');
        const y = urlParams.get('y');
        const floor = urlParams.get('floor');
        
        console.log('🗺️ checkURLParams:', { x, y, floor, currentFloor });
        
        // Délai pour le changement de palier
        let floorChangeDelay = 0;
        
        // Si un paramètre floor est présent, changer de palier
        if (floor) {
            const floorNum = parseInt(floor);
            if (floorMaps[floorNum] && floorNum !== currentFloor) {
                console.log('🔄 Changing floor from', currentFloor, 'to', floorNum);
                
                // Mettre à jour le sélecteur visuellement
                const floorSelect = document.getElementById('floor-select');
                if (floorSelect) {
                    floorSelect.value = floorNum;
                }
                
                // Appeler directement changeFloor (pas via dispatchEvent)
                changeFloor(floorNum, false); // false = pas de notification
                floorChangeDelay = 300; // Petit délai pour laisser la carte se charger
            }
        }
        
        if (x && y) {
            // Convertir les coordonnées du jeu vers Leaflet
            const gameX = parseInt(x);
            const gameZ = parseInt(y);
            
            // Attendre que le changement de palier soit effectué
            setTimeout(() => {
                if (!map) return;
                const leafletCoords = gameToLeafletCoords(gameX, gameZ, currentFloor);
                
                // Centrer la carte sur ces coordonnées avec un zoom approprié
                focusMapLocation(leafletCoords);
                
                // Créer un marqueur temporaire pour mettre en évidence la position
                const highlightMarker = L.marker(leafletCoords, {
                    icon: L.divIcon({
                        className: 'quest-highlight-marker',
                        html: `<div style="
                            background: #ff0080;
                            border: 3px solid #ffffff;
                            border-radius: 50%;
                            width: 20px;
                            height: 20px;
                            box-shadow: 0 0 20px #ff0080;
                            animation: pulse 2s infinite;
                        "></div>`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    })
                }).addTo(map);
                
                // Ajouter une popup pour indiquer les coordonnées
                const popup = L.popup()
                    .setLatLng(leafletCoords)
                    .setContent(`
                        <div style="text-align: center; color: #00a8ff; font-family: 'Orbitron', monospace;">
                            <strong><span class="map-popup-pin" aria-hidden="true"></span><span>Quête ciblée</span></strong><br>
                            <span style="color: #00ffff;">X: ${gameX}, Z: ${gameZ}</span><br>
                            <small style="color: #888;">Cliquez ailleurs pour fermer</small>
                        </div>
                    `)
                    .openOn(map);
                
                // Retirer le marqueur temporaire après 5 secondes
                setTimeout(() => {
                    if (map) map.removeLayer(highlightMarker);
                }, 5000);
            }, floorChangeDelay);
            
            // Nettoyer l'URL après avoir traité les paramètres
            const cleanURL = window.location.pathname;
            window.history.replaceState({}, document.title, cleanURL);
        }
    }
    
    // Persistance de la position et du palier avec localStorage
    function saveMapState() {
        const center = map.getCenter();
        const zoom = map.getZoom();
        const mapState = {
            lat: center.lat,
            lng: center.lng,
            zoom: zoom,
            floor: currentFloor
        };
        localStorage.setItem('ironOathMapState', JSON.stringify(mapState));
    }
    
    function restoreMapState() {
        const savedState = localStorage.getItem('ironOathMapState');
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                
                // Restaurer le palier d'abord
                if (state.floor && state.floor !== 1) {
                    const floorSelect = document.getElementById('floor-select');
                    if (floorSelect && floorMaps[state.floor]) {
                        floorSelect.value = state.floor;
                        floorSelect.dispatchEvent(new Event('change'));
                    }
                }
                
                // Restaurer la position après un délai pour laisser le palier se charger
                setTimeout(() => {
                    if (!map) return;
                    if (state.lat && state.lng) {
                        map.setView([state.lat, state.lng], state.zoom || -3);
                    }
                }, state.floor !== 1 ? 200 : 0);
                
                return true;
            } catch (e) {
                console.warn('Erreur lors de la restauration de l\'état de la carte:', e);
            }
        }
        return false;
    }
    
    // Sauvegarder l'état lors des mouvements/zoom
    map.on('moveend', saveMapState);
    map.on('zoomend', saveMapState);
    
    // Ajuster la vue pour montrer toute la carte
    map.fitBounds(bounds, {
        padding: [20, 20] // Padding pour éviter que les bords touchent
    });

    // Affichage des coordonnées en temps réel avec précision pixel (responsive)
    const coordController = L.control({position: 'bottomleft'});
    coordController.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'coord-display-live');
        // Vérifier si on est sur mobile
        const isMobile = window.innerWidth <= 480;
        const isTablet = window.innerWidth <= 768 && window.innerWidth > 480;
        
        if (isMobile) {
            // Version ultra-compacte pour mobile
            div.innerHTML = `
                <div style="background: rgba(0,0,0,0.85); color: #00a8ff; padding: 4px 6px; border-radius: 4px; font-family: 'Orbitron', monospace; font-size: 9px; max-width: 120px;">
                    <div style="font-size: 8px;"><span class="map-popup-pin" aria-hidden="true"></span><span id="mouse-x" style="color: #0ff;">-</span>, <span id="mouse-y" style="color: #0ff;">-</span></div>
                    <div id="precision-indicator" style="display: none;"></div>
                    <div id="zone-info" style="display: none;"></div>
                </div>
            `;
        } else if (isTablet) {
            // Version compacte pour tablette
            div.innerHTML = `
                <div style="background: rgba(0,0,0,0.9); color: #00a8ff; padding: 6px 8px; border-radius: 5px; font-family: 'Orbitron', monospace; font-size: 10px; max-width: 150px;">
                    <div style="font-size: 9px;"><span class="map-popup-pin" aria-hidden="true"></span>X: <span id="mouse-x" style="color: #0ff;">-</span></div>
                    <div style="font-size: 9px;">Z: <span id="mouse-y" style="color: #0ff;">-</span></div>
                    <div id="precision-indicator" style="display: none;"></div>
                    <div id="zone-info" style="display: none;"></div>
                </div>
            `;
        } else {
            // Version complète pour desktop
            div.innerHTML = `
                <div style="background: rgba(0,0,0,0.9); color: #00a8ff; padding: 10px; border-radius: 6px; font-family: 'Orbitron', monospace; font-size: 12px; min-width: 200px;">
                    <div><strong><span class="map-popup-pin" aria-hidden="true"></span><span>Coordonnées pixel:</span></strong></div>
                    <div style="margin: 4px 0;">X: <span id="mouse-x" style="color: #00ffff; font-weight: bold;">-</span>, Z: <span id="mouse-y" style="color: #00ffff; font-weight: bold;">-</span></div>
                    <div id="precision-indicator" style="font-size: 9px; color: #ff6b00; margin-bottom: 4px;">Précision: Standard</div>
                    <div style="font-size: 10px; color: #888; margin-top: 4px;">
                        Zone: <span id="zone-info">Exploration</span>
                    </div>
                </div>
            `;
        }
        return div;
    };
    coordController.addTo(map);
    
    // Tracker le mouvement de la souris avec précision pixel
    map.on('mousemove', function(e) {
        const mouseX = document.getElementById('mouse-x');
        const mouseY = document.getElementById('mouse-y');
        const zoneInfo = document.getElementById('zone-info');
        
        if (mouseX && mouseY) {
            // Précision adaptée au niveau de zoom
            const currentZoom = map.getZoom();
            let precision = 0;
            
            if (currentZoom >= 6) {
                precision = 3; // Précision au millième de pixel pour zoom extrême
            } else if (currentZoom >= 3) {
                precision = 2; // Précision au centième pour zoom fort
            } else if (currentZoom >= 0) {
                precision = 1; // Précision au dixième pour zoom moyen
            }
            
            let coordX, coordZ;
            
            // Système de coordonnées unifié pour tous les paliers
            // X = lng directement, Z = 5121 - lat (inversé)
            const gameX = e.latlng.lng;
            const gameZ = 5121 - e.latlng.lat;
            coordX = precision > 0 ? gameX.toFixed(precision) : Math.round(gameX);
            coordZ = precision > 0 ? gameZ.toFixed(precision) : Math.round(gameZ);
            
            mouseX.textContent = coordX;
            mouseY.textContent = coordZ;
            
            // Mettre à jour l'indicateur de précision
            const precisionIndicator = document.getElementById('precision-indicator');
            if (precisionIndicator) {
                let precisionText = "";
                let precisionColor = "";
                
                if (currentZoom >= 8) {
                    precisionText = "ULTRA-PRÉCISION (Pixel parfait)";
                    precisionColor = "#ff0080";
                } else if (currentZoom >= 6) {
                    precisionText = "HAUTE PRÉCISION (Millième)";
                    precisionColor = "#ff6b00";
                } else if (currentZoom >= 3) {
                    precisionText = "PRÉCISION FINE (Centième)";
                    precisionColor = "#ffaa00";
                } else if (currentZoom >= 0) {
                    precisionText = "PRÉCISION NORMALE (Dixième)";
                    precisionColor = "#00ffff";
                } else {
                    precisionText = "PRÉCISION STANDARD";
                    precisionColor = "#888888";
                }
                
                precisionIndicator.textContent = precisionText;
                precisionIndicator.style.color = precisionColor;
            }
            
            // Déterminer la zone basée sur les coordonnées corrigées
            if (zoneInfo) {
                let zone = "Terre Inconnue";
                
                // Utiliser les valeurs numériques pour la comparaison de zone
                const numX = parseFloat(coordX);
                const numZ = parseFloat(coordZ);
                
                if (currentFloor === 2) {
                    // Zones pour le Palier 2 (coordonnées de -1059 à 1059)
                    if (numX >= -1059 && numX <= -353) {
                        if (numZ >= -1059 && numZ <= -353) {
                            zone = "Quadrant Nord-Ouest";
                        } else if (numZ >= -352 && numZ <= 352) {
                            zone = "Secteur Ouest";
                        } else if (numZ >= 353 && numZ <= 1059) {
                            zone = "Quadrant Sud-Ouest";
                        }
                    } else if (numX >= -352 && numX <= 352) {
                        if (numZ >= -1059 && numZ <= -353) {
                            zone = "Secteur Nord";
                        } else if (numZ >= -352 && numZ <= 352) {
                            zone = "Centre - Palier 2";
                        } else if (numZ >= 353 && numZ <= 1059) {
                            zone = "Secteur Sud";
                        }
                    } else if (numX >= 353 && numX <= 1059) {
                        if (numZ >= -1059 && numZ <= -353) {
                            zone = "Quadrant Nord-Est";
                        } else if (numZ >= -352 && numZ <= 352) {
                            zone = "Secteur Est";
                        } else if (numZ >= 353 && numZ <= 1059) {
                            zone = "Quadrant Sud-Est";
                        }
                    }
                } else {
                    // Zones pour le Palier 1 (système original)
                    // Centre approximatif : X=2560, Z=2560
                    if (numX >= 85 && numX <= 1700) {
                        if (numZ >= 85 && numZ <= 1700) {
                            zone = "Terres du Nord-Ouest";
                        } else if (numZ >= 1701 && numZ <= 3400) {
                            zone = "Plaines Centrales Ouest";
                        } else if (numZ >= 3401 && numZ <= 5036) {
                            zone = "Terres du Sud-Ouest";
                        }
                    } else if (numX >= 1701 && numX <= 3400) {
                        if (numZ >= 85 && numZ <= 1700) {
                            zone = "Territoires du Nord";
                        } else if (numZ >= 1701 && numZ <= 3400) {
                            zone = "Cœur du Royaume";
                        } else if (numZ >= 3401 && numZ <= 5036) {
                            zone = "Terres du Sud";
                        }
                    } else if (numX >= 3401 && numX <= 5036) {
                        if (numZ >= 85 && numZ <= 1700) {
                            zone = "Terres du Nord-Est";
                        } else if (numZ >= 1701 && numZ <= 3400) {
                            zone = "Plaines Centrales Est";
                        } else if (numZ >= 3401 && numZ <= 5036) {
                            zone = "Terres du Sud-Est";
                        }
                    }
                }
                
                zoneInfo.textContent = zone;
            }
        }
    });
    
    // Tracker de zoom simple pour les événements
    function updateZoomDisplay() {
        // Fonction vide - plus de contrôles visuels de zoom
    }
    
    // Événements de zoom pour mettre à jour l'affichage
    map.on('zoomend', updateZoomDisplay);
    
    // Raccourcis clavier pour le zoom
    document.addEventListener('keydown', function(e) {
        // Seulement si la carte est focusée ou si aucun input n'est actif
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            switch(e.key) {
                case '+':
                case '=':
                    e.preventDefault();
                    map.zoomIn(0.5);
                    break;
                case '-':
                case '_':
                    e.preventDefault();
                    map.zoomOut(0.5);
                    break;
                case '0':
                    e.preventDefault();
                    map.fitBounds(bounds, { padding: [20, 20] });
                    break;
                case 'c':
                case 'C':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        map.setView([2560, 2560], 0);
                    }
                    break;
                case 'm':
                case 'M':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        map.setZoom(map.getMaxZoom());
                    }
                    break;
            }
        }
    }, { signal: mapController.signal });
    
    // Amélioration du zoom par molette avec accélération
    let zoomAcceleration = 1;
    let lastWheelTime = 0;
    
    map.getContainer().addEventListener('wheel', function(e) {
        const now = Date.now();
        const timeDelta = now - lastWheelTime;
        
        // Accélération du zoom si rotation rapide
        if (timeDelta < 100) {
            zoomAcceleration = Math.min(zoomAcceleration + 0.1, 2);
        } else {
            zoomAcceleration = 1;
        }
        
        lastWheelTime = now;
    });
    
    // Message d'aide au premier chargement
    setTimeout(function() {
        if (!map) return;
        if (map.getZoom() === -3) { // Si toujours au zoom initial
            const helpTooltip = L.popup({
                closeButton: false,
                autoClose: true,
                autoPan: false,
                className: 'zoom-help-popup'
            })
            .setLatLng([2560, 2560])
            .setContent(`
                <div style="font-family: 'Orbitron', sans-serif; text-align: center;">
                    <strong style="color: #00a8ff;"><span class="map-popup-action-icon" aria-hidden="true"></span><span>Zoom amélioré !</span></strong><br>
                    <small style="color: #888;">
                        Utilisez la molette pour zoomer<br>
                        ou les contrôles en haut à droite
                    </small>
                </div>
            `)
            .openOn(map);
            
            // Fermer automatiquement après 4 secondes
            setTimeout(() => {
                if (map) map.closePopup(helpTooltip);
            }, 4000);
        }
    }, 1500);
    
    // Initialiser l'affichage du zoom
    updateZoomDisplay();
    
    // ========================================
    // SYSTÈME DE QUÊTES SUR LA CARTE
    // ========================================
    
    // Définition des quêtes avec leurs coordonnées
    const questData = [
        // QUÊTE PRINCIPALE - Introduction (1-7)
        {
            id: 'quest-1',
            name: 'Parler au Maître Épéiste',
            type: 'principale',
            step: 1,
            coordinates: [1805, 4294],
            description: 'Commencez votre aventure - Point de spawn'
        },
        {
            id: 'quest-2', 
            name: 'Tuer 10 Sangliers',
            type: 'principale',
            step: 2,
            coordinates: [1797, 3633],
            description: 'Zone de chasse aux sangliers'
        },
        {
            id: 'quest-3',
            name: 'Parler à Abraham',
            type: 'principale', 
            step: 3,
            coordinates: [1808, 3649],
            description: 'Abraham vous attend'
        },
        {
            id: 'quest-4',
            name: 'Parler à la Vieille Mara',
            type: 'principale',
            step: 4,
            coordinates: [1560, 3411],
            description: 'Informations importantes'
        },
        {
            id: 'quest-5',
            name: 'Prendre la Rune',
            type: 'principale',
            step: 5,
            coordinates: [1421, 3092],
            description: 'Rune mystérieuse'
        },
        
        // BRANCHE 8.1 - Elma (Mizunari)
        {
            id: 'quest-8-1',
            name: 'Parler à Elma',
            type: 'principale',
            step: 8.1,
            coordinates: [3136, 3667],
            description: 'Quête d\'Elma - Mizunari'
        },
        {
            id: 'quest-8-1-2',
            name: 'Trouver Harrold',
            type: 'principale',
            step: 8.1,
            coordinates: [3326, 3787],
            description: 'Harrold vous attend'
        },
        {
            id: 'quest-8-1-5',
            name: 'Maître Épéiste (Cathédrale)',
            type: 'principale',
            step: 8.1,
            coordinates: [1839, 4530],
            description: 'Cathédrale'
        },
        {
            id: 'quest-8-1-6',
            name: 'Trouver Velka',
            type: 'principale',
            step: 8.1,
            coordinates: [2844, 2993],
            description: 'CastelBrume'
        },
        {
            id: 'quest-8-1-7',
            name: 'Parler à Eric',
            type: 'principale',
            step: 8.1,
            coordinates: [2864, 4491],
            description: 'Ruine Squelettique'
        },
        {
            id: 'quest-8-1-9',
            name: 'Téléporteur',
            type: 'principale',
            step: 8.1,
            coordinates: [2783, 4427],
            description: 'Utilisez le téléporteur'
        },
        {
            id: 'quest-8-1-10',
            name: 'Spectre Archiviste',
            type: 'principale',
            step: 8.1,
            coordinates: [2940, 4476],
            description: 'Saut requis'
        },
        {
            id: 'quest-8-1-13',
            name: 'Tuer Nasgul (Boss)',
            type: 'principale',
            step: 8.1,
            coordinates: [2821, 4439],
            description: 'Boss de fin de branche'
        },
        
        // BRANCHE 8.2 - Mine de Geldorak
        {
            id: 'quest-8-2-2',
            name: 'Parler à Neko',
            type: 'principale',
            step: 8.2,
            coordinates: [4297, 3890],
            description: 'Mine de Geldorak'
        },
        
        // SUITE PRINCIPALE (9-19)
        {
            id: 'quest-13',
            name: 'Homme Cagoulé',
            type: 'principale',
            step: 13,
            coordinates: [325, 3196],
            description: 'Homme mystérieux'
        },
        {
            id: 'quest-15',
            name: 'Parler à Catherine',
            type: 'principale',
            step: 15,
            coordinates: [2380, 2417],
            description: 'Labyrinthe'
        },
        {
            id: 'quest-16',
            name: 'Réparer le Sceau',
            type: 'principale',
            step: 16,
            coordinates: [3188, 4011],
            description: 'Archipel d\'Ika'
        },
        {
            id: 'quest-17',
            name: 'Ombre Mystérieuse',
            type: 'principale',
            step: 17,
            coordinates: [3188, 4011],
            description: 'Entité mystérieuse'
        },
        
        // TOLBANA (20-26)
        {
            id: 'quest-21',
            name: 'Parler à Mephisto',
            type: 'principale',
            step: 21,
            coordinates: [3200, 1458],
            description: 'Tolbana'
        },
        {
            id: 'quest-22',
            name: 'Rapport à Wali',
            type: 'principale',
            step: 22,
            coordinates: [3198, 1501],
            description: 'Retour à Wali'
        },
        {
            id: 'quest-23',
            name: 'Parler à Emy',
            type: 'principale',
            step: 23,
            coordinates: [3233, 1484],
            description: 'Livraison de ressources'
        },
        
        // VIRELUNE (26.1-28)
        {
            id: 'quest-26-1',
            name: 'Parler à Ramoon',
            type: 'principale',
            step: 26.1,
            coordinates: [1590, 1972],
            description: 'Virelune - Nouveau chapitre'
        },
        {
            id: 'quest-26-2',
            name: 'Parler à Malrik',
            type: 'principale',
            step: 26.2,
            coordinates: [3327, 1641],
            description: 'Tolbana'
        },
        {
            id: 'quest-27-1',
            name: 'Parler à Virel',
            type: 'principale',
            step: 27.1,
            coordinates: [1539, 1995],
            description: 'Virelune'
        },
        {
            id: 'quest-28',
            name: 'Suite avec Ramoon',
            type: 'principale',
            step: 28,
            coordinates: [1590, 1972],
            description: 'Après Léviathan'
        },
        
        // DONJON FINAL (29)
        {
            id: 'quest-29-1',
            name: 'Parler à Silrix',
            type: 'principale',
            step: 29.1,
            coordinates: [1015, 1185],
            description: 'Donjon Araignée Xal\'Zirith'
        },
        
        // QUÊTES SECONDAIRES - Ville de Départ
        {
            id: 'secondary-varn',
            name: 'Varn',
            type: 'secondaire',
            step: 'S',
            coordinates: [2067, 4291],
            description: '4 Fourrures Loup, 2 Éclats Bois, 1 Os Squelette'
        },
        {
            id: 'secondary-nacht',
            name: 'Nacht',
            type: 'secondaire',
            step: 'S',
            coordinates: [1635, 4040],
            description: '1 Coeur de Bois, 10 Pousses de Sylves → 1 Pinceau Magique'
        },
        {
            id: 'secondary-milla',
            name: 'Milla',
            type: 'secondaire',
            step: 'S',
            coordinates: [2207, 4187],
            description: '15 Fragments Feuilles, 2 Mycélium'
        },
        {
            id: 'secondary-inari',
            name: 'Inari',
            type: 'secondaire',
            step: 'S',
            coordinates: [1760, 4736],
            description: 'Full armure Ika'
        },
        {
            id: 'secondary-orin',
            name: 'Orin',
            type: 'secondaire',
            step: 'S',
            coordinates: [1745, 4724],
            description: '5 Minerais Fer, 5 Corde Arc'
        },
        {
            id: 'secondary-rikyu',
            name: 'Rikyu',
            type: 'secondaire',
            step: 'S',
            coordinates: [1500, 4315],
            description: '25 Fragments Feuilles, 8 Fleur Allium'
        },
        {
            id: 'secondary-bunta',
            name: 'Bunta',
            type: 'secondaire',
            step: 'S',
            coordinates: [1500, 4328],
            description: '5 Éclats Bois, 5 Poussière Os, 3 Noyau Silme'
        },
        {
            id: 'secondary-meiko',
            name: 'Meiko',
            type: 'secondaire',
            step: 'S',
            coordinates: [1273, 4308],
            description: '5 Tissus Araignée, 3 Cuir Usé'
        },
        {
            id: 'secondary-saria',
            name: 'Saria',
            type: 'secondaire',
            step: 'S',
            coordinates: [1274, 4317],
            description: '50 Gelées Silme, 10 Minerais Fer'
        },
        {
            id: 'secondary-tilda',
            name: 'Tilda',
            type: 'secondaire',
            step: 'S',
            coordinates: [1883, 4010],
            description: '1 Arc Courbé'
        },
        {
            id: 'secondary-lila',
            name: 'Lila',
            type: 'secondaire',
            step: 'S',
            coordinates: [1878, 3992],
            description: '1 Cœur de Bois'
        },
        
        // QUÊTES SECONDAIRES - Hanaka
        {
            id: 'secondary-genzo',
            name: 'Genzo',
            type: 'secondaire',
            step: 'S',
            coordinates: [1532, 3376],
            description: '6 Crocs Loup, 2 Éclats Bois - Hanaka'
        },
        {
            id: 'secondary-bartok',
            name: 'Bartok',
            type: 'secondaire',
            step: 'S',
            coordinates: [1526, 3377],
            description: '25 Peaux Sanglier, 25 Crocs Loup - Hanaka'
        },
        {
            id: 'secondary-greta',
            name: 'Greta',
            type: 'secondaire',
            step: 'S',
            coordinates: [1438, 3407],
            description: '15 Fleurs Allium, 5 Fils Araignée - Hanaka'
        },
        {
            id: 'secondary-therra',
            name: 'Sœur Therra',
            type: 'secondaire',
            step: 'S',
            coordinates: [1406, 3435],
            description: '20 Gelées Silme, 1 Essence Corbel - Hanaka'
        },
        {
            id: 'secondary-toban',
            name: 'Toban',
            type: 'secondaire',
            step: 'S',
            coordinates: [1356, 3441],
            description: '5 Écorces Titan, 2 Mycélium - Hanaka'
        },
        {
            id: 'secondary-rina',
            name: 'Rina',
            type: 'secondaire',
            step: 'S',
            coordinates: [1502, 3533],
            description: '4 Fleurs Allium, 2 Gelées Silme - Hanaka'
        },
        {
            id: 'secondary-maya',
            name: 'Maya',
            type: 'secondaire',
            step: 'S',
            coordinates: [1500, 3560],
            description: '8 Brindilles Enchantées, 2 Gelée Silme - Hanaka'
        },
        
        // QUÊTES SECONDAIRES - Mizunari
        {
            id: 'secondary-michelle',
            name: 'Michelle',
            type: 'secondaire',
            step: 'S',
            coordinates: [3131, 3666],
            description: '10 Fragments Feuilles - Mizunari'
        },
        {
            id: 'secondary-martine',
            name: 'Martine',
            type: 'secondaire',
            step: 'S',
            coordinates: [3150, 3672],
            description: '16 Épis Sauvages - Mizunari'
        },
        {
            id: 'secondary-elwyn',
            name: 'Elwyn',
            type: 'secondaire',
            step: 'S',
            coordinates: [3111, 3703],
            description: '10 Écorces, 10 Brindilles, 3 Racines - Mizunari'
        },
        {
            id: 'secondary-louise',
            name: 'Louise',
            type: 'secondaire',
            step: 'S',
            coordinates: [3147, 3704],
            description: '10 Lingots Cuivre - Mizunari'
        },
        {
            id: 'secondary-phares',
            name: 'Phares',
            type: 'secondaire',
            step: 'S',
            coordinates: [3149, 3714],
            description: '20 Bloches Bois - Mizunari'
        },
        
        // QUÊTES SECONDAIRES - Jardin des Géants
        {
            id: 'secondary-zebulgarath',
            name: 'Zebulgarath',
            type: 'secondaire',
            step: 'S',
            coordinates: [372, 2477],
            description: '3 Racines Ancestrales - Jardin des Géants'
        },
        
        // QUÊTES SECONDAIRES - Valhatt
        {
            id: 'secondary-saya',
            name: 'Saya',
            type: 'secondaire',
            step: 'S',
            coordinates: [492, 3028],
            description: '4 Tissus Spectral, 3 Brindilles - Valhatt'
        },
        {
            id: 'secondary-ayaka',
            name: 'Ayaka',
            type: 'secondaire',
            step: 'S',
            coordinates: [479, 3013],
            description: '25 Pousses Sylves, 5 Mycélium - Valhatt'
        },
        {
            id: 'secondary-daiki',
            name: 'Daiki',
            type: 'secondaire',
            step: 'S',
            coordinates: [430, 3046],
            description: '4 Peaux Sanglier, 2 Crocs Albal - Valhatt'
        },
        
        // QUÊTES SECONDAIRES - Camp Militaire
        {
            id: 'secondary-jean',
            name: 'Jean',
            type: 'secondaire',
            step: 'S',
            coordinates: [3225, 2891],
            description: '40 Bloches Chêne, 20 Minerais Fer - Camp Militaire'
        },
        {
            id: 'secondary-corentin',
            name: 'Corentin',
            type: 'secondaire',
            step: 'S',
            coordinates: [3291, 2905],
            description: '64 Bloches Chêne - Camp Militaire'
        },
        {
            id: 'secondary-fira',
            name: 'Fira',
            type: 'secondaire',
            step: 'S',
            coordinates: [3396, 2947],
            description: '1 Éclat Glacial, 3 Poussières Os - Camp Militaire'
        },
        
        // QUÊTES SECONDAIRES - Candelia
        {
            id: 'secondary-yannis',
            name: 'Yannis',
            type: 'secondaire',
            step: 'S',
            coordinates: [2014, 834],
            description: '32 Bûches bois - Candelia'
        },
        {
            id: 'secondary-gilmar',
            name: 'Gilmar',
            type: 'secondaire',
            step: 'S',
            coordinates: [1959, 791],
            description: '10 Éclats Glacial, 5 Fragments Violet - Candelia'
        },
        {
            id: 'secondary-tomoko',
            name: 'Tomoko',
            type: 'secondaire',
            step: 'S',
            coordinates: [1955, 814],
            description: '20 Écorce Sylvestre, 5 Racines - Candelia'
        },
        {
            id: 'secondary-pierre',
            name: 'Pierre',
            type: 'secondaire',
            step: 'S',
            coordinates: [2018, 877],
            description: '20 Buches Bois - Candelia'
        },
        {
            id: 'secondary-romeo',
            name: 'Roméo',
            type: 'secondaire',
            step: 'S',
            coordinates: [1991, 832],
            description: '16 Peaux Cerf Montagnes - Candelia'
        },
        {
            id: 'secondary-emilie',
            name: 'Émilie',
            type: 'secondaire',
            step: 'S',
            coordinates: [1984, 753],
            description: '20 Épis Blé - Candelia'
        },
        
        // QUÊTES SECONDAIRES - Virelune
        {
            id: 'secondary-juliette',
            name: 'Juliette',
            type: 'secondaire',
            step: 'S',
            coordinates: [1565, 1968],
            description: '16 Bûches Chêne, 16 Bûches Bouleau - Virelune'
        },
        {
            id: 'secondary-luc',
            name: 'Luc',
            type: 'secondaire',
            step: 'S',
            coordinates: [1624, 1852],
            description: '3 Pioches Félés - Virelune'
        },
        {
            id: 'secondary-sam',
            name: 'Sam',
            type: 'secondaire',
            step: 'S',
            coordinates: [1600, 2006],
            description: 'Tuer 20 Araignées - Virelune'
        },
        {
            id: 'secondary-monique',
            name: 'Monique',
            type: 'secondaire',
            step: 'S',
            coordinates: [1563, 2000],
            description: 'Tuer 10 Requins - Virelune'
        },
        
        // QUÊTES SECONDAIRES - SVF (Sans Village Fixe)
        {
            id: 'secondary-gilbert',
            name: 'Gilbert',
            type: 'secondaire',
            step: 'S',
            coordinates: [1700, 1018],
            description: '15 Tissus Spectral - SVF'
        },
        {
            id: 'secondary-horace',
            name: 'Horace',
            type: 'secondaire',
            step: 'S',
            coordinates: [3084, 1913],
            description: '12 Cuirs Usé, 8 Peaux Cerf - SVF'
        },
        {
            id: 'secondary-haruto',
            name: 'Haruto',
            type: 'secondaire',
            step: 'S',
            coordinates: [1868, 2112],
            description: '30 Gelées Silme, 25 Carapaces Requin - SVF'
        }
    ];

    // Données des villes
    const villesData = [
        {
            id: 'ville-depart',
            name: 'Ville de départ',
            coordinates: [1800, 4297],
            description: 'Point de départ de votre aventure'
        },
        {
            id: 'hanaka',
            name: 'Hanaka',
            coordinates: [1531, 3423],
            description: 'Ville prospère au cœur du royaume'
        },
        {
            id: 'mizunari',
            name: 'Mizunari',
            coordinates: [3138, 3684],
            description: 'Cité portuaire animée'
        },
        {
            id: 'tolbana',
            name: 'Tolbana',
            coordinates: [3306, 1603],
            description: 'Ville fortifiée du nord'
        },
        {
            id: 'virelune',
            name: 'Virelune',
            coordinates: [1617, 1958],
            description: 'Village mystique sous la lune'
        },
        {
            id: 'valhat',
            name: 'Valhat',
            coordinates: [500, 3059],
            description: 'Avant-poste de l\'ouest'
        }
    ];

    // Données des donjons
    const donjonsData = [
        {
            id: 'donjon-geldorak',
            name: 'Donjon de Geldorak',
            coordinates: [4270, 3891],
            description: 'Donjon redoutable gardé par Geldorak'
        },
        {
            id: 'donjon-ruine',
            name: 'Donjon Ruine',
            coordinates: [2783, 4427],
            description: 'Ruines anciennes pleines de mystères'
        },
        {
            id: 'donjon-labyrinthe',
            name: 'Donjon Le Labyrinthe',
            coordinates: [2384, 2417],
            description: 'Labyrinthe complexe et dangereux'
        },
        {
            id: 'donjon-xalzirith',
            name: 'Donjon de Xal\'Zirith',
            coordinates: [1015, 1185],
            description: 'Donjon sombre de Xal\'Zirith'
        },
        {
            id: 'donjon-kobold',
            name: 'Donjon Kobold',
            coordinates: [3412, 1080],
            description: 'Territoire des Kobolds agressifs'
        }
    ];

    // Données des marchands
    const marchandsData = [
        {
            id: 'marchand-depart',
            name: 'Marchand de départ',
            coordinates: [1788, 4162],
            description: 'Marchand général pour les débutants'
        },
        {
            id: 'marchand-outils',
            name: 'Marchand d\'outils',
            coordinates: [1812, 4162],
            description: 'Spécialisé dans les outils et équipements'
        },
        {
            id: 'forgeron-armure-depart',
            name: 'Forgeron d\'armure',
            coordinates: [1764, 4126],
            description: 'Forge des armures de qualité'
        },
        {
            id: 'forgeron-arme-depart',
            name: 'Forgeron d\'arme',
            coordinates: [1775, 4134],
            description: 'Maître forgeron d\'armes'
        },
        {
            id: 'marchand-mizunari',
            name: 'Marchand de Mizunari',
            coordinates: [3130, 3703],
            description: 'Marchand de la cité portuaire'
        },
        {
            id: 'marchand-tolbana',
            name: 'Marchand de Tolbana',
            coordinates: [3317, 1640],
            description: 'Marchand de la ville fortifiée'
        },
        {
            id: 'marchand-donjon-ruine',
            name: 'Marchand Donjon Ruine',
            coordinates: [2833, 4707],
            description: 'Marchand près des ruines'
        },
        {
            id: 'forgeron-arme-tolbana',
            name: 'Forgeron d\'arme',
            coordinates: [3236, 1483],
            description: 'Forgeron d\'armes de Tolbana'
        },
        {
            id: 'forgeron-armure-tolbana',
            name: 'Forgeron d\'armure',
            coordinates: [3236, 1483],
            description: 'Forgeron d\'armures de Tolbana'
        },
        {
            id: 'forgeron-donjon',
            name: 'Forgeron Donjon',
            coordinates: [2413, 2375],
            description: 'Forgeron spécialisé près du donjon'
        }
    ];

    // Données des zones de monstres
    const monstresData = [
        {
            id: 'zone-sanglier',
            name: 'Zone Sanglier',
            coordinates: [1866, 3575],
            description: 'Territoire des sangliers sauvages'
        },
        {
            id: 'vallee-loups',
            name: 'Vallée des Loups',
            coordinates: [2504, 3815],
            description: 'Vallée hantée par les loups'
        },
        {
            id: 'ruines-maudites',
            name: 'Ruines Maudites',
            coordinates: [2825, 4450],
            description: 'Ruines peuplées de créatures maudites'
        },
        {
            id: 'archipel-ika',
            name: 'Archipel d\'Ika',
            coordinates: [3304, 4105],
            description: 'Îles mystérieuses d\'Ika'
        },
        {
            id: 'montagnes-bandits',
            name: 'Montagnes des Bandits',
            coordinates: [4152, 3910],
            description: 'Repaire des bandits de montagne'
        },
        {
            id: 'bois-sacree',
            name: 'Bois Sacrée',
            coordinates: [1287, 3155],
            description: 'Forêt sacrée où apparaissent les Tréants'
        },
        {
            id: 'marecage-putride',
            name: 'Marécage putride',
            coordinates: [299, 3200],
            description: 'Marécage infecté et dangereux'
        },
        {
            id: 'champ-nephantes',
            name: 'Champ de Néphantes',
            coordinates: [3374, 3763],
            description: 'Champs hantés par les Néphantes'
        },
        {
            id: 'foret-noir',
            name: 'Forêt Noir',
            coordinates: [1314, 1343],
            description: 'Forêt sombre et menaçante'
        },
        {
            id: 'atlantide',
            name: 'Atlantide',
            coordinates: [1369, 1940],
            description: 'Cité engloutie d\'Atlantide'
        },
        {
            id: 'montagne-cerfs',
            name: 'Montagne des Cerfs',
            coordinates: [4109, 1133],
            description: 'Montagnes paisibles des cerfs'
        },
        {
            id: 'citadelle-glace',
            name: 'Citadelle de Glace',
            coordinates: [3995, 2012],
            description: 'Forteresse de glace éternelle'
        }
    ];
    
    // Groupe de couches pour les quêtes
    questLayers = L.layerGroup();
    questLayers.addTo(map);
    
    // Créer les icônes personnalisées pour les quêtes
    // Détecter si on est dans le dossier pages/ ou à la racine
    const basePath = window.location.pathname.includes('/pages/') ? '../assets/map_assets/' : './assets/map_assets/';
    const cacheBuster = '?v=20260128';
    
    const questSecondaryIcon = L.icon({
        iconUrl: basePath + 'Quetes-Secondaires.png' + cacheBuster,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
    });
    
    const questMainIcon = L.icon({
        iconUrl: basePath + 'Quetes-Principales.png' + cacheBuster,
        iconSize: [40, 40], // Plus grande pour les quêtes principales
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
    });

    // Icônes pour les villes
    const villeIcon = L.icon({
        iconUrl: basePath + 'Ville.png' + cacheBuster,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18]
    });

    // Icônes pour les donjons
    const donjonIcon = L.icon({
        iconUrl: basePath + 'Donjon.png' + cacheBuster,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
        popupAnchor: [0, -19]
    });

    // Icônes pour les marchands
    const marchandIcon = L.icon({
        iconUrl: basePath + 'Marchand.png' + cacheBuster,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -17]
    });

    // Icônes pour les zones de monstres
    const monstreIcon = L.icon({
        iconUrl: basePath + 'Monstre.png' + cacheBuster,
        iconSize: [35, 35],
        iconAnchor: [17.5, 17.5],
        popupAnchor: [0, -17.5]
    });
    
    // Fonction pour convertir les coordonnées du jeu vers Leaflet
    // Même formule pour tous les paliers: Z inversé (5121 - Z), X identique
    function gameToLeafletCoords(gameX, gameZ, floor = 1) {
        // Formule universelle pour tous les paliers
        return [5121 - gameZ, gameX];
    }
    
    // Fonction pour regrouper les quêtes par coordonnées identiques
    function groupQuestsByCoordinates(quests) {
        const grouped = {};
        
        quests.forEach(quest => {
            const key = `${quest.coordinates[0]}_${quest.coordinates[1]}`;
            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(quest);
        });
        
        return grouped;
    }
    
    // Créer les marqueurs de quêtes
    function createQuestMarkers() {
        const groupedQuests = groupQuestsByCoordinates(questData);
        
        Object.values(groupedQuests).forEach(questGroup => {
            const quest = questGroup[0]; // Prendre la première quête du groupe
            const leafletCoords = gameToLeafletCoords(quest.coordinates[0], quest.coordinates[1]);
            
            // Choisir l'icône selon le type de quête
            const icon = quest.type === 'principale' ? questMainIcon : questSecondaryIcon;
            
            // Créer le nom combiné pour les groupes de quêtes
            const combinedName = questGroup.length === 1 
                ? quest.name 
                : questGroup.map(q => q.name).join(' / ');
            
            // Créer le marqueur avec les options de type pour le système de toggles
            const marker = L.marker(leafletCoords, { 
                icon: icon,
                questType: quest.type, // Ajouter le type pour l'organisation des couches
                questName: combinedName, // Compatibilité avec l'organisation des couches
                questEntries: questGroup.map(q => ({
                    name: q.name,
                    type: q.type,
                    npc: q.npc || '',
                    description: q.description
                }))
            });
            
            // Créer le contenu du popup
            let popupContent = '';
            
            if (questGroup.length === 1) {
                // Une seule quête à cette position
                const q = questGroup[0];
                popupContent = `
                    <div class="quest-popup">
                        <div class="quest-header ${q.type}">
                            <strong><span class="map-popup-symbol ${q.type}" aria-hidden="true"></span><span>${q.name}</span></strong>
                        </div>
                        <div class="quest-details">
                            <p><strong>Type:</strong> ${q.type === 'principale' ? 'Quête Principale' : 'Quête Secondaire'}</p>
                            <p><strong>Étape:</strong> ${q.step}</p>
                            <p><strong>Position:</strong> X:${q.coordinates[0]}, Z:${q.coordinates[1]}</p>
                            <p class="quest-description">${q.description}</p>
                        </div>
                        <div class="quest-actions">
                            <button type="button" data-map-action="open-quests" class="quest-btn"><span class="map-popup-action-icon" aria-hidden="true"></span><span>Voir toutes les quêtes</span></button>
                        </div>
                    </div>
                `;
            } else {
                // Plusieurs quêtes à la même position
                popupContent = `
                    <div class="quest-popup multi-quest" style="min-width: 280px;">
                        <div class="quest-header" style="background: linear-gradient(135deg, #4a90d9, #357abd); padding: 12px; border-radius: 8px 8px 0 0;">
                            <strong style="font-size: 1.1em;"><span class="map-popup-symbol grouped" aria-hidden="true"></span><span>${questGroup.length}</span> <span>Quêtes à cet emplacement</span></strong>
                        </div>
                        <div class="quest-list" style="max-height: 300px; overflow-y: auto; padding: 10px;">
                `;
                
                questGroup.forEach(q => {
                    popupContent += `
                        <div class="quest-item ${q.type}" style="background: ${q.type === 'principale' ? 'rgba(255,215,0,0.15)' : 'rgba(100,149,237,0.15)'}; border-left: 3px solid ${q.type === 'principale' ? '#ffd700' : '#6495ed'}; padding: 10px; margin-bottom: 8px; border-radius: 4px;">
                            <div style="display: flex; align-items: center; margin-bottom: 5px;">
                                <span class="map-popup-symbol ${q.type}" aria-hidden="true"></span>
                                <strong style="color: ${q.type === 'principale' ? '#ffd700' : '#87ceeb'};">${q.name}</strong>
                            </div>
                            <div style="font-size: 0.9em; color: #ccc;">
                                <p style="margin: 3px 0;"><strong>Étape:</strong> ${q.step}</p>
                                <p style="margin: 3px 0; font-style: italic; color: #aaa;">${q.description}</p>
                            </div>
                        </div>
                    `;
                });
                
                popupContent += `
                        </div>
                        <div class="quest-details" style="padding: 10px; background: rgba(0,0,0,0.3); border-radius: 0 0 8px 8px;">
                            <p style="margin: 0;"><strong><span class="map-popup-pin" aria-hidden="true"></span><span>Position:</span></strong> X:${quest.coordinates[0]}, Z:${quest.coordinates[1]}</p>
                        </div>
                        <div class="quest-actions" style="padding: 10px;">
                            <button type="button" data-map-action="open-quests" class="quest-btn"><span class="map-popup-action-icon" aria-hidden="true"></span><span>Voir toutes les quêtes</span></button>
                        </div>
                    </div>
                `;
            }
            
            // Options responsive pour les popups
            const isMobile = window.innerWidth <= 480;
            const isTablet = window.innerWidth <= 768 && window.innerWidth > 480;
            
            const popupOptions = {
                className: 'quest-marker-popup',
                maxWidth: isMobile ? 220 : (isTablet ? 280 : 400),
                minWidth: isMobile ? 180 : (isTablet ? 220 : 300),
                autoPan: true,
                autoPanPadding: [10, 10],
                closeButton: true
            };
            
            marker.bindPopup(popupContent, popupOptions);
            
            // Ajouter le marqueur au groupe de quêtes
            questLayers.addLayer(marker);
        });
    }
    
    // Créer les marqueurs de quêtes
    createQuestMarkers();

    // Fonction pour créer les marqueurs de villes
    function createVilleMarkers() {
        // console.log(`🏰 Creating ${villesData.length} ville markers`);
        villesData.forEach(ville => {
            const leafletCoords = gameToLeafletCoords(ville.coordinates[0], ville.coordinates[1]);
            
            const marker = L.marker(leafletCoords, { 
                icon: villeIcon,
                locationName: ville.name,
                locationType: 'Ville'
            });

            const popupContent = `
                <div class="location-popup ville">
                    <div class="location-header">
                        <strong><span class="map-popup-symbol town" aria-hidden="true"></span><span>${ville.name}</span></strong>
                    </div>
                    <div class="location-details">
                        <p><strong>Type:</strong> Ville</p>
                        <p><strong>Position:</strong> X:${ville.coordinates[0]}, Z:${ville.coordinates[1]}</p>
                        <p class="location-description">${ville.description}</p>
                    </div>
                </div>
            `;

            // Options responsive pour les popups
            const isMobile = window.innerWidth <= 480;
            const isTablet = window.innerWidth <= 768 && window.innerWidth > 480;
            
            const popupOptions = {
                maxWidth: isMobile ? 220 : (isTablet ? 280 : 350),
                autoPan: true,
                autoPanPadding: [10, 10]
            };
            
            marker.bindPopup(popupContent, popupOptions);
            layerGroups.villes.addLayer(marker);
        });
    }

    // Fonction pour créer les marqueurs de donjons
    function createDonjonMarkers() {
        // console.log(`⚔️ Creating ${donjonsData.length} donjon markers`);
        donjonsData.forEach(donjon => {
            const leafletCoords = gameToLeafletCoords(donjon.coordinates[0], donjon.coordinates[1]);
            
            const marker = L.marker(leafletCoords, { 
                icon: donjonIcon,
                locationName: donjon.name,
                locationType: 'Donjon'
            });

            const popupContent = `
                <div class="location-popup donjon">
                    <div class="location-header">
                        <strong><span class="map-popup-symbol dungeon" aria-hidden="true"></span><span>${donjon.name}</span></strong>
                    </div>
                    <div class="location-details">
                        <p><strong>Type:</strong> Donjon</p>
                        <p><strong>Position:</strong> X:${donjon.coordinates[0]}, Z:${donjon.coordinates[1]}</p>
                        <p class="location-description">${donjon.description}</p>
                    </div>
                </div>
            `;

            // Options responsive pour les popups
            const isMobile = window.innerWidth <= 480;
            const isTablet = window.innerWidth <= 768 && window.innerWidth > 480;
            
            const popupOptions = {
                maxWidth: isMobile ? 220 : (isTablet ? 280 : 350),
                autoPan: true,
                autoPanPadding: [10, 10]
            };
            
            marker.bindPopup(popupContent, popupOptions);
            layerGroups.donjons.addLayer(marker);
        });
    }

    // Fonction pour créer les marqueurs de marchands
    function createMarchandMarkers() {
        // console.log(`🛒 Creating ${marchandsData.length} marchand markers`);
        marchandsData.forEach(marchand => {
            const leafletCoords = gameToLeafletCoords(marchand.coordinates[0], marchand.coordinates[1]);
            
            const marker = L.marker(leafletCoords, { 
                icon: marchandIcon,
                locationName: marchand.name,
                locationType: 'Marchand'
            });

            const popupContent = `
                <div class="location-popup marchand">
                    <div class="location-header">
                        <strong><span class="map-popup-symbol merchant" aria-hidden="true"></span><span>${marchand.name}</span></strong>
                    </div>
                    <div class="location-details">
                        <p><strong>Type:</strong> Marchand</p>
                        <p><strong>Position:</strong> X:${marchand.coordinates[0]}, Z:${marchand.coordinates[1]}</p>
                        <p class="location-description">${marchand.description}</p>
                    </div>
                </div>
            `;

            // Options responsive pour les popups
            const isMobile = window.innerWidth <= 480;
            const isTablet = window.innerWidth <= 768 && window.innerWidth > 480;
            
            const popupOptions = {
                maxWidth: isMobile ? 220 : (isTablet ? 280 : 350),
                autoPan: true,
                autoPanPadding: [10, 10]
            };
            
            marker.bindPopup(popupContent, popupOptions);
            layerGroups.marchands.addLayer(marker);
        });
    }

    // Fonction pour créer les marqueurs de zones de monstres
    function createMonstreMarkers() {
        // console.log(`👹 Creating ${monstresData.length} monstre markers`);
        monstresData.forEach(zone => {
            const leafletCoords = gameToLeafletCoords(zone.coordinates[0], zone.coordinates[1]);
            
            const marker = L.marker(leafletCoords, { 
                icon: monstreIcon,
                locationName: zone.name,
                locationType: 'Zone de Monstres'
            });

            const popupContent = `
                <div class="location-popup monstre">
                    <div class="location-header">
                        <strong><span class="map-popup-symbol monster" aria-hidden="true"></span><span>${zone.name}</span></strong>
                    </div>
                    <div class="location-details">
                        <p><strong>Type:</strong> Zone de Monstres</p>
                        <p><strong>Position:</strong> X:${zone.coordinates[0]}, Z:${zone.coordinates[1]}</p>
                        <p class="location-description">${zone.description}</p>
                    </div>
                </div>
            `;

            // Options responsive pour les popups
            const isMobile = window.innerWidth <= 480;
            const isTablet = window.innerWidth <= 768 && window.innerWidth > 480;
            
            const popupOptions = {
                maxWidth: isMobile ? 220 : (isTablet ? 280 : 350),
                autoPan: true,
                autoPanPadding: [10, 10]
            };
            
            marker.bindPopup(popupContent, popupOptions);
            layerGroups.monstres.addLayer(marker);
        });
    }

    // Fonction pour créer les marqueurs de quêtes du Palier 2
    function createFloor2QuestMarkers() {
        const groupedQuests = {};
        
        // Grouper les quêtes par coordonnées
        questDataFloor2.forEach(quest => {
            const key = `${quest.coordinates[0]}_${quest.coordinates[1]}`;
            if (!groupedQuests[key]) {
                groupedQuests[key] = [];
            }
            groupedQuests[key].push(quest);
        });
        
        Object.values(groupedQuests).forEach(questGroup => {
            const quest = questGroup[0];
            const leafletCoords = gameToLeafletCoords(quest.coordinates[0], quest.coordinates[1], 2);
            
            // Choisir l'icône selon le type
            const icon = quest.type === 'principale' ? questMainIcon : questSecondaryIcon;
            
            // Créer le nom combiné pour les groupes
            const combinedName = questGroup.length === 1 
                ? quest.name 
                : questGroup.map(q => q.name).join(' / ');
            
            // Combiner les noms de PNJ
            const combinedNpc = questGroup.length === 1
                ? quest.npc || ''
                : questGroup.map(q => q.npc || '').filter(n => n).join(' / ');
            
            const marker = L.marker(leafletCoords, { 
                icon: icon,
                questType: quest.type,
                questName: combinedName,
                npcName: combinedNpc,
                questEntries: questGroup.map(q => ({
                    name: q.name,
                    type: q.type,
                    npc: q.npc || '',
                    description: q.description
                }))
            });
            
            // Créer le contenu du popup
            let popupContent = '';
            
            if (questGroup.length === 1) {
                const q = questGroup[0];
                popupContent = `
                    <div class="quest-popup">
                        <div class="quest-header ${q.type}">
                            <strong><span class="map-popup-symbol ${q.type}" aria-hidden="true"></span><span>${q.name}</span></strong>
                        </div>
                        <div class="quest-details">
                            <p><strong>Type:</strong> ${q.type === 'principale' ? 'Quête Principale' : 'Quête Secondaire'}</p>
                            <p><strong>PNJ:</strong> ${q.npc || 'N/A'}</p>
                            <p><strong>Étape:</strong> ${q.step}</p>
                            <p><strong>Position:</strong> X:${q.coordinates[0]}, Z:${q.coordinates[1]}</p>
                            <p class="quest-description">${q.description}</p>
                        </div>
                        <div class="quest-actions">
                            <button type="button" data-map-action="open-quests" class="quest-btn"><span class="map-popup-action-icon" aria-hidden="true"></span><span>Voir toutes les quêtes</span></button>
                        </div>
                    </div>
                `;
            } else {
                popupContent = `
                    <div class="quest-popup multi-quest" style="min-width: 280px;">
                        <div class="quest-header" style="background: linear-gradient(135deg, #4a90d9, #357abd); padding: 12px; border-radius: 8px 8px 0 0;">
                            <strong style="font-size: 1.1em;"><span class="map-popup-symbol grouped" aria-hidden="true"></span><span>${questGroup.length}</span> <span>Quêtes à cet emplacement</span></strong>
                        </div>
                        <div class="quest-list" style="max-height: 300px; overflow-y: auto; padding: 10px;">
                            ${questGroup.map((q, index) => `
                                <div class="quest-item ${q.type}" style="background: ${q.type === 'principale' ? 'rgba(255,215,0,0.15)' : 'rgba(100,149,237,0.15)'}; border-left: 3px solid ${q.type === 'principale' ? '#ffd700' : '#6495ed'}; padding: 10px; margin-bottom: 8px; border-radius: 4px;">
                                    <div style="display: flex; align-items: center; margin-bottom: 5px;">
                                        <span class="map-popup-symbol ${q.type}" aria-hidden="true"></span>
                                        <strong style="color: ${q.type === 'principale' ? '#ffd700' : '#87ceeb'};">${q.name}</strong>
                                    </div>
                                    <div style="font-size: 0.9em; color: #ccc;">
                                        <p style="margin: 3px 0;"><strong>PNJ:</strong> ${q.npc || 'N/A'}</p>
                                        <p style="margin: 3px 0;"><strong>Étape:</strong> ${q.step}</p>
                                        <p style="margin: 3px 0; font-style: italic; color: #aaa;">${q.description}</p>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="quest-details" style="padding: 10px; background: rgba(0,0,0,0.3); border-radius: 0 0 8px 8px;">
                            <p style="margin: 0;"><strong><span class="map-popup-pin" aria-hidden="true"></span><span>Position:</span></strong> X:${quest.coordinates[0]}, Z:${quest.coordinates[1]}</p>
                        </div>
                    </div>
                `;
            }
            
            // Options responsive
            const isMobile = window.innerWidth <= 480;
            const isTablet = window.innerWidth <= 768 && window.innerWidth > 480;
            
            const popupOptions = {
                maxWidth: isMobile ? 250 : (isTablet ? 300 : 400),
                autoPan: true,
                autoPanPadding: [10, 10]
            };
            
            marker.bindPopup(popupContent, popupOptions);
            
            // Ajouter au groupe approprié
            if (quest.type === 'principale') {
                layerGroupsFloor2.questesPrincipales.addLayer(marker);
            } else {
                layerGroupsFloor2.questesSecondaires.addLayer(marker);
            }
        });
    }

    // Créer tous les marqueurs
    // console.log('🚀 Creating all markers...');
    createQuestMarkers();
    // console.log('✅ Quest markers created');
    createVilleMarkers();
    // console.log('✅ Ville markers created');
    createDonjonMarkers();
    // console.log('✅ Donjon markers created');
    createMarchandMarkers();
    // console.log('✅ Marchand markers created');
    createMonstreMarkers();
    // console.log('✅ Monstre markers created');
    createFloor2QuestMarkers();
    // console.log('✅ Floor 2 Quest markers created');
    
    // Organiser les marqueurs de quêtes par type et initialiser les toggles
    // console.log('📋 Organizing markers into groups...');
    organizeMarkersIntoGroups();
    // console.log('🎛️ Initializing toggles...');
    initializeToggles();
    
    // Vérifier les paramètres URL pour centrer sur une quête spécifique
    // Si pas de paramètres URL, restaurer l'état sauvegardé
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('x') || urlParams.get('y') || urlParams.get('floor')) {
        checkURLParams();
    } else {
        restoreMapState();
    }

    // Recalcul de la taille après injection dans le DOM (utile en SPA)
    setTimeout(function () { if (map) map.invalidateSize(); }, 60);

    // Recalcul au redimensionnement (équivaut au script inline de la page)
    window.addEventListener('resize', function () {
        clearTimeout(mapResizeTimer);
        mapResizeTimer = setTimeout(function () { if (map) map.invalidateSize(); }, 250);
    }, { signal: mapController.signal });
}

function destroyMapView() {
    if (mapController) { mapController.abort(); mapController = null; }
    if (mapResizeTimer) { clearTimeout(mapResizeTimer); mapResizeTimer = null; }
    if (map) {
        try { map.remove(); } catch (e) { /* instance déjà détruite */ }
        map = null;
    }
    currentMapOverlay = null;
    questLayers = null;
    currentFloor = 1;
    Object.values(layerGroups).forEach(g => g.clearLayers());
    Object.values(layerGroupsFloor2).forEach(g => g.clearLayers());
}

window.NamelessMapPage = { init: initMapView, destroy: destroyMapView };

function mapAutoStart() {
    if (window.NamelessSpaRouter && window.NamelessSpaRouter.controlsLifecycle) return;
    initMapView();
}

// Fonction globale pour ouvrir la page des quêtes
function openQuestPage() {
    if (window.NamelessSpaRouter && typeof window.NamelessSpaRouter.navigate === 'function') {
        window.NamelessSpaRouter.navigate('/quetes');
        return;
    }
    window.location.href = '/quetes';
}

if (!window.NamelessMapQuestActionBound) {
    window.NamelessMapQuestActionBound = true;
    document.addEventListener('click', function(event) {
        var target = event.target && event.target.closest ? event.target.closest('[data-map-action="open-quests"]') : null;
        if (!target) return;
        event.preventDefault();
        openQuestPage();
    });
}

// ==========================================
// SYSTÈME DE TOGGLES POUR VISIBILITÉ
// ==========================================

// Variables pour stocker les marqueurs
let questesMarkers = [];
let questesSecondairesMarkers = [];

// Fonction pour réorganiser les marqueurs existants dans les groupes
function organizeMarkersIntoGroups() {
    // Les marqueurs de quêtes sont déjà dans questLayers
    // On va réorganiser par type
    questLayers.eachLayer(function(marker) {
        if (marker.options && marker.options.questType) {
            if (marker.options.questType === 'principale') {
                layerGroups.questesPrincipales.addLayer(marker);
            } else {
                layerGroups.questesSecondaires.addLayer(marker);
            }
        }
    });
    
    // Retirer le questLayers original puisqu'on utilise maintenant les groupes séparés
    if (map.hasLayer(questLayers)) {
        map.removeLayer(questLayers);
    }
    
    // Ajouter tous les layerGroups à la carte (ils seront visibles par défaut)
    Object.values(layerGroups).forEach(layerGroup => {
        if (layerGroup.getLayers().length > 0) {
            layerGroup.addTo(map);
        }
    });
    
    // Logs de débogage
    // console.log('=== Debug LayerGroups ===');
    Object.entries(layerGroups).forEach(([name, layerGroup]) => {
        // console.log(`${name}: ${layerGroup.getLayers().length} marqueurs`);
    });
}

// Fonction de gestion des toggles
function initializeToggles() {
    // Définir les mappings pour chaque palier
    const toggleMappings = {
        'toggle-quetes-secondaires': {
            1: layerGroups.questesSecondaires,
            2: layerGroupsFloor2.questesSecondaires
        },
        'toggle-quetes-principales': {
            1: layerGroups.questesPrincipales,
            2: layerGroupsFloor2.questesPrincipales
        },
        'toggle-donjons': { 1: layerGroups.donjons },
        'toggle-villes': { 1: layerGroups.villes },
        'toggle-monstres': { 1: layerGroups.monstres },
        'toggle-marchands': { 1: layerGroups.marchands }
    };
    
    Object.entries(toggleMappings).forEach(([toggleId, floorLayers]) => {
        const toggle = document.getElementById(toggleId);
        const label = document.querySelector(`label[for="${toggleId}"]`);
        
        if (toggle) {
            // S'assurer que tous les toggles sont cochés par défaut
            toggle.checked = true;
            
            // Fonction pour gérer le toggle - utilise le palier actuel
            const handleToggle = function() {
                const isChecked = toggle.checked;
                const layerGroup = floorLayers[currentFloor];
                
                if (!layerGroup) return; // Pas de layer pour ce palier
                
                if (isChecked) {
                    if (!map.hasLayer(layerGroup)) {
                        layerGroup.addTo(map);
                    }
                } else {
                    if (map.hasLayer(layerGroup)) {
                        map.removeLayer(layerGroup);
                    }
                }
            };
            
            // Écouter les événements sur la checkbox
            toggle.addEventListener('change', handleToggle);
            toggle.addEventListener('click', handleToggle);
            
            // Écouter aussi les clics sur le label
            if (label) {
                label.addEventListener('click', function(e) {
                    setTimeout(handleToggle, 10);
                });
            }
        }
    });
    
    // Forcer l'affichage des layers du palier actuel
    Object.entries(toggleMappings).forEach(([name, floorLayers]) => {
        const layerGroup = floorLayers[currentFloor];
        if (layerGroup && layerGroup.getLayers().length > 0 && !map.hasLayer(layerGroup)) {
            layerGroup.addTo(map);
        }
    });
    
    // Gestion du bouton admin (exemple - peut être étendu)
    const adminBtn = document.querySelector('.admin-toggle-btn');
    if (adminBtn) {
        adminBtn.addEventListener('click', function() {
            alert('Fonctionnalité admin à venir...');
        });
    }
    
    // ==========================================
    // SYSTÈME DE RECHERCHE SUR LA CARTE
    // ==========================================
    initializeMapSearch();
}

// Variable globale pour les éléments recherchables
let currentSearchableItems = [];

// Fonction pour reconstruire les éléments recherchables (appelée lors du changement de palier)
function rebuildSearchableItems() {
    currentSearchableItems = buildSearchableItems();
}

// Fonction d'initialisation de la recherche sur la carte
function initializeMapSearch() {
    const searchInput = document.getElementById('map-search-input');
    const searchResults = document.getElementById('map-search-results');
    const searchClear = document.getElementById('map-search-clear');
    const searchContainer = searchInput?.closest('.map-search-container');
    
    if (!searchInput || !searchResults) return;
    
    // Construire la liste des éléments recherchables initiale
    currentSearchableItems = buildSearchableItems();
    
    // Événement de saisie
    searchInput.addEventListener('input', function(e) {
        const query = e.target.value.trim().toLowerCase();
        
        // Afficher/masquer le bouton clear
        if (searchClear) {
            searchClear.style.display = query.length > 0 ? 'flex' : 'none';
        }
        
        if (query.length < 2) {
            hideSearchResults(searchResults, searchInput, searchContainer);
            return;
        }
        
        // Toujours utiliser la liste mise à jour
        const results = searchItems(currentSearchableItems, query);
        displaySearchResults(results, searchResults);
    });
    
    // Bouton clear
    if (searchClear) {
        searchClear.addEventListener('click', function() {
            searchInput.value = '';
            hideSearchResults(searchResults, searchInput, searchContainer);
            searchClear.style.display = 'none';
            searchInput.focus();
        });
    }
    
    // Fermer les résultats si on clique ailleurs
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.map-search-container')) {
            hideSearchResults(searchResults, searchInput, searchContainer);
        }
    }, { signal: mapController.signal });

    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            hideSearchResults(searchResults, searchInput, searchContainer);
            return;
        }
        if (e.key === 'ArrowDown') {
            const firstResult = searchResults.querySelector('.search-result-item');
            if (firstResult) {
                e.preventDefault();
                firstResult.focus();
            }
        }
    });
    
    // Réouvrir les résultats si on focus l'input
    searchInput.addEventListener('focus', function() {
        if (searchInput.value.trim().length >= 2) {
            const results = searchItems(currentSearchableItems, searchInput.value.trim().toLowerCase());
            displaySearchResults(results, searchResults);
        }
    });
}

function hideSearchResults(container, input, searchContainer) {
    container.style.display = 'none';
    input?.setAttribute('aria-expanded', 'false');
    searchContainer?.classList.remove('has-results');
}

// Construire la liste des éléments recherchables
function buildSearchableItems() {
    const items = [];
    
    // Déterminer quel groupe utiliser selon le palier actuel
    const currentQuestGroups = currentFloor === 2 ? layerGroupsFloor2 : layerGroups;
    
    function appendQuestSearchItems(group, fallbackType) {
        group.eachLayer(function(marker) {
            const entries = marker.options?.questEntries || (marker.options?.questName ? [{
                name: marker.options.questName,
                type: fallbackType,
                npc: marker.options.npcName || ''
            }] : []);

            entries.forEach(entry => {
                const translatedType = entry.type === 'principale' ? 'Quête Principale' : 'Quête Secondaire';
                items.push({
                    name: entry.name,
                    type: translatedType,
                    coordinates: marker.getLatLng(),
                    marker: marker,
                    floor: currentFloor
                });

                if (entry.npc) {
                    items.push({
                        name: entry.npc,
                        type: 'PNJ',
                        coordinates: marker.getLatLng(),
                        marker: marker,
                        floor: currentFloor,
                        questName: entry.name
                    });
                }
            });
        });
    }

    appendQuestSearchItems(currentQuestGroups.questesPrincipales, 'principale');
    appendQuestSearchItems(currentQuestGroups.questesSecondaires, 'secondaire');
    
    // Les éléments suivants ne sont disponibles que sur le Palier 1
    if (currentFloor === 1) {
        // Ajouter les villes
        layerGroups.villes.eachLayer(function(marker) {
            if (marker.options?.locationName) {
                items.push({
                    name: marker.options.locationName,
                    type: marker.options.locationType || 'Ville',
                    coordinates: marker.getLatLng(),
                    marker: marker,
                    floor: 1
                });
            }
        });
        
        // Ajouter les donjons
        layerGroups.donjons.eachLayer(function(marker) {
            if (marker.options?.locationName) {
                items.push({
                    name: marker.options.locationName,
                    type: marker.options.locationType || 'Donjon',
                    coordinates: marker.getLatLng(),
                    marker: marker,
                    floor: 1
                });
            }
        });
        
        // Ajouter les monstres
        layerGroups.monstres.eachLayer(function(marker) {
            if (marker.options?.locationName) {
                items.push({
                    name: marker.options.locationName,
                    type: marker.options.locationType || 'Zone de Monstres',
                    coordinates: marker.getLatLng(),
                    marker: marker,
                    floor: 1
                });
            }
        });
        
        // Ajouter les marchands
        layerGroups.marchands.eachLayer(function(marker) {
            if (marker.options?.locationName) {
                items.push({
                    name: marker.options.locationName,
                    type: marker.options.locationType || 'Marchand',
                    coordinates: marker.getLatLng(),
                    marker: marker,
                    floor: 1
                });
            }
        });
    }
    
    return items;
}

// Rechercher dans les éléments
function searchItems(items, query) {
    const normalizedQuery = normalizeSearchText(query);
    return items.filter(item => {
        const searchableName = `${item.name} ${translateSearchText(item.name)}`;
        const searchableType = `${item.type} ${translateSearchText(item.type)}`;
        const nameMatch = normalizeSearchText(searchableName).includes(normalizedQuery);
        const typeMatch = normalizeSearchText(searchableType).includes(normalizedQuery);
        return nameMatch || typeMatch;
    }).slice(0, 15); // Limiter à 15 résultats
}

function normalizeSearchText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function getSearchTypeClass(type) {
    const normalized = normalizeSearchText(type);
    if (normalized.includes('principale')) return 'main-quest';
    if (normalized.includes('secondaire')) return 'side-quest';
    if (normalized.includes('ville')) return 'town';
    if (normalized.includes('donjon')) return 'dungeon';
    if (normalized.includes('monstre')) return 'monster';
    if (normalized.includes('marchand')) return 'merchant';
    if (normalized.includes('pnj') || normalized.includes('npc')) return 'npc';
    return 'location';
}

function translateSearchText(value) {
    return window.NamelessI18n ? window.NamelessI18n.translate(value) : value;
}

// Afficher les résultats de recherche
function displaySearchResults(results, container) {
    const searchInput = document.getElementById('map-search-input');
    const searchContainer = searchInput?.closest('.map-search-container');
    container.replaceChildren();

    if (results.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'search-no-results';
        empty.innerHTML = '<span class="search-empty-mark" aria-hidden="true"></span><strong></strong><small></small>';
        empty.querySelector('strong').textContent = 'Aucun résultat trouvé';
        empty.querySelector('small').textContent = 'Essayez un nom de quête, de PNJ, de monstre ou de ville.';
        container.appendChild(empty);
        container.style.display = 'block';
        searchInput?.setAttribute('aria-expanded', 'true');
        searchContainer?.classList.add('has-results');
        return;
    }
    
    // Grouper par type
    const grouped = {};
    results.forEach(item => {
        if (!grouped[item.type]) {
            grouped[item.type] = [];
        }
        grouped[item.type].push(item);
    });
    
    const summary = document.createElement('div');
    summary.className = 'search-results-summary';
    const resultLabel = results.length === 1 ? 'résultat' : 'résultats';
    summary.innerHTML = '<span></span><kbd>Esc</kbd>';
    summary.querySelector('span').textContent = `${results.length} ${resultLabel}`;
    container.appendChild(summary);
    
    for (const [type, items] of Object.entries(grouped)) {
        const category = document.createElement('section');
        category.className = 'search-category';
        const categoryHeader = document.createElement('div');
        categoryHeader.className = `search-category-header type-${getSearchTypeClass(type)}`;
        categoryHeader.innerHTML = '<span class="search-type-icon" aria-hidden="true"></span><span class="search-category-name"></span><span class="search-category-count"></span>';
        categoryHeader.querySelector('.search-category-name').textContent = type;
        categoryHeader.querySelector('.search-category-count').textContent = String(items.length);
        category.appendChild(categoryHeader);
        
        items.forEach(item => {
            // Convertir les coordonnées Leaflet vers coordonnées du jeu selon le palier
            let gameX, gameZ;
            if (item.floor === 2 || currentFloor === 2) {
                // Palier 2: X = lng, Z = -lat
                gameX = Math.round(item.coordinates.lng);
                gameZ = Math.round(-item.coordinates.lat);
            } else {
                // Palier 1: X = lng, Z = 5121 - lat
                gameX = Math.round(item.coordinates.lng);
                gameZ = Math.round(5121 - item.coordinates.lat);
            }
            
            const resultButton = document.createElement('button');
            resultButton.type = 'button';
            resultButton.className = `search-result-item type-${getSearchTypeClass(item.type)}`;
            resultButton.dataset.lat = item.coordinates.lat;
            resultButton.dataset.lng = item.coordinates.lng;
            resultButton.setAttribute('aria-label', `${translateSearchText('Aller à cet emplacement')} : ${item.name}, X ${gameX}, Z ${gameZ}`);

            const icon = document.createElement('span');
            icon.className = 'search-result-icon';
            icon.setAttribute('aria-hidden', 'true');

            const info = document.createElement('span');
            info.className = 'search-result-info';
            const name = document.createElement('span');
            name.className = 'search-result-name';
            name.textContent = item.name;
            const coords = document.createElement('span');
            coords.className = 'search-result-coords';
            coords.textContent = `X ${gameX}  ·  Z ${gameZ}`;
            info.append(name, coords);

            const arrow = document.createElement('span');
            arrow.className = 'search-result-arrow';
            arrow.setAttribute('aria-hidden', 'true');
            resultButton.append(icon, info, arrow);
            category.appendChild(resultButton);
        });

        container.appendChild(category);
    }
    container.style.display = 'block';
    searchInput?.setAttribute('aria-expanded', 'true');
    searchContainer?.classList.add('has-results');
    
    // Ajouter les événements de clic
    container.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', function() {
            const lat = parseFloat(this.dataset.lat);
            const lng = parseFloat(this.dataset.lng);
            
            // Centrer la carte sur l'élément
            focusMapLocation([lat, lng]);
            
            // Créer un effet de mise en surbrillance temporaire
            const highlightMarker = L.marker([lat, lng], {
                icon: L.divIcon({
                    className: 'search-highlight-marker',
                    html: `<div style="
                        background: #00ffff;
                        border: 3px solid #ffffff;
                        border-radius: 50%;
                        width: 24px;
                        height: 24px;
                        box-shadow: 0 0 25px #00ffff, 0 0 50px #00ffff;
                        animation: pulse 1s infinite;
                    "></div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                })
            }).addTo(map);
            
            // Retirer le marqueur après 3 secondes
            setTimeout(() => {
                if (map) map.removeLayer(highlightMarker);
            }, 3000);
            
            // Fermer les résultats et vider la recherche
            const activeInput = document.getElementById('map-search-input');
            hideSearchResults(container, activeInput, activeInput?.closest('.map-search-container'));
            activeInput.value = '';
            document.getElementById('map-search-clear').style.display = 'none';
        });

        item.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                (this.nextElementSibling?.matches('.search-result-item')
                    ? this.nextElementSibling
                    : this.closest('.search-category')?.nextElementSibling?.querySelector('.search-result-item'))?.focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                (this.previousElementSibling?.matches('.search-result-item')
                    ? this.previousElementSibling
                    : this.closest('.search-category')?.previousElementSibling?.querySelector('.search-result-item:last-child'))?.focus();
            } else if (e.key === 'Escape') {
                hideSearchResults(container, searchInput, searchContainer);
                searchInput?.focus();
            }
        });
    });
}

// Démarrage autonome (hors SPA) — placé en fin de module pour que toutes les
// déclarations (dont currentSearchableItems) soient initialisées avant l'init.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mapAutoStart);
} else {
    mapAutoStart();
}

// Fin du DOMContentLoaded principal
