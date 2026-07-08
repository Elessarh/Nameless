/* ============================================================
   NAMELESS - Ambiance sonore optionnelle
   - Aucun autoplay: la lecture attend toujours une action utilisateur.
   - Bouton ON/OFF, piste suivante, nom court de piste.
   - Preferences non sensibles en localStorage.
   ============================================================ */
(function () {
    'use strict';

    if (window.NamelessAudioPlayer && (window.NamelessAudioPlayer.initialized || window.NamelessAudioPlayer.booting)) return;

    var singleton = window.NamelessAudioPlayer || {};
    window.NamelessAudioPlayer = singleton;
    singleton.booting = true;

    var DEFAULT_VOLUME = 0.2;
    var LEGACY_STORE_KEY = 'nm-audio';
    var STORAGE = {
        enabled: 'namelessAudioEnabled',
        track: 'namelessAudioTrack',
        volume: 'namelessAudioVolume',
        time: 'namelessAudioTime'
    };

    function assetUrl(path) {
        var script = document.currentScript || document.querySelector('script[src*="audio-controller.js"]');
        if (script && script.src) return new URL('../' + path, script.src).href;
        var base = location.pathname.indexOf('/pages/') !== -1 ? '../' : '';
        return base + path;
    }

    var TRACKS = [
        { id: 'oath', label: 'Oath', src: assetUrl('assets/audio/nameless-oath.mp3') },
        { id: 'echoes-1', label: 'Echos I', src: assetUrl('assets/audio/nameless-echoes.mp3') },
        { id: 'echoes-2', label: 'Echos II', src: assetUrl('assets/audio/nameless-echoes-2.mp3') }
    ];

    function clampNumber(value, min, max, fallback) {
        var n = Number(value);
        if (!isFinite(n)) return fallback;
        return Math.min(max, Math.max(min, n));
    }

    function trackIndexById(id) {
        for (var i = 0; i < TRACKS.length; i++) {
            if (TRACKS[i].id === id) return i;
        }
        return 0;
    }

    function normalizeTrack(value) {
        if (typeof value === 'number') return TRACKS[Math.max(0, Math.min(TRACKS.length - 1, Math.floor(value)))].id;
        if (typeof value === 'string') {
            for (var i = 0; i < TRACKS.length; i++) {
                if (TRACKS[i].id === value) return value;
            }
        }
        return TRACKS[0].id;
    }

    function readLegacyPref() {
        try {
            var raw = localStorage.getItem(LEGACY_STORE_KEY);
            if (!raw) return null;
            var old = JSON.parse(raw);
            if (!old || typeof old !== 'object') return null;
            return {
                enabled: old.on === 'on',
                trackId: normalizeTrack(old.track),
                volume: clampNumber(old.volume, 0, 1, DEFAULT_VOLUME),
                pos: clampNumber(old.pos, 0, Number.MAX_SAFE_INTEGER, 0)
            };
        } catch (e) {
            return null;
        }
    }

    function readPref() {
        var fallback = readLegacyPref() || {
            enabled: false,
            trackId: TRACKS[0].id,
            volume: DEFAULT_VOLUME,
            pos: 0
        };

        try {
            var enabledRaw = localStorage.getItem(STORAGE.enabled);
            var trackRaw = localStorage.getItem(STORAGE.track);
            var volumeRaw = localStorage.getItem(STORAGE.volume);
            var timeRaw = localStorage.getItem(STORAGE.time);

            return {
                enabled: enabledRaw === null ? fallback.enabled : enabledRaw === 'on',
                trackId: trackRaw === null ? fallback.trackId : normalizeTrack(trackRaw),
                volume: volumeRaw === null ? fallback.volume : clampNumber(volumeRaw, 0, 1, DEFAULT_VOLUME),
                pos: timeRaw === null ? fallback.pos : clampNumber(timeRaw, 0, Number.MAX_SAFE_INTEGER, 0)
            };
        } catch (e) {
            return fallback;
        }
    }

    function writePref(patch) {
        try {
            var cur = readPref();
            if (Object.prototype.hasOwnProperty.call(patch, 'enabled')) cur.enabled = !!patch.enabled;
            if (Object.prototype.hasOwnProperty.call(patch, 'trackId')) cur.trackId = normalizeTrack(patch.trackId);
            if (Object.prototype.hasOwnProperty.call(patch, 'volume')) cur.volume = clampNumber(patch.volume, 0, 1, DEFAULT_VOLUME);
            if (Object.prototype.hasOwnProperty.call(patch, 'pos')) cur.pos = clampNumber(patch.pos, 0, Number.MAX_SAFE_INTEGER, 0);

            localStorage.setItem(STORAGE.enabled, cur.enabled ? 'on' : 'off');
            localStorage.setItem(STORAGE.track, cur.trackId);
            localStorage.setItem(STORAGE.volume, String(cur.volume));
            localStorage.setItem(STORAGE.time, String(Math.max(0, Math.floor(cur.pos))));
        } catch (e) {}
    }

    function svgSkip() {
        var ns = 'http://www.w3.org/2000/svg';
        var s = document.createElementNS(ns, 'svg');
        s.setAttribute('viewBox', '0 0 24 24');
        s.setAttribute('aria-hidden', 'true');
        s.setAttribute('width', '15');
        s.setAttribute('height', '15');

        var p = document.createElementNS(ns, 'path');
        p.setAttribute('d', 'M7 5l8.5 7L7 19V5z');
        p.setAttribute('fill', 'currentColor');

        var r = document.createElementNS(ns, 'rect');
        r.setAttribute('x', '16.4');
        r.setAttribute('y', '5');
        r.setAttribute('width', '2.3');
        r.setAttribute('height', '14');
        r.setAttribute('rx', '0.6');
        r.setAttribute('fill', 'currentColor');

        s.appendChild(p);
        s.appendChild(r);
        return s;
    }

    function bootAudioPlayer() {
        if (!TRACKS.length) {
            singleton.booting = false;
            return;
        }
        if (document.querySelector('.nm-audio-dock')) {
            singleton.initialized = true;
            singleton.booting = false;
            return;
        }
        singleton.initialized = true;
        singleton.booting = false;

        var pref = readPref();
        var failed = {};
        var current = trackIndexById(pref.trackId);
        var wantedPlaying = false;
        var resumeArmed = false;

        var audio = new Audio();
        audio.loop = true;
        audio.preload = 'none';
        audio.volume = pref.volume;
        singleton.audio = audio;

        var dock = document.createElement('div');
        dock.className = 'nm-audio-dock';
        singleton.dock = dock;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nm-audio-btn';
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('aria-label', "Activer l'ambiance sonore");

        var eq = document.createElement('span');
        eq.className = 'nm-audio-eq';
        eq.setAttribute('aria-hidden', 'true');
        for (var i = 0; i < 3; i++) eq.appendChild(document.createElement('i'));

        var label = document.createElement('span');
        label.className = 'nm-audio-label';

        var nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'nm-audio-next';
        nextBtn.appendChild(svgSkip());

        btn.appendChild(eq);
        btn.appendChild(label);
        dock.appendChild(btn);
        if (TRACKS.length > 1) dock.appendChild(nextBtn);
        document.body.appendChild(dock);

        function nextValidFrom(from) {
            var n = TRACKS.length;
            var tried = 0;
            var ni = from;
            do {
                ni = (ni + 1) % n;
                tried++;
            } while (failed[ni] && tried < n);
            return failed[ni] ? -1 : ni;
        }

        function updateTrackLabel() {
            if (btn.classList.contains('needs-resume')) {
                label.textContent = 'Reprendre';
                return;
            }
            label.textContent = TRACKS[current].label;
            var next = nextValidFrom(current);
            var nextLabel = next === -1 ? 'aucune piste disponible' : TRACKS[next].label;
            nextBtn.setAttribute('aria-label', 'Piste suivante : ' + nextLabel);
            nextBtn.title = 'Piste suivante : ' + nextLabel;
        }

        function setOn(on) {
            if (on) btn.classList.remove('needs-resume');
            btn.classList.toggle('is-on', on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
            btn.setAttribute('aria-label', on ? "Couper l'ambiance sonore" : "Activer l'ambiance sonore");
        }

        function markNeedsResume() {
            btn.classList.add('needs-resume');
            btn.classList.remove('is-on');
            btn.setAttribute('aria-pressed', 'false');
            btn.setAttribute('aria-label', "Reprendre l'ambiance sonore");
            label.textContent = 'Reprendre';
        }

        function armResume() {
            if (resumeArmed) return;
            resumeArmed = true;
            var resume = function () {
                resumeArmed = false;
                document.removeEventListener('pointerdown', resume);
                document.removeEventListener('keydown', resume);
                if (readPref().enabled) playCurrent();
            };
            document.addEventListener('pointerdown', resume, { once: true });
            document.addEventListener('keydown', resume, { once: true });
        }

        function loadTrack(index, restorePos) {
            current = Math.max(0, Math.min(TRACKS.length - 1, Math.floor(index)));
            audio.src = TRACKS[current].src;
            updateTrackLabel();

            if (restorePos && pref.pos > 0 && TRACKS[current].id === pref.trackId) {
                var onMeta = function () {
                    try {
                        audio.currentTime = Math.min(pref.pos, audio.duration || pref.pos);
                    } catch (e) {}
                    audio.removeEventListener('loadedmetadata', onMeta);
                };
                audio.addEventListener('loadedmetadata', onMeta);
            }
        }

        function playCurrent() {
            wantedPlaying = true;
            var playPromise = audio.play();

            if (playPromise && typeof playPromise.then === 'function') {
                playPromise.then(function () {
                    setOn(true);
                    updateTrackLabel();
                    writePref({ enabled: true, trackId: TRACKS[current].id });
                }).catch(function () {
                    if (!wantedPlaying) return;
                    markNeedsResume();
                    writePref({ enabled: true, trackId: TRACKS[current].id, pos: audio.currentTime || 0 });
                    armResume();
                });
            }
        }

        audio.addEventListener('error', function () {
            failed[current] = true;
            var ni = nextValidFrom(current);
            if (ni === -1) {
                if (dock.parentNode) dock.remove();
                singleton.initialized = false;
                return;
            }
            loadTrack(ni, false);
            writePref({ trackId: TRACKS[current].id, pos: 0 });
            if (wantedPlaying || btn.classList.contains('is-on')) playCurrent();
        });

        audio.addEventListener('volumechange', function () {
            writePref({ volume: audio.volume });
        });

        loadTrack(current, true);
        writePref({
            enabled: pref.enabled,
            trackId: TRACKS[current].id,
            volume: audio.volume,
            pos: pref.pos
        });

        btn.addEventListener('click', function () {
            if (audio.paused) {
                setOn(true);
                writePref({ enabled: true, trackId: TRACKS[current].id });
                playCurrent();
            } else {
                wantedPlaying = false;
                audio.pause();
                setOn(false);
                btn.classList.remove('needs-resume');
                updateTrackLabel();
                writePref({ enabled: false, trackId: TRACKS[current].id, pos: audio.currentTime || 0 });
            }
        });

        nextBtn.addEventListener('click', function () {
            var ni = nextValidFrom(current);
            if (ni === -1) return;

            var wasPlaying = wantedPlaying || !audio.paused;
            loadTrack(ni, false);
            writePref({ trackId: TRACKS[current].id, pos: 0 });

            if (wasPlaying) {
                setOn(true);
                playCurrent();
            }
        });

        var lastSave = 0;
        audio.addEventListener('timeupdate', function () {
            var now = Date.now();
            if (!audio.paused && now - lastSave > 4000) {
                lastSave = now;
                writePref({ trackId: TRACKS[current].id, pos: audio.currentTime || 0 });
            }
        });

        window.addEventListener('beforeunload', function () {
            if (!audio.paused) writePref({ trackId: TRACKS[current].id, pos: audio.currentTime || 0 });
        });

        window.addEventListener('pagehide', function () {
            if (!audio.paused) writePref({ trackId: TRACKS[current].id, pos: audio.currentTime || 0 });
        });

        document.addEventListener('visibilitychange', function () {
            if (document.hidden && !audio.paused) {
                writePref({ trackId: TRACKS[current].id, pos: audio.currentTime || 0 });
            }
        });

        if (pref.enabled) {
            setOn(true);
            armResume();
        }

        updateTrackLabel();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootAudioPlayer, { once: true });
    } else {
        bootAudioPlayer();
    }
})();
