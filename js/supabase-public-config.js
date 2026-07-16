/*
 * Public browser configuration for Supabase.
 *
 * The publishable key is intentionally visible in the browser. It identifies
 * this frontend but grants no server privileges; authorization must remain in
 * Supabase RLS policies and protected RPC/Edge Functions. Never add a
 * service_role key or another server secret to this file.
 */
(function (global) {
    'use strict';

    global.NamelessPublicConfig = Object.freeze({
        supabaseUrl: 'https://iwrvdntlrjnoqzbwbsfm.supabase.co',
        supabasePublishableKey: 'sb_publishable_o4Z1WCiTWycUcmR0g3pg4w_m9Vixz5S'
    });
}(window));
