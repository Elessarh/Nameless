# Legacy — surfaces retirées du site actif

Archivé le 2026-07-09 pendant la passe sécurité (voir
`docs/security/PENTEST_REPORT_2026_07_NAMELESS.md`).

Contenu :

- `pages/hdv.html` + `js/` + `css/` : ancien Hôtel des Ventes / messagerie
  (hdv.js, hdv-supabase.js, mailbox.js, mailbox-supabase.js,
  item-selector.js). Hors navigation et hors router SPA depuis la refonte,
  mais encore servi publiquement à `/pages/hdv.html` avant cet archivage —
  vieux code avec handlers inline, retiré de la surface d'attaque.
- `brand-preview.html` : page de prévisualisation du branding, sans CSP,
  jamais référencée par le site.

Les chemins relatifs (`../js/…`) sont volontairement cassés par le
déplacement : ces pages sont inertes même si l'URL `/legacy/...` est servie.

Aucune référence active ne pointe vers ces fichiers (vérifié par grep sur
HTML/JS/CSS/router). Suppression définitive possible quand le HDV ne
reviendra pas ; les tables `market_orders`/`purchase_history` restent en base
avec leur RLS.
