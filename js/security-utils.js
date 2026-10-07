/* ============================================================
   NAMELESS — Security utilities (Phase 1)
   Dependency-free escaping + URL sanitization.
   Loaded on every page BEFORE the feature scripts so that
   window.NamelessSecurity is available everywhere.

   IMPORTANT
   ---------
   escapeHtml() is safe for text nodes AND for values placed
   inside single/double quoted HTML attributes (it escapes
   quotes and backticks, unlike the old textContent-based
   helpers). It is NEVER sufficient for JavaScript / event
   handler / URL attribute contexts (onclick="...", href="...").
   For those, remove the inline handler and use addEventListener,
   or run the value through sanitizeUrl() first.
   ============================================================ */
(function (global) {
    'use strict';

    var HTML_ENTITIES = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '`': '&#96;'
    };

    /**
     * Escape a value for safe insertion into HTML text or into a
     * single/double quoted attribute value.
     * Handles null/undefined and non-string input.
     */
    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value).replace(/[&<>"'`]/g, function (ch) {
            return HTML_ENTITIES[ch];
        });
    }

    /** Explicit alias for attribute contexts (same rules). */
    function escapeAttr(value) {
        return escapeHtml(value);
    }

    /* Hosts allowed for user-supplied images. Supabase storage is
       matched by suffix so any project subdomain is accepted. */
    var ALLOWED_IMG_HOSTS = [
        'mc-heads.net'
    ];

    function isAllowedImageHost(hostname) {
        if (!hostname) return false;
        hostname = hostname.toLowerCase();
        try {
            var projectUrl = (global.NamelessPublicConfig || {}).supabaseUrl;
            if (projectUrl && hostname === new URL(projectUrl).hostname.toLowerCase()) return true;
        } catch (error) {}
        for (var i = 0; i < ALLOWED_IMG_HOSTS.length; i++) {
            if (hostname === ALLOWED_IMG_HOSTS[i]) return true;
        }
        return false;
    }

    /**
     * Return a safe absolute https URL, or '' if the input is rejected.
     * Rejects javascript:, data:, blob:, vbscript:, file: and any
     * non-https scheme. With { requireAllowedHost: true } it also
     * enforces the image host whitelist.
     */
    function sanitizeUrl(rawUrl, opts) {
        opts = opts || {};
        if (!rawUrl) return '';
        var url = String(rawUrl).trim();
        if (/^[a-z0-9.+-]*\s*:/i.test(url) === false && url.indexOf('//') !== 0) {
            // relative URL with no scheme and not protocol-relative — reject
            // (user-supplied media should always be absolute https)
            if (!opts.allowRelative) return '';
        }
        if (/^\s*(javascript|data|blob|vbscript|file):/i.test(url)) return '';
        var parsed;
        try {
            parsed = new URL(url, global.location ? global.location.href : undefined);
        } catch (e) {
            return '';
        }
        if (parsed.protocol !== 'https:') return '';
        if (opts.requireAllowedHost && !isAllowedImageHost(parsed.hostname)) return '';
        return parsed.href;
    }

    /** Image-specific helper: https + host whitelist enforced. */
    function sanitizeImageUrl(rawUrl) {
        return sanitizeUrl(rawUrl, { requireAllowedHost: true });
    }

    var MEDIA_BUCKET = 'iron-oath-storage';
    var MEDIA_TTL = 10 * 60;
    var mediaCache = new Map();
    var mediaPending = new Map();
    var mediaGeneration = 0;
    var mediaPathPattern = /^(chat|guild-activities)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9._-]+\.(png|jpe?g|webp)$/i;

    // Existing database rows may contain public or long-lived signed URLs.
    // Extract their object path and request a fresh signature; never reuse tokens.
    function getStorageMediaPath(value) {
        if (typeof value !== 'string') return '';
        if (mediaPathPattern.test(value)) return value;
        var config = global.NamelessPublicConfig || {};
        if (!config.supabaseUrl) return '';
        try {
            var url = new URL(value);
            if (url.origin !== new URL(config.supabaseUrl).origin) return '';
            var prefix = /^\/storage\/v1\/object\/(?:sign|public|authenticated)\/iron-oath-storage\//;
            if (!prefix.test(url.pathname)) return '';
            var path = decodeURIComponent(url.pathname.replace(prefix, ''));
            return mediaPathPattern.test(path) ? path : '';
        } catch (error) {
            return '';
        }
    }

    function clearPrivateMediaCache() {
        mediaGeneration++;
        mediaCache.clear();
        mediaPending.clear();
    }

    async function resolveMediaUrl(value, options) {
        options = options || {};
        var path = getStorageMediaPath(value);
        if (!path) return sanitizeImageUrl(value);
        var client = options.client || global.supabase;
        var userId = global.currentUser && global.currentUser.id;
        if (!client || !client.storage || !userId) return '';
        var key = userId + ':' + path;
        var cached = mediaCache.get(key);
        if (cached && cached.expiresAt > Date.now()) return cached.url;
        if (mediaPending.has(key)) return mediaPending.get(key);
        var generation = mediaGeneration;
        var pending = (async function () {
            try {
                var result = await client.storage.from(MEDIA_BUCKET).createSignedUrl(path, MEDIA_TTL);
                if (result.error || !result.data || !result.data.signedUrl) return '';
                if (generation !== mediaGeneration || !global.currentUser || global.currentUser.id !== userId) return '';
                var safeUrl = sanitizeImageUrl(result.data.signedUrl);
                if (safeUrl) mediaCache.set(key, { url: safeUrl, expiresAt: Date.now() + (MEDIA_TTL - 60) * 1000 });
                return safeUrl;
            } catch (error) {
                return '';
            } finally {
                if (generation === mediaGeneration) mediaPending.delete(key);
            }
        })();
        mediaPending.set(key, pending);
        return pending;
    }

    async function uploadGuildMedia(file, options) {
        options = options || {};
        var client = options.client || global.supabase;
        var currentId = global.currentUser && global.currentUser.id;
        var userId = options.userId || currentId;
        var prefix = options.prefix || 'chat';
        var extension = String(file && file.name || '').split('.').pop().toLowerCase();
        var accepted = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
        if (!file || !accepted[extension] || file.type !== accepted[extension] || !file.size || file.size > 5 * 1024 * 1024) {
            throw new Error('Image invalide : PNG, JPEG ou WebP, 5 Mo maximum.');
        }
        if (!client || !userId || currentId !== userId || ['chat', 'guild-activities'].indexOf(prefix) === -1) {
            throw new Error('Session invalide pour cet envoi.');
        }
        var name = global.crypto.randomUUID() + '.' + extension;
        var path = prefix + '/' + userId + '/' + name;
        if (!mediaPathPattern.test(path)) throw new Error('Chemin de fichier invalide.');
        var result = await client.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: accepted[extension], upsert: false });
        if (result.error) throw new Error('Envoi refusé. Vérifiez vos droits et réessayez dans un instant.');
        return path;
    }

    var api = {
        escapeHtml: escapeHtml,
        escapeAttr: escapeAttr,
        sanitizeUrl: sanitizeUrl,
        sanitizeImageUrl: sanitizeImageUrl,
        isAllowedImageHost: isAllowedImageHost,
        getStorageMediaPath: getStorageMediaPath,
        resolveMediaUrl: resolveMediaUrl,
        uploadGuildMedia: uploadGuildMedia,
        clearPrivateMediaCache: clearPrivateMediaCache
    };

    global.NamelessSecurity = api;

    /* Convenience globals — only set if not already defined, so we
       never clobber a page-specific implementation by accident. */
    if (typeof global.sanitizeImageUrl !== 'function') global.sanitizeImageUrl = sanitizeImageUrl;

})(typeof window !== 'undefined' ? window : this);
