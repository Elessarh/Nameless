/* Supabase client compatibility hook.
 * Database authority and rate limits live in RLS / SQL / Edge Functions.
 * Keep fluent SDK queries intact; reads must never trip a write throttle.
 */
(function () {
    'use strict';
    window._initDbGuard = function (client) {
        Object.defineProperty(window, '_dbRef', {
            value: client, writable: false, enumerable: false, configurable: true
        });
        return client;
    };
})();
