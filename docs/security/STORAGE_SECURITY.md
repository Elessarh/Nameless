# Sécurité Storage — 7 octobre 2026

Le bucket existant `iron-oath-storage` reste **privé**. La migration [004](../supabase/SAO_NAMELESS_HARDENING_004.sql) et sa [procédure](../supabase/HARDENING_004_DEPLOYMENT.md) sont la référence actuelle.

Les nouveaux uploads utilisent `chat/<auth.uid()>/<uuid>.<extension>` ou `guild-activities/<auth.uid()>/<uuid>.<extension>`, avec PNG/JPEG/WebP et une limite serveur de 5 Mo. SVG, HTML, chemins étrangers et remplacement d'un fichier existant sont refusés. Les uploads de guilde nécessitent les droits correspondants ; les publications d'activité restent réservées aux admins. La déclaration MIME n'est pas une analyse antivirus ni une inspection complète des octets, mais les formats exécutables sont exclus et les fichiers sont affichés comme images.

Les chemins sont stockés en base. `NamelessSecurity.resolveMediaUrl` demande une signature de dix minutes pour le compte actuel ; le cache de signatures est en mémoire, dure neuf minutes, et est invalidé au changement de compte ou à la déconnexion. Les réponses anciennes contenant une URL signée sont interprétées comme chemins pour obtenir une nouvelle signature courte. Le jeton ancien n'est pas réutilisé par le frontend.

Les policies autorisent les images des messages de guilde visibles et celles des DM aux participants autorisés. Un troisième membre ne peut pas signer l'objet d'un DM. L'auteur ne peut ni remplacer les participants ou la visibilité d'un message existant, ni référencer le fichier d'un autre auteur. Les fichiers orphelins restent lisibles par leur propriétaire autorisé. La révocation du rôle bloque les nouvelles lectures/signatures ; une signature déjà émise demeure utilisable jusqu'à son expiration.

Les anciens jetons de cinq ans ne sont **pas révoqués rétroactivement**. La rotation de fichiers et de leurs références, si nécessaire, doit être sauvegardée et préparée séparément : cette intervention ne supprime aucun fichier utilisateur.

Le serveur limite les uploads à 10 par minute et 60 par heure via un compteur privé persistant. Supprimer un fichier ne remet pas le budget à zéro. La limite est appliquée à la base et ne dépend pas du JavaScript du navigateur.

Les tests isolés couvrent les chemins, MIME, taille, signature courte, déconnexion, RLS des participants, référence forgée, budgets et révocation de rôle. La recette doit encore vérifier le comportement du vrai service Storage et des JWT du projet après migration, avec deux participants et un troisième compte.

La suppression d'un compte peut être refusée par Supabase tant qu'il possède des fichiers. L'Edge renvoie alors 409 et préserve les données. Ne pas purger les fichiers avant une suppression Auth acceptée ; résoudre la propriété et conserver une sauvegarde dans l'administration Supabase.
