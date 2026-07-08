/* items-catalog.js - Catalogue des items identique à celui de l'HDV */

const itemsCatalog = {
    'accessoires': {
        name: '💍 Accessoires',
        items: [
            { id: 'anneau_faucheuse', name: 'Anneau de la Faucheuse', image: 'Accessoires/AnneaudelaFaucheuse.png', rarity: 'legendary' },
            { id: 'anneau_leviathan', name: 'Anneau de Léviathan', image: 'Accessoires/AnneaudeLéviathan.png', rarity: 'epic' },
            { id: 'anneau_pacte', name: 'Anneau de Pacte', image: 'Accessoires/Anneaudepacte.png', rarity: 'rare' },
            { id: 'collier_aragorn', name: 'Collier de Aragorn', image: 'Accessoires/CollierdeAragorn.png', rarity: 'epic' }
        ]
    },
    'armes': {
        name: '⚔️ Armes',
        items: [
            { id: 'baton_sorcier_shaman', name: 'Bâton du Sorcier du Shaman', image: 'Armes/BatonduSorcierduShaman.png', rarity: 'epic' }
        ]
    },
    'consommables': {
        name: '🧪 Consommables',
        items: [
            { id: 'cle_foret', name: 'Clé de la Forêt', image: 'Consommables/Clédelaforêt.png', rarity: 'common' },
            { id: 'cle_dechus', name: 'Clé des Déchus', image: 'Consommables/ClédesDechus.png', rarity: 'uncommon' },
            { id: 'cle_xal_zirith', name: 'Clé de Xal\'Zirith', image: 'Consommables/ClédeXalZirith.png', rarity: 'rare' },
            { id: 'cle_halloween', name: 'Clé Halloween', image: 'Consommables/CléHalloween.png', rarity: 'epic' },
            { id: 'cle_overall', name: 'Clé Overall', image: 'Consommables/CléOverall.png', rarity: 'legendary' },
            { id: 'cristal_potion', name: 'Cristal de Potion', image: 'Consommables/CristaldePotion.png', rarity: 'rare' },
            { id: 'cristal_halloween', name: 'Cristal d\'Halloween', image: 'Consommables/CristalDHalloween.png', rarity: 'epic' },
            { id: 'cristal_soutien', name: 'Cristal du Soutien I', image: 'Consommables/CristalduSoutienI.png', rarity: 'uncommon' },
            { id: 'parchemin_maitrise', name: 'Parchemin de Maîtrise', image: 'Consommables/ParchemindeMaîtrise.png', rarity: 'rare' },
            { id: 'parchemin_reallocation', name: 'Parchemin de Réallocation', image: 'Consommables/ParchemindeRéallocation.png', rarity: 'uncommon' },
            { id: 'potion_mana', name: 'Potion de Mana', image: 'Consommables/PotiondeMana.png', rarity: 'common' },
            { id: 'potion_mana_moyenne', name: 'Potion de Mana Moyenne', image: 'Consommables/Potion%20de%20Mana%20Moyenne.png', rarity: 'uncommon' },
            { id: 'potion_mana_superieur', name: 'Potion de Mana Supérieur', image: 'Consommables/Potion%20de%20Mana%20Supérieur.png', rarity: 'rare' },
            { id: 'potion_albal', name: 'Potion d\'Albal', image: 'Consommables/PotiondAlbal.png', rarity: 'rare' },
            { id: 'potion_vie_i', name: 'Potion de Vie I', image: 'Consommables/PotiondeVieI.png', rarity: 'common' },
            { id: 'potion_vie_ii', name: 'Potion de Vie II', image: 'Consommables/PotiondeVieII.png', rarity: 'uncommon' },
            { id: 'potion_vie_iii', name: 'Potion de Vie III', image: 'Consommables/PotiondeVieIII.png', rarity: 'rare' },
            { id: 'potion_martyr', name: 'Potion du Martyr', image: 'Consommables/PotionduMartyr.png', rarity: 'epic' },
            { id: 'sandwich_nephantes', name: 'Sandwich de Nephantes', image: 'Consommables/SandwichdeNephantes.png', rarity: 'uncommon' },
            { id: 'viande_sanglier', name: 'Viande de Sanglier', image: 'Consommables/ViandedeSanglier.png', rarity: 'common' }
        ]
    },
    'ressources': {
        name: '🔧 Ressources',
        items: [
            { id: 'aile_tenebreuse', name: 'Aile Ténébreuse', image: 'Ressources/AileTénébreuse.png', rarity: 'epic' },
            { id: 'bonbon_sucre', name: 'Bonbon Sucrée au Sucre', image: 'Ressources/BonbonSucréeauSucre.png', rarity: 'common' },
            { id: 'brindille_enchantees', name: 'Brindille Enchantées', image: 'Ressources/BrindilleEnchantées.png', rarity: 'rare' },
            { id: 'buche_bouleau', name: 'Bûche de Bouleau', image: 'Ressources/BuchedeBouleau.png', rarity: 'common' },
            { id: 'buche_chene', name: 'Bûche de Chêne', image: 'Ressources/BuchedeChêne.png', rarity: 'common' },
            { id: 'carapace_ika', name: 'Carapace d\'Ika', image: 'Ressources/CarapacedIka.png', rarity: 'rare' },
            { id: 'carapace_requin', name: 'Carapace de Requin', image: 'Ressources/CarapcedeRequin.png', rarity: 'rare' },
            { id: 'cendre_sarcophage', name: 'Cendre de Sarcophage', image: 'Ressources/CendredeSarcophage.png', rarity: 'epic' },
            { id: 'coeur_arcanique', name: 'Coeur Arcanique', image: 'Ressources/CoeurArcanique.png', rarity: 'legendary' },
            { id: 'coeur_bois', name: 'Coeur de Bois', image: 'Ressources/CoeurdeBois.png', rarity: 'uncommon' },
            { id: 'coeur_flammes', name: 'Coeur de Flammes', image: 'Ressources/CoeurdeFlammes.png', rarity: 'rare' },
            { id: 'coeur_nautherion', name: 'Coeur de Nautherion', image: 'Ressources/CoeurdeNautherion.png', rarity: 'epic' },
            { id: 'coeur_necrotique', name: 'Coeur Nécrotique', image: 'Ressources/CoeurNécrotique.png', rarity: 'epic' },
            { id: 'coeur_putrifie', name: 'Coeur Putrifié', image: 'Ressources/CoeurPutrifié.png', rarity: 'rare' },
            { id: 'corde_arc_sylvestre', name: 'Corde d\'arc Sylvestre', image: 'Ressources/CordedarcSylvestre.png', rarity: 'uncommon' },
            { id: 'corne_ebrechee', name: 'Corne Ébrechée', image: 'Ressources/CorneEbrechée.png', rarity: 'common' },
            { id: 'criniere', name: 'Crinière', image: 'Ressources/Crinière.png', rarity: 'uncommon' },
            { id: 'cristal_corrompu', name: 'Cristal Corrompu', image: 'Ressources/CristalCorrompu.png', rarity: 'epic' },
            { id: 'crocs_loup', name: 'Crocs de Loup', image: 'Ressources/CrocsdeLoup.png', rarity: 'common' },
            { id: 'debris_chair', name: 'Débris Putride de Chair', image: 'Ressources/DébrisPutridedeChair.png', rarity: 'rare' },
            { id: 'eclat_bois_magique', name: 'Éclat de Bois Magique', image: 'Ressources/EclatdeBoisMagique.png', rarity: 'rare' },
            { id: 'ecorce_titan', name: 'Écorce de Titan', image: 'Ressources/EcorcedeTitan.png', rarity: 'epic' },
            { id: 'ecorce_sylvestre', name: 'Écorce Sylvestre', image: 'Ressources/EcorceSylvestre.png', rarity: 'uncommon' },
            { id: 'essence_gorbel', name: 'Essence de Gorbel', image: 'Ressources/EssencedeGorbel.png', rarity: 'rare' },
            { id: 'essence_miasme', name: 'Essence de Miasme', image: 'Ressources/EssencedeMiasme.png', rarity: 'epic' },
            { id: 'fil_araignee', name: 'Fil d\'Araignée', image: 'Ressources/FildAraignée.png', rarity: 'common' },
            { id: 'fil_araignee_renforce', name: 'Fil d\'Araignée Renforcé', image: 'Ressources/FildAraignéeRenforcé.png', rarity: 'uncommon' },
            { id: 'fourrure_loup', name: 'Fourrure de Loup', image: 'Ressources/FourruredeLoup.png', rarity: 'common' },
            { id: 'fourrure_vide', name: 'Fourrure du Vide', image: 'Ressources/FourrureduVide.png', rarity: 'epic' },
            { id: 'fragment_jaune', name: 'Fragment Cassé Jaune', image: 'Ressources/FragmentCasséJaune.png', rarity: 'uncommon' },
            { id: 'fragment_rouge', name: 'Fragment Cassé Rouge', image: 'Ressources/FragmentCasséRouge.png', rarity: 'uncommon' },
            { id: 'fragment_violet', name: 'Fragments Cassé Violet', image: 'Ressources/FragmentsCasséViolet.png', rarity: 'rare' },
            { id: 'fragment_citrouille', name: 'Fragment de Citrouille', image: 'Ressources/FragmentdeCitrouille.png', rarity: 'epic' },
            { id: 'fragment_ame_ours', name: 'Fragment de l\'Âme de l\'Ours', image: 'Ressources/FragmentdelÂmedelOurs.png', rarity: 'legendary' },
            { id: 'fragments_feuilles', name: 'Fragments de Feuilles', image: 'Ressources/FragmentsdeFeuilles.png', rarity: 'common' },
            { id: 'gelee_slime', name: 'Gelée de Slime', image: 'Ressources/GeléedeSlime.png', rarity: 'common' },
            { id: 'griffe_nocturne', name: 'Griffe Nocturne', image: 'Ressources/GriffeNocturne.png', rarity: 'epic' },
            { id: 'lingot_cramoisi', name: 'Lingot Cramoisi', image: 'Ressources/Lingot%20cramoisi.png', rarity: 'epic' },
            { id: 'lingot_cuivre', name: 'Lingot de Cuivre', image: 'Ressources/LingotdeCuivre.png', rarity: 'common' },
            { id: 'lingot_fer', name: 'Lingot de Fer', image: 'Ressources/LingotdeFer.png', rarity: 'common' },
            { id: 'lingot_metal_enchante', name: 'Lingot de métal enchanté', image: 'Ressources/Lingotdemétalenchanté.png', rarity: 'rare' },
            { id: 'lingot_ame_metal', name: 'Lingot d\'Âme de Métal', image: 'Ressources/LingotdÂmedeMétal.png', rarity: 'legendary' },
            { id: 'minerai_cramoisi', name: 'Minerai Cramoisi', image: 'Ressources/Mineraicramoisi.png', rarity: 'rare' },
            { id: 'minerai_charbon', name: 'Minerai de Charbon', image: 'Ressources/MineraideCharbon.png', rarity: 'common' },
            { id: 'minerai_cuivre', name: 'Minerai de Cuivre', image: 'Ressources/MineraideCuivre.png', rarity: 'common' },
            { id: 'minerai_fer', name: 'Minerai de Fer', image: 'Ressources/MineraideFer.png', rarity: 'common' },
            { id: 'mycelium_magique', name: 'Mycélium Magique', image: 'Ressources/MycéliumMagique.png', rarity: 'rare' },
            { id: 'noyau_slime', name: 'Noyau de Slime', image: 'Ressources/NoyaudeSlime.png', rarity: 'uncommon' },
            { id: 'os_squelette', name: 'Os de Squelette', image: 'Ressources/OsdeSquelette.png', rarity: 'common' },
            { id: 'os_squelette_renforce', name: 'Os de Squelette Renforcé', image: 'Ressources/OsdeSqueletteRenforcé.png', rarity: 'uncommon' },
            { id: 'peau_sanglier', name: 'Peau de Sanglier', image: 'Ressources/Peau%20de%20Sanglier.png', rarity: 'common' },
            { id: 'peau_glacial', name: 'Peau d\'ur Glacial', image: 'Ressources/PeaudurGlacial.png', rarity: 'rare' },
            { id: 'petite_bourse', name: 'Petite Bourse', image: 'Ressources/PetiteBourse.png', rarity: 'common' },
            { id: 'piece_metal_enchante', name: 'Pièce de métal enchanté', image: 'Ressources/Piècedemétalenchanté.png', rarity: 'uncommon' },
            { id: 'piece_ame_metal', name: 'Pièce d\'Âme de Métal', image: 'Ressources/PiècedÂmedeMétal.png', rarity: 'epic' },
            { id: 'pousse_sylve', name: 'Pousse de Sylve', image: 'Ressources/PoussedeSylve.png', rarity: 'uncommon' },
            { id: 'poussiere_echo', name: 'Poussière d\'Echo Spectrale', image: 'Ressources/PoussièredEchoSpectrale.png', rarity: 'epic' },
            { id: 'poussiere_givre', name: 'Poussière de Givre', image: 'Ressources/PoussièredeGivre.png', rarity: 'uncommon' },
            { id: 'poussiere_os', name: 'Poussière d\'Os', image: 'Ressources/PoussièredOs.png', rarity: 'common' },
            { id: 'racine_ancestrale', name: 'Racine Ancestrale', image: 'Ressources/RacineAncestrale.png', rarity: 'rare' },
            { id: 'spore_corrompu', name: 'Spore Corrompu', image: 'Ressources/SporeCorrompu.png', rarity: 'uncommon' },
            { id: 'tissu_araignee', name: 'Tissu d\'Araignée', image: 'Ressources/TissudAraignée.png', rarity: 'uncommon' },
            { id: 'tissu_maudit', name: 'Tissu Maudit', image: 'Ressources/TissuMaudit.png', rarity: 'epic' },
            { id: 'tissu_spectral', name: 'Tissu Spectral', image: 'Ressources/TissuSpectral.png', rarity: 'rare' },
            { id: 'venin_araignee', name: 'Venin d\'Araignée', image: 'Ressources/VenindAraignée.png', rarity: 'uncommon' },
            { id: 'voile_banshee', name: 'Voile de la Banshee', image: 'Ressources/VoiledelaBanshee.png', rarity: 'epic' },
            { id: 'ame_herald', name: 'Âme de l\'Herald', image: 'Ressources/ÂmedelHerald.png', rarity: 'legendary' },
            { id: 'ame_ruines', name: 'Âme des ruines', image: 'Ressources/Âmedesruines.png', rarity: 'legendary' },
            { id: 'ame_reaper', name: 'Âme du Reaper', image: 'Ressources/ÂmeduReaper.png', rarity: 'legendary' },
            { id: 'ame_warden', name: 'Âme du Warden', image: 'Ressources/ÂmeduWarden.png', rarity: 'legendary' }
        ]
    },
    'outils': {
        name: '🔧 Outils',
        items: [
            { id: 'canne_peche', name: 'Canne à Pêche', image: 'Outils/Canneàpêche.png', rarity: 'common' },
            { id: 'hache_ebrechee', name: 'Hache Ébréchée', image: 'Outils/Hacheébréchée.png', rarity: 'common' },
            { id: 'pinceau_magique', name: 'Pinceau Magique', image: 'Outils/PinceauMagique.png', rarity: 'rare' },
            { id: 'pioche_felee', name: 'Pioche Fêlée', image: 'Outils/PiocheFêlée.png', rarity: 'common' },
            { id: 'serpe_tordue', name: 'Serpe Tordue', image: 'Outils/SerpeTordue.png', rarity: 'uncommon' }
        ]
    },
    'familiers': {
        name: '🐾 Familiers',
        items: [
            { id: 'krynn_fleau', name: 'Krynn Le Fléau Multicolore', image: 'Familiers/KrynnLeFléauMuticolore.png', rarity: 'legendary' },
            { id: 'pet_frankenstein', name: 'Pet Frankenstein', image: 'Familiers/PetFrankenstein.png', rarity: 'epic' }
        ]
    },
    'montures': {
        name: '🐴 Montures',
        items: [
            { id: 'balais_volant', name: 'Monture Balais Volant', image: 'Montures/MontureBalaisVolant.png', rarity: 'epic' }
        ]
    },
    'runes': {
        name: '🔮 Runes',
        items: [
            { id: 'rune_halloween', name: 'Rune d\'Halloween', image: 'Runes/RunedHalloween.png', rarity: 'epic' }
        ]
    }
};