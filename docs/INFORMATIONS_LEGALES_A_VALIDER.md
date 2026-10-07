# Informations de site à valider avant publication

Deux documents locaux ont été ajoutés : `pages/confidentialite.html` et `pages/conditions.html`. Ils sont accessibles depuis le footer de chaque page et depuis la connexion. Ils affichent un statut de brouillon, sont `noindex` et restent exclus du sitemap. Aucun consentement contractuel ni case d'acceptation n'a été ajouté à la connexion.

## Ce qui est fondé sur le code

Connexion Microsoft via Supabase (identité et email), profil classe/niveau/rôle, pseudo/UUID Minecraft public via PlayerDB, avatars mc-heads, messages/images/chat/DM, planning, objectifs, publications et présences déclarées. Les préférences et la session du SDK sont conservées dans le navigateur. Aucun script applicatif de publicité ou analytics, aucun cookie applicatif ou service worker n'a été trouvé. Le lien Discord ne synchronise pas les comptes ou rôles.

Les administrateurs techniques disposent d'accès aux données hébergées ; les DM ne doivent pas être décrits comme chiffrés de bout en bout. Les durées de cache et de signature ne sont pas des durées de conservation. La suppression de compte est administrative et peut nécessiter un traitement séparé de Storage et des sauvegardes.

L'inventaire a repéré un helper DM oublié dans la première passe : il créait encore des signatures de cinq ans et masquait le helper du chat. Il a été remplacé par `uploadDmImage`, qui utilise les chemins validés communs. Un test charge ensemble chat et DM et vérifie les deux uploads. Les signatures longues émises auparavant ne sont pas révoquées par ce correctif.

## Informations humaines ou de compte fournisseur manquantes

1. Identité et coordonnées du responsable du site et des traitements. Aucun nom/adresse/email d'éditeur n'a été trouvé dans le projet ; le pseudo du poste de travail n'a pas été réutilisé. La question est envoyée au propriétaire.
2. Point de contact opérationnel pour accès, rectification et suppression. Le lien Discord existe, mais n'a pas été présenté comme un canal de droits confirmé.
3. Bases juridiques, statut de l'équipe, clauses définitives et modalités éventuelles concernant les mineurs. Ces éléments ne se déduisent pas d'un fichier JavaScript.
4. Durées effectives pour comptes, messages, pièces jointes, journaux et sauvegardes ; configuration Auth, tâches de purge et obligations éventuelles. Aucune rétention complète n'a été démontrée depuis le code.
5. Régions, transferts et garanties contractuelles Supabase/Microsoft/hébergement ; cookies ou analytics ajoutés à la périphérie Cloudflare. Le checkout ne prouve pas la configuration des comptes de production.

Ces points correspondent aux informations listées par la [CNIL sur la transparence](https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence). Le texte prépare la notice ; il ne remplace pas sa validation par l'équipe responsable. La [CNIL distingue aussi les traceurs soumis au consentement et les usages exemptés](https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/comment-mettre-mon-site-web-en-conformite) : aucun bandeau générique n'a été ajouté sans examen des usages réels.

## Domaine et publication

Canonical, OpenGraph et sitemap utilisent `https://nameless-sao.fr`. Les anciennes pages restent compatibles, les nouvelles routes sont générées avec HTTP 200 dans la recette. Favicon SVG, secours PNG 32 px, icône Apple et masque d'onglet épinglé utilisent le symbole Nameless existant.

Les requêtes de vérification automatique HTTPS du 7 octobre ont reçu 403 sur le domaine, `www`, robots et sitemap, empêchant de confirmer les redirections et en-têtes actuels avec ce moyen. Ne pas interpréter ce résultat comme une preuve de panne pour les joueurs. Confirmer HTTPS et `www`/non-`www` sur Cloudflare avant publication ; les changements locaux n'ont pas modifié ce compte.

Après validation humaine, compléter les deux documents et leurs traductions dans `js/i18n-information-en-reviewed.js`, retirer le statut de brouillon et décider de leur indexation. Pour les indexer, enlever `noindex` dans les sources et les retirer des exclusions spécifiques de `tools/build-site.mjs` et `tools/test-build-artifact.mjs`. La validation juridique ne se résume pas à ce changement de balise.
