/* One palette, contextual light/material. No player data or animation loop. */
(function (global) {
    'use strict';
    var root = document.documentElement;
    var themes = {home:'aincrad', carte:'aincrad', wiki:'aincrad', bestiaire:'forest', items:'armory', 'espace-guilde':'guild', profil:'guild', 'admin-dashboard':'guild', connexion:'guild', quetes:'dungeon'};
    function sync(route) {
        var theme = themes[route];
        if (!theme) {
            var path = global.location.pathname;
            theme = /\/boss\/|quetes/.test(path) ? 'dungeon' : /bestiaire/.test(path) ? 'forest' : /items/.test(path) ? 'armory' : /guilde|profil|admin|connexion/.test(path) ? 'guild' : 'aincrad';
        }
        root.dataset.worldAtmosphere = theme;
    }
    function visibility() { root.dataset.worldHidden = String(!!document.hidden); }
    global.NamelessWorldAtmosphere = {sync:sync};
    sync();
    visibility();
    document.addEventListener('visibilitychange', visibility);
})(window);
