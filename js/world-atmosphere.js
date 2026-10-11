/* PageAtmosphere: a viewport layer outside every route's content container. */
(function (global) {
    'use strict';
    var root = document.documentElement;
    var themes = {home:'aincrad', carte:'aincrad', wiki:'aincrad', bestiaire:'forest', items:'armory', 'espace-guilde':'guild', profil:'guild', 'admin-dashboard':'guild', connexion:'guild', quetes:'dungeon'};
    var scenes = {
        aincrad:['/assets/art-v4/aincrad-1280.webp','/assets/art-v4/aincrad-960.webp'],
        forest:['/assets/art-v4/forest-1280.webp','/assets/art-v4/forest-640.webp'],
        armory:['/assets/art-v4/workshop-1280.webp','/assets/art-v4/workshop-640.webp'],
        guild:['/assets/art-v4/guild-1280.webp','/assets/art-v4/guild-640.webp'],
        dungeon:['/assets/art-v5/kobold-arena-1280.webp','/assets/art-v5/kobold-arena-640.webp'],
        wiki:['/assets/art-v6/archives-1672.webp','/assets/art-v6/archives-640.webp'],
        carte:['/assets/art-v4/guild-1280.webp','/assets/art-v4/guild-640.webp']
    };
    function pageFromPath() {
        var path=global.location.pathname;
        if (/\/boss\//.test(path)) return 'boss';
        var leaf=path.split('/').filter(Boolean).pop() || 'home';
        leaf=leaf.replace(/\.html$/,'');
        return leaf==='index' ? 'home' : leaf;
    }
    function mount() {
        var layer=document.getElementById('nm-page-atmosphere');
        if (layer || !document.body) return layer;
        layer=document.createElement('div');
        layer.id='nm-page-atmosphere'; layer.className='nm-page-atmosphere';
        layer.setAttribute('aria-hidden','true'); layer.setAttribute('inert','');
        var picture=document.createElement('picture'); picture.className='nm-page-atmosphere__scene';
        var source=document.createElement('source'); source.media='(max-width: 768px)';
        var img=document.createElement('img'); img.alt=''; img.width=1672; img.height=941; img.decoding='async';
        picture.appendChild(source); picture.appendChild(img); layer.appendChild(picture);
        ['light','mist','veil'].forEach(function(name){var plane=document.createElement('span'); plane.className='nm-page-atmosphere__'+name; layer.appendChild(plane);});
        document.body.prepend(layer); root.dataset.worldShell='true';
        return layer;
    }
    function sync(route) {
        var page=route || pageFromPath();
        var theme = themes[route];
        if (!theme) {
            var path = global.location.pathname;
            theme = /\/boss\/|quetes/.test(path) ? 'dungeon' : /bestiaire/.test(path) ? 'forest' : /items/.test(path) ? 'armory' : /guilde|profil|admin|connexion/.test(path) ? 'guild' : 'aincrad';
        }
        root.dataset.worldAtmosphere = theme;
        root.dataset.worldPage=page;
        var layer=mount();
        if (!layer) return;
        var img=layer.querySelector('img'), source=layer.querySelector('source');
        if (page==='home') {img.removeAttribute('src'); source.removeAttribute('srcset'); return;}
        var art=scenes[page] || scenes[theme];
        if (img.getAttribute('src')!==art[0]) img.setAttribute('src',art[0]);
        if (source.getAttribute('srcset')!==art[1]) source.setAttribute('srcset',art[1]);
    }
    function visibility() { root.dataset.worldHidden = String(!!document.hidden); }
    global.NamelessWorldAtmosphere = {sync:sync};
    sync();
    visibility();
    document.addEventListener('visibilitychange', visibility);
})(window);
