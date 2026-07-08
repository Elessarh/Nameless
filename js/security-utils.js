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
        if (hostname === 'supabase.co' || hostname.endsWith('.supabase.co')) return true;
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

    var api = {
        escapeHtml: escapeHtml,
        escapeAttr: escapeAttr,
        sanitizeUrl: sanitizeUrl,
        sanitizeImageUrl: sanitizeImageUrl,
        isAllowedImageHost: isAllowedImageHost
    };

    global.NamelessSecurity = api;

    /* Convenience globals — only set if not already defined, so we
       never clobber a page-specific implementation by accident. */
    if (typeof global.sanitizeImageUrl !== 'function') global.sanitizeImageUrl = sanitizeImageUrl;

})(typeof window !== 'undefined' ? window : this);
