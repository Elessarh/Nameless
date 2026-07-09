// Données du bestiaire - Catalogue complet avec toutes les images
const creaturesData = [
    // Palier 1 - Marécage putride
    {
        id: 1,
        name: "Gorbel",
        category: "boss",
        type: "Créature",
        hp: 1250,
        palier: 1,
        image: "../assets/mobs/Gorbel.png",
        description: "Un colosse gélatineux, maître des essaims de slimes. Il écrase tout sur son passage, lentement mais sûrement.",
        drops: [
            { name: "Gelée de Slime", rate: 30, image: "GeléedeSlime.png" },
            { name: "Noyau de Slime", rate: 5, image: "NoyaudeSlime.png" },
            { name: "Essence de Gorbel", rate: 1, image: "EssencedeGorbel.png" }
        ],
        location: "Marécage putride"
    },
    {
        id: 2,
        name: "Petit Slime",
        category: "creature",
        type: "Créature",
        hp: 80,
        palier: 1,
        image: "../assets/mobs/Petit Slime.png",
        description: "Malgré sa petite taille, il bondit sans peur. Inoffensif en apparence mais têtu comme pas deux. Certains disent qu'il garde un secret au coeur mou.",
        drops: [
            { name: "Gelée de Slime", rate: 30, image: "GeléedeSlime.png" }
        ],
        location: "Marécage putride"
    },
    {
        id: 3,
        name: "Slime Guerrier",
        category: "creature",
        type: "Créature",
        hp: 100,
        palier: 1,
        image: "../assets/mobs/Guerrier Slime.avif",
        description: "Né d'un amas magique de gelée ancienne, il a appris à manier l'arme comme un vrai geurrier. Il défend son territoire avec une rage inattendue.",
        drops: [
            { name: "Gelée de Slime", rate: 30, image: "GeléedeSlime.png" }
        ],
        location: "Marécage putride"
    },
    {
        id: 4,
        name: "Slime Soigneur",
        category: "creature",
        type: "Créature",
        hp: 150,
        palier: 1,
        image: "../assets/mobs/Slime Soigneur.png",
        description: "Ce slime irradie une énergie apaisante. Blessures mineures se referment à son passage. Il fuit le combat, mais sauve les siens dans l'ombre.",
        drops: [
            { name: "Gelée de Slime", rate: 30, image: "GeléedeSlime.png" },
            { name: "Noyau de Slime", rate: 5, image: "NoyaudeSlime.png" }
        ],
        location: "Marécage putride"
    },
    {
        id: 5,
        name: "Slime Magicien",
        category: "elite",
        type: "Créature",
        hp: 120,
        palier: 1,
        image: "../assets/mobs/Slime Magicien.png",
        description: "Un slime imprégné d'énergies arcaniques anciennes. Ses attaques lancent des sorts chaotiques et imprévisibles.",
        drops: [
            { name: "Gelée de Slime", rate: 30, image: "GeléedeSlime.png" },
            { name: "Noyau de Slime", rate: 5, image: "NoyaudeSlime.png" }
        ],
        location: "Marécage putride"
    },

    // Palier 1 - Zone des Sangliers
    {
        id: 6,
        name: "Sanglier",
        category: "creature",
        type: "Bête",
        hp: 65,
        palier: 1,
        image: "../assets/mobs/Sangliers.png",
        description: "Une bête sauvage issue des forêts du premier palier. Il charge sans relâche, animé d'une rage primitive.",
        drops: [
            { name: "Peau de Sanglier", rate: 65, image: "Peau de Sanglier.png" }
        ],
        location: "Zone des Sangliers"
    },

    // Palier 1 - Bois Sacré
    {
        id: 7,
        name: "Mage Sylvestre",
        category: "elite",
        type: "Plante",
        hp: 90,
        palier: 1,
        image: "../assets/mobs/Mage Sylvestre.avif",
        description: "Il canalise la magie des arbres anciens. Ses enchantements font fleurir ou pourrir tout ce qu'il touche.",
        drops: [
            { name: "Brindille Enchantée", rate: 30, image: "BrindilleEnchantées.png" },
            { name: "Coeur de Bois", rate: 20, image: "CoeurdeBois.png" },
            { name: "Tissu Spectral", rate: 30, image: "TissuSpectral.png" }
        ],
        location: "Bois Sacré"
    },
    {
        id: 8,
        name: "Mini Tréant",
        category: "creature",
        type: "Plante",
        hp: 50,
        palier: 1,
        image: "../assets/mobs/Mini Tréant.avif",
        description: "Petit gardien de la forêt, il défend les lieux sacrés avec hargne. Sous ses racines courtes dort une volonté de fer.",
        drops: [
            { name: "Pousse de Sylve", rate: 40, image: "PoussedeSylve.png" },
            { name: "Éclat de Bois Magique", rate: 30, image: "EclatdeBoisMagique.png" }
        ],
        location: "Bois Sacré"
    },
    {
        id: 9,
        name: "Tréant Elite",
        category: "elite",
        type: "Plante",
        hp: 80,
        palier: 1,
        image: "../assets/mobs/Tréant Elite.avif",
        description: "Ancien protecteur des forêts oubliées, ce tréant détient une puissance redoutable.",
        drops: [
            { name: "Écorce Sylvestre", rate: 40, image: "EcorceSylvestre.png" },
            { name: "Corde d'arc Sylvestre", rate: 25, image: "CordedarcSylvestre.png" }
        ],
        location: "Bois Sacré"
    },
    {
        id: 10,
        name: "Guerrier Tréant",
        category: "elite",
        type: "Plante",
        hp: 100,
        palier: 1,
        image: "../assets/mobs/Guerrier Tréant.avif",
        description: "Forgé dans l'écorce et la magie, ce tréant veille sur les bois sacrés. Il frappe avec la force d'un vieux chêne, et la colère de la forêt.",
        drops: [
            { name: "Écorce de Titan", rate: 35, image: "EcorcedeTitan.png" },
            { name: "Racine Ancestrale", rate: 10, image: "RacineAncestrale.png" }
        ],
        location: "Bois Sacré"
    },
    {
        id: 11,
        name: "Gardien Colossal",
        category: "boss",
        type: "Golem",
        hp: 250,
        palier: 1,
        image: "../assets/mobs/Gardien Colossal.avif",
        description: "Forgé dans la pierre et éveillé par la magie ancienne, il garde les terres oubliées contre toute intrusion. Ses pas seuls font trembler la forêt...",
        drops: [
            { name: "Mycélium Magique", rate: 5, image: "MycéliumMagique.png" }
        ],
        location: "Bois Sacré"
    },

    // Palier 1 - Vallée des loups
    {
        id: 12,
        name: "Loup Blanc",
        category: "creature",
        type: "Bête",
        hp: 90,
        palier: 1,
        image: "../assets/mobs/Loup Sinistre Blanc.png",
        description: "Gardien de la Vallée des Loups. Son hurlement glace le sang.",
        drops: [
            { name: "Fourrure de Loup", rate: 60, image: "FourruredeLoup.png" },
            { name: "Crocs de Loup", rate: 30, image: "CrocsdeLoup.png" }
        ],
        location: "Vallée des loups"
    },
    {
        id: 13,
        name: "Loup Brun",
        category: "creature",
        type: "Bête",
        hp: 450,
        palier: 1,
        image: "../assets/mobs/Loup Sinistre Brun.png",
        description: "Gardien de la Vallée des Loups. Son hurlement donne une frénésie.",
        drops: [
            { name: "Fourrure de Loup", rate: 60, image: "FourruredeLoup.png" },
            { name: "Crocs de Loup", rate: 30, image: "CrocsdeLoup.png" }
        ],
        location: "Vallée des loups"
    },
    {
        id: 14,
        name: "Loup Noir",
        category: "creature",
        type: "Bête",
        hp: 90,
        palier: 1,
        image: "../assets/mobs/Loup SInistre Noir.png",
        description: "Gardien de la Vallée des Loups. Son hurlement donne des frissons.",
        drops: [
            { name: "Fourrure de Loup", rate: 60, image: "FourruredeLoup.png" },
            { name: "Crocs de Loup", rate: 30, image: "CrocsdeLoup.png" }
        ],
        location: "Vallée des loups"
    },
    {
        id: 15,
        name: "Albal",
        category: "boss",
        type: "Bête",
        hp: 500,
        palier: 1,
        image: "../assets/mobs/Loup SInistre Noir.png",
        description: "Le chef alpha de la Vallée des Loups, une bête légendaire aux crocs acérés.",
        drops: [
            { name: "Fourrure de Loup", rate: 100, image: "FourruredeLoup.png" },
            { name: "Crocs de Loup", rate: 70, image: "CrocsdeLoup.png" }
        ],
        location: "Vallée des loups"
    },

    // Anciens mobs conservés (paliers 2-3)
    {
        id: 16,
        name: "Ika",
        category: "boss",
        type: "Tortue Ancienne",
        hp: 800,
        palier: 1,
        image: "../assets/mobs/Ika.avif",
        description: "Cette tortue ancienne erre lentement dans les recoins oubliés du monde. Sa carapace recèle les secrets d'âges passés.",
        drops: [
            { name: "Carapace d'Ika", rate: 80, image: "CarapacedIka.png" }
        ],
        location: "Archipel Ika"
    },
    {
        id: 17,
        name: "Narax",
        category: "boss",
        type: "Démon",
        hp: 850,
        palier: 1,
        image: "../assets/mobs/Narax.png",
        description: "Un archidémon des flammes éternelles, seigneur d'un royaume infernal.",
        drops: [],
        location: "Cœur des Enfers"
    },
    {
        id: 18,
        name: "Néphantes",
        category: "boss",
        type: "Plante Carnivore",
        hp: 150,
        palier: 1,
        image: "../assets/mobs/Nephantes.gif",
        description: "Cette plante carnivore géante se nourrit de chair et de sang. Ses lianes s'enroulent sans bruit, avant de refermer son piège mortel. Même les aventuriers aguerris évitent ses racines traînantes.",
        drops: [
            { name: "Spore Corrompu", rate: 50, image: "SporeCorrompu.png" },
            { name: "Fragments de Feuilles", rate: 45, image: "FragmentsdeFeuilles.png" }
        ],
        location: "Champ de Mizunari"
    },
    {
        id: 19,
        name: "Ornstein",
        category: "boss",
        type: "Chevalier Dragon",
        hp: 950,
        palier: 1,
        image: "../assets/mobs/Ornstein.avif",
        description: "Le légendaire tueur de dragons, chevalier au service du soleil, maître de la lance sacrée.",
        drops: [],
        location: "Cathédrale du Soleil"
    },
    {
        id: 20,
        name: "Plante Dévoreuse",
        category: "elite",
        type: "Plante",
        hp: 125,
        palier: 1,
        image: "../assets/mobs/Plante Dévoreuse.avif",
        description: "Discrète sous ses feuilles luxuriantes, le danger rôde au moindre faux pas... Ses racines enserrent ses proies, lentement, avant de les engloutir sans laisser de trace.",
        drops: [],
        location: "Donjon Geldorak"
    },
    {
        id: 21,
        name: "Smoug",
        category: "boss",
        type: "Dragon",
        hp: 1200,
        palier: 1,
        image: "../assets/mobs/Smoug.png",
        description: "Le dragon ancien des montagnes, gardien d'un trésor légendaire accumulé sur des millénaires.",
        drops: [],
        location: "Pic du Dragon"
    },
    {
        id: 22,
        name: "Spirite de Glace",
        category: "elite",
        type: "Élémentaire",
        hp: 220,
        palier: 1,
        image: "../assets/mobs/Spirite de glace.png",
        description: "Âme ancienne née des tempêtes hivernales, la Spirite de Glace veille sur les terres gelées. Elle murmure aux vents et glace les intrus, protégeant les secrets oubliés du givre éternel.",
        drops: [
            { name: "Peau Dur Glacial", rate: 30, image: "PeaudurGlacial.png" },
            { name: "Poussière de givre", rate: 35, image: "PoussièredeGivre.png" }
        ],
        location: "Citadelle de glace"
    },

    // Palier 1 - Araignées
    {
        id: 23,
        name: "Araignée Chasseuse",
        category: "creature",
        type: "Araignée",
        hp: 75,
        palier: 1,
        image: "../assets/mobs/Araignée_chasseuse.png",
        description: "Une araignée agile et rusée qui traque ses proies dans l'ombre. Ses pattes acérées percent les armures légères.",
        drops: [
            { name: "Fil d'Araignée", rate: 50, image: "FildAraignée.png" },
            { name: "Venin d'Araignée", rate: 25, image: "VenindAraignée.png" }
        ],
        location: "Cavernes Sombres"
    },
    {
        id: 24,
        name: "Araignée Empoisonnée",
        category: "elite",
        type: "Araignée",
        hp: 95,
        palier: 1,
        image: "../assets/mobs/Araignée_empoisonnée.png",
        description: "Une araignée dont le venin est mortel. Ses crochets distillent un poison qui paralyse ses victimes.",
        drops: [
            { name: "Fil d'Araignée", rate: 60, image: "FildAraignée.png" },
            { name: "Venin d'Araignée", rate: 40, image: "VenindAraignée.png" }
        ],
        location: "Cavernes Sombres"
    },
    {
        id: 25,
        name: "Araignée Étrangleuse",
        category: "elite",
        type: "Araignée",
        hp: 110,
        palier: 1,
        image: "../assets/mobs/Araignée_étrangleuse.png",
        description: "Cette araignée massive utilise sa toile pour étrangler ses proies. Son corps imposant cache une force redoutable.",
        drops: [
            { name: "Fil d'Araignée Renforcé", rate: 55, image: "FildAraignéeRenforcé.png" },
            { name: "Tissu d'Araignée", rate: 30, image: "TissudAraignée.png" }
        ],
        location: "Cavernes Sombres"
    },

    // Palier 1 - Kobolds
    {
        id: 26,
        name: "Kobold",
        category: "creature",
        type: "Humanoïde",
        hp: 60,
        palier: 1,
        image: "../assets/mobs/Kobold.png",
        description: "Un petit humanoïde rusé vivant dans les cavernes. Faible individuellement mais dangereux en groupe.",
        drops: [],
        location: "Mines de Kobold"
    },
    {
        id: 27,
        name: "Archer Kobold",
        category: "creature",
        type: "Humanoïde",
        hp: 55,
        palier: 1,
        image: "../assets/mobs/Archer_kobold.png",
        description: "Un kobold équipé d'un arc rudimentaire. Il préfère attaquer à distance depuis les hauteurs.",
        drops: [],
        location: "Mines de Kobold"
    },
    {
        id: 28,
        name: "Guerrier Kobold",
        category: "elite",
        type: "Humanoïde",
        hp: 85,
        palier: 1,
        image: "../assets/mobs/Guerrier_kobold.png",
        description: "Un kobold plus grand et mieux équipé que ses congénères. Il mène les groupes au combat.",
        drops: [],
        location: "Mines de Kobold"
    },
    {
        id: 29,
        name: "Hallebardier Kobold",
        category: "elite",
        type: "Humanoïde",
        hp: 90,
        palier: 1,
        image: "../assets/mobs/Hallebardier_Kobold.png",
        description: "Armé d'une hallebarde artisanale, ce kobold défend les passages stratégiques des mines.",
        drops: [],
        location: "Mines de Kobold"
    },
    {
        id: 30,
        name: "Mineur Kobold",
        category: "creature",
        type: "Humanoïde",
        hp: 70,
        palier: 1,
        image: "../assets/mobs/Mineur_Kobold.png",
        description: "Un kobold mineur qui extrait des minerais. Plus résistant que la moyenne grâce à son travail.",
        drops: [],
        location: "Mines de Kobold"
    },
    {
        id: 31,
        name: "Soldat Kobold",
        category: "elite",
        type: "Humanoïde",
        hp: 95,
        palier: 1,
        image: "../assets/mobs/Soldat_kobold.png",
        description: "Un kobold entraîné au combat organisé. Il porte une armure fonctionnelle et se bat avec discipline.",
        drops: [],
        location: "Mines de Kobold"
    },
    {
        id: 32,
        name: "Sorcier Kobold",
        category: "elite",
        type: "Humanoïde",
        hp: 80,
        palier: 1,
        image: "../assets/mobs/Sorcier_kobold.png",
        description: "Un kobold qui a appris les rudiments de la magie. Ses sorts sont primitifs mais efficaces.",
        drops: [],
        location: "Mines de Kobold"
    },

    // Palier 1 - Squelettes
    {
        id: 33,
        name: "Squelette",
        category: "creature",
        type: "Mort-vivant",
        hp: 100,
        palier: 1,
        image: "../assets/mobs/squelette.png",
        description: "Un guerrier défunt animé par la nécromancie. Ses os cliquettent dans la nuit éternelle.",
        drops: [
            { name: "Os de Squelette", rate: 60, image: "OsdeSquelette.png" },
            { name: "Poussière d'Os", rate: 40, image: "PoussièredOs.png" }
        ],
        location: "Cimetière Maudit"
    },
    {
        id: 34,
        name: "Archer Squelette",
        category: "creature",
        type: "Mort-vivant",
        hp: 90,
        palier: 1,
        image: "../assets/mobs/Archer_squelette.png",
        description: "Un squelette armé d'un arc ancien. Ses flèches ne manquent jamais leur cible.",
        drops: [
            { name: "Os de Squelette", rate: 55, image: "OsdeSquelette.png" }
        ],
        location: "Cimetière Maudit"
    },
    {
        id: 35,
        name: "Épéiste Squelette",
        category: "elite",
        type: "Mort-vivant",
        hp: 120,
        palier: 1,
        image: "../assets/mobs/Epeiste_squelette.png",
        description: "Un maître d'armes du passé, encore mortel malgré la mort. Sa lame danse avec une précision macabre.",
        drops: [
            { name: "Os de Squelette Renforcé", rate: 50, image: "OsdeSqueletteRenforcé.png" }
        ],
        location: "Cimetière Maudit"
    },
    {
        id: 36,
        name: "Guerrier Squelette",
        category: "elite",
        type: "Mort-vivant",
        hp: 130,
        palier: 1,
        image: "../assets/mobs/Guerrier_squelette.png",
        description: "Un ancien guerrier ressuscité, vêtu d'une armure rouillée mais toujours fonctionnelle.",
        drops: [
            { name: "Os de Squelette Renforcé", rate: 50, image: "OsdeSqueletteRenforcé.png" }
        ],
        location: "Cimetière Maudit"
    },
    {
        id: 37,
        name: "Hallebardier Squelette",
        category: "elite",
        type: "Mort-vivant",
        hp: 135,
        palier: 1,
        image: "../assets/mobs/Hallebardier_squelette.png",
        description: "Gardien éternel armé d'une hallebarde spectrale. Sa portée est redoutable.",
        drops: [
            { name: "Os de Squelette Renforcé", rate: 55, image: "OsdeSqueletteRenforcé.png" }
        ],
        location: "Cimetière Maudit"
    },
    {
        id: 38,
        name: "Tank Squelette",
        category: "elite",
        type: "Mort-vivant",
        hp: 180,
        palier: 1,
        image: "../assets/mobs/Tank_squelette.png",
        description: "Un colosse osseux recouvert d'une armure lourde. Pratiquement indestructible.",
        drops: [
            { name: "Os de Squelette Renforcé", rate: 40, image: "OsdeSqueletteRenforcé.png" }
        ],
        location: "Cimetière Maudit"
    },
    {
        id: 39,
        name: "Sorcier Squelette",
        category: "elite",
        type: "Mort-vivant",
        hp: 110,
        palier: 1,
        image: "../assets/mobs/Sorcier_squelette.png",
        description: "Un nécromancien déchu qui maîtrise encore les arts sombres. Ses sorts drainent la vie.",
        drops: [],
        location: "Cimetière Maudit"
    },

    // Palier 1 - Déchus
    {
        id: 40,
        name: "Soldat Déchu",
        category: "elite",
        type: "Humanoïde",
        hp: 140,
        palier: 1,
        image: "../assets/mobs/Soldat-Déchu.png",
        description: "Un soldat corrompu par les ténèbres. Son âme est perdue mais son entraînement perdure.",
        drops: [],
        location: "Terres Déchues"
    },
    {
        id: 41,
        name: "Gardien Déchu",
        category: "elite",
        type: "Humanoïde",
        hp: 160,
        palier: 1,
        image: "../assets/mobs/Gardien-Déchu.png",
        description: "Autrefois protecteur de la lumière, maintenant serviteur des ombres. Sa force n'a fait que croître.",
        drops: [],
        location: "Terres Déchues"
    },
    {
        id: 42,
        name: "Guerrier Déchu",
        category: "elite",
        type: "Humanoïde",
        hp: 155,
        palier: 1,
        image: "../assets/mobs/Guerrier Déchu.png",
        description: "Un champion tombé dans les ténèbres. Sa lame brise les espoirs comme elle brise les armures.",
        drops: [],
        location: "Terres Déchues"
    },
    {
        id: 43,
        name: "Héraut Déchu",
        category: "boss",
        type: "Humanoïde",
        hp: 450,
        palier: 1,
        image: "../assets/mobs/Héraut-Déchu.png",
        description: "Le commandant des armées déchues. Son aura corrompt tout ce qui l'entoure.",
        drops: [
            { name: "Âme de l'Herald", rate: 25, image: "ÂmedelHerald.png" }
        ],
        location: "Terres Déchues"
    },
    {
        id: 44,
        name: "Faucheuse Déchu",
        category: "boss",
        type: "Mort-vivant",
        hp: 500,
        palier: 1,
        image: "../assets/mobs/Faucheuse-Déchu.png",
        description: "La mort incarnée, corrompue par les ténèbres. Sa faux récolte les âmes des vivants.",
        drops: [
            { name: "Âme du Reaper", rate: 10, image: "ÂmeduReaper.png" }
        ],
        location: "Terres Déchues"
    },

    // Palier 1 - Autres créatures
    {
        id: 45,
        name: "Golem de Glace",
        category: "elite",
        type: "Élémentaire",
        hp: 200,
        palier: 1,
        image: "../assets/mobs/Golem_de_glace.png",
        description: "Forgé dans les profondeurs d'un glacier ancien, le Golem de Glace est une sentinelle implacable. Son corps de cristal givré repousse toute chaleur, et ses coups peuvent figer le sang en un instant.",
        drops: [
            { name: "Peau Dur Glacial", rate: 30, image: "PeaudurGlacial.png" },
            { name: "Poussière de givre", rate: 40, image: "PoussièredeGivre.png" }
        ],
        location: "Citadelle de glace"
    },
    {
        id: 46,
        name: "Ours Glacial",
        category: "elite",
        type: "Bête",
        hp: 175,
        palier: 1,
        image: "../assets/mobs/Ours_Glacial.png",
        description: "Un ours massif adapté au froid extrême. Sa fourrure blanche le rend quasi invisible dans la neige.",
        drops: [
            { name: "Fragment de l'Âme de l'Ours", rate: 5, image: "FragmentdelÂmedelOurs.png" }
        ],
        location: "Citadelle de glace"
    },
    {
        id: 47,
        name: "Plante Mutante",
        category: "elite",
        type: "Plante",
        hp: 2000,
        palier: 1,
        image: "../assets/mobs/Plante_mutante.png",
        description: "Entité rampante née des mines de Geldorak, Vyrmoss s'imprègne des spores et de la terre humide. Sa peau est couverte de mousse vivante, et son souffle corrompt tout ce qu'il touche.",
        drops: [],
        location: "Donjon Geldorak"
    },
    {
        id: 48,
        name: "Essaim d'Insectes",
        category: "creature",
        type: "Essaim",
        hp: 20,
        palier: 1,
        image: "../assets/mobs/Essaim d'insectes.png",
        description: "Un nuage bourdonnant d'insectes agressifs. Difficile à combattre, impossible à fuir.",
        drops: [],
        location: "Marais Toxique"
    },
    {
        id: 49,
        name: "Farfadet",
        category: "creature",
        type: "Féérique",
        hp: 250,
        palier: 1,
        image: "../assets/mobs/Farfadet.png",
        description: "Une créature espiègle de la forêt enchantée. Méfiez-vous de sa magie illusoire.",
        drops: [],
        location: "Forêt Enchantée"
    },
    {
        id: 50,
        name: "Cerf",
        category: "creature",
        type: "Bête",
        hp: 70,
        palier: 1,
        image: "../assets/mobs/Cerf.png",
        description: "Majestueux et insaisissable, le Cerf des Montagnes habite les hauteurs glacées et les forêts enneigées. On raconte qu'il apparaît aux âmes pures, guidant les voyageurs égarés vers la sécurité.",
        drops: [],
        location: "Tolbana"
    },
    {
        id: 51,
        name: "Bandit Assassin",
        category: "elite",
        type: "Humanoïde",
        hp: 120,
        palier: 1,
        image: "../assets/mobs/Bandit Assassin.png",
        description: "Maître de l'ombre et des lames silencieuses, il ne laisse derrière lui que le vide... et une cible tombée.",
        drops: [
            { name: "Petite Bourse", rate: 35, image: "PetiteBourse.png" }
        ],
        location: "Montagne des bandits"
    },
    {
        id: 52,
        name: "Poisson Requin",
        category: "elite",
        type: "Bête Aquatique",
        hp: 500,
        palier: 1,
        image: "../assets/mobs/Poisson_requin.png",
        description: "Prédateur implacable des eaux profondes, le Poisson Requin traque silencieusement ses proies. Ses dents acérées peuvent trancher l'acier, et son instinct ne connaît ni pitié ni repos.",
        drops: [
            { name: "Carapace de Requin", rate: 40, image: "CarapcedeRequin.png" }
        ],
        location: "Virelune"
    },

    // Palier 1 - Boss légendaires
    {
        id: 53,
        name: "Illfang",
        category: "boss",
        type: "Kobold Seigneur",
        hp: 600,
        palier: 1,
        image: "../assets/mobs/illfang.png",
        description: "Le roi des kobolds, un seigneur de guerre redoutable. Premier boss légendaire d'Aincrad.",
        drops: [],
        location: "Palais Kobold"
    },
    {
        id: 54,
        name: "Jira",
        category: "boss",
        type: "Démon",
        hp: 750,
        palier: 1,
        image: "../assets/mobs/Jira.png",
        description: "Un démon ancien emprisonné dans les profondeurs. Sa rage est sans limites.",
        drops: [],
        location: "Cachot Infernal"
    },
    {
        id: 55,
        name: "Kamilia",
        category: "boss",
        type: "Mage",
        hp: 650,
        palier: 1,
        image: "../assets/mobs/Kamilia.png",
        description: "Une archimage corrompue. Ses sorts peuvent plier la réalité elle-même.",
        drops: [],
        location: "Tour Arcanique"
    },
    {
        id: 56,
        name: "Léviathan",
        category: "boss",
        type: "Serpent de Mer",
        hp: 5000,
        palier: 1,
        image: "../assets/mobs/leviathan.png",
        description: "Serpent mythique glissant entre les courants profonds, Nymbréa incarne la grâce et la traîtrise des eaux calmes. Ses écailles scintillent comme des perles maudites.",
        drops: [
            { name: "Coeur de Nautherion", rate: 10, image: "CoeurdeNautherion.png" }
        ],
        location: "Virelune"
    },
    {
        id: 57,
        name: "Priscilia",
        category: "boss",
        type: "Dragon-Humanoïde",
        hp: 850,
        palier: 1,
        image: "../assets/mobs/priscilia.png",
        description: "Une dragonne métamorphe, reine des dragons. Sa beauté cache une puissance dévastatrice.",
        drops: [],
        location: "Nid du Dragon"
    },
    {
        id: 58,
        name: "Soul Knight",
        category: "boss",
        type: "Chevalier Maudit",
        hp: 800,
        palier: 1,
        image: "../assets/mobs/soulknight.png",
        description: "Un chevalier dont l'âme est liée à son armure pour l'éternité. Gardien immortel.",
        drops: [],
        location: "Forteresse Oubliée"
    },
    {
        id: 59,
        name: "Yula",
        category: "boss",
        type: "Sorcière",
        hp: 700,
        palier: 1,
        image: "../assets/mobs/Yula.png",
        description: "La sorcière des marais, maîtresse des malédictions. Ses potions sont mortelles.",
        drops: [],
        location: "Marais Maudit"
    },
    {
        id: 60,
        name: "Octana",
        category: "boss",
        type: "Pieuvre Géante",
        hp: 780,
        palier: 1,
        image: "../assets/mobs/Octana.png",
        description: "Une pieuvre colossale des profondeurs. Ses tentacules peuvent couler des navires entiers.",
        drops: [],
        location: "Fosse Océanique"
    }
];

// État de l'application
let filteredCreatures = [...creaturesData];
let selectedCreature = null;

// État de la pagination
let currentPage = 1;
let itemsPerPage = 12;
let totalPages = 1;

// Cycle de vie SPA (nettoyage des écouteurs)
let besController = null;

// ============================================================
// NAMELESS — Bestiaire (Codex des créatures)
// Rendu 100% DOM (createElement/textContent), délégation,
// aucun handler inline. Données: creaturesData (ci-dessus).
// ============================================================

const FALLBACK_IMG = '../assets/Logo_3.png';

function initBestiary(root) {
    destroyBestiary();
    if (!document.getElementById('creatures-grid')) return;
    besController = new AbortController();
    populateDynamicFilters();
    setupImageFallback();
    setupEventListeners();
    filterCreatures();
}

function destroyBestiary() {
    if (besController) { besController.abort(); besController = null; }
    const modal = document.querySelector('.creature-modal');
    if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
    document.body.style.overflow = 'auto';
    selectedCreature = null;
    filteredCreatures = [...creaturesData];
    currentPage = 1;
    totalPages = 1;
}

window.NamelessBestiaryPage = { init: initBestiary, destroy: destroyBestiary };

function besAutoStart() {
    if (window.NamelessSpaRouter && window.NamelessSpaRouter.controlsLifecycle) return;
    initBestiary(document);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', besAutoStart);
} else {
    besAutoStart();
}

// --- Filtres dynamiques (type, zone) depuis les données ---
function populateDynamicFilters() {
    const types = [...new Set(creaturesData.map(c => c.type))].sort((a, b) => a.localeCompare(b, 'fr'));
    const zones = [...new Set(creaturesData.map(c => c.location))].sort((a, b) => a.localeCompare(b, 'fr'));
    fillSelect(document.getElementById('bes-type'), types);
    fillSelect(document.getElementById('bes-zone'), zones);
}
function fillSelect(select, values) {
    if (!select) return;
    values.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        select.appendChild(opt);
    });
}

// --- Fallback image sans onerror inline (phase de capture) ---
function setupImageFallback() {
    document.addEventListener('error', (e) => {
        const t = e.target;
        if (t && t.tagName === 'IMG' && t.dataset && t.dataset.fallback === 'bes' && !t.dataset.fbApplied) {
            t.dataset.fbApplied = '1';
            t.src = FALLBACK_IMG;
            t.classList.add('is-fallback');
        }
    }, { capture: true, signal: besController.signal });
}

// --- Écouteurs ---
function setupEventListeners() {
    const opts = { signal: besController.signal };

    const search = document.getElementById('bes-search');
    if (search) search.addEventListener('input', filterCreatures, opts);
    ['bes-palier', 'bes-category', 'bes-type', 'bes-zone'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', filterCreatures, opts);
    });

    // Grille: délégation clic -> ouvrir le modal (data-id)
    const grid = document.getElementById('creatures-grid');
    if (grid) {
        grid.addEventListener('click', (e) => {
            const card = e.target.closest('.creature-card[data-id]');
            if (card) openCreatureModal(parseInt(card.dataset.id, 10));
        }, opts);
        grid.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const card = e.target.closest('.creature-card[data-id]');
            if (card) { e.preventDefault(); openCreatureModal(parseInt(card.dataset.id, 10)); }
        }, opts);
    }

    // Pagination
    const prev = document.getElementById('prev-page');
    if (prev) prev.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderCreatures(); scrollTop(); } }, opts);
    const next = document.getElementById('next-page');
    if (next) next.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; renderCreatures(); scrollTop(); } }, opts);
    const ipp = document.getElementById('items-per-page');
    if (ipp) ipp.addEventListener('change', (e) => { itemsPerPage = parseInt(e.target.value, 10) || 12; currentPage = 1; renderCreatures(); }, opts);
    const nums = document.getElementById('pagination-numbers');
    if (nums) nums.addEventListener('click', (e) => {
        const b = e.target.closest('[data-page]');
        if (!b) return;
        const p = parseInt(b.dataset.page, 10);
        if (!isNaN(p)) { currentPage = p; renderCreatures(); scrollTop(); }
    }, opts);

    // Fermeture modal (backdrop / bouton) + clic sur un drop, par délégation
    document.addEventListener('click', (e) => {
        const modal = document.querySelector('.creature-modal');
        if (!modal || modal.style.display === 'none') return;
        if (e.target.classList.contains('creature-modal') || e.target.closest('.modal-close')) { closeModal(); return; }
        const drop = e.target.closest('.drop-item[data-item]');
        if (drop) navigateToItem(drop.dataset.item);
    }, opts);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); }, opts);
}

function scrollTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

// --- Filtrage ---
function filterCreatures() {
    const q = (document.getElementById('bes-search')?.value || '').toLowerCase().trim();
    const palier = document.getElementById('bes-palier')?.value || '';
    const category = document.getElementById('bes-category')?.value || '';
    const type = document.getElementById('bes-type')?.value || '';
    const zone = document.getElementById('bes-zone')?.value || '';

    filteredCreatures = creaturesData.filter(c => {
        const matchesSearch = !q ||
            c.name.toLowerCase().includes(q) ||
            c.type.toLowerCase().includes(q) ||
            c.location.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q);
        const matchesPalier = !palier || String(c.palier) === palier;
        const matchesCategory = !category || c.category === category;
        const matchesType = !type || c.type === type;
        const matchesZone = !zone || c.location === zone;
        return matchesSearch && matchesPalier && matchesCategory && matchesType && matchesZone;
    });
    currentPage = 1;
    renderCreatures();
}

// --- Rendu de la grille (DOM) ---
function renderCreatures() {
    const grid = document.getElementById('creatures-grid');
    if (!grid) return;
    grid.innerHTML = '';

    totalPages = Math.max(1, Math.ceil(filteredCreatures.length / itemsPerPage));
    if (currentPage > totalPages) currentPage = totalPages;

    if (filteredCreatures.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'bes-empty';
        const h = document.createElement('h3');
        h.textContent = 'Aucune créature trouvée';
        const p = document.createElement('p');
        p.textContent = 'Modifie ta recherche ou tes filtres.';
        empty.appendChild(h);
        empty.appendChild(p);
        grid.appendChild(empty);
        updatePagination();
        return;
    }

    const start = (currentPage - 1) * itemsPerPage;
    filteredCreatures.slice(start, start + itemsPerPage).forEach(c => grid.appendChild(buildCard(c)));
    updatePagination();
}

function makeChip(text, cls) {
    const s = document.createElement('span');
    s.className = 'creature-chip ' + (cls || '');
    s.textContent = text;
    return s;
}

function buildCard(creature) {
    const card = document.createElement('article');
    card.className = 'creature-card cat-' + creature.category;
    card.dataset.id = creature.id;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', 'Voir ' + creature.name);

    const media = document.createElement('div');
    media.className = 'creature-media';
    const img = document.createElement('img');
    img.className = 'creature-image';
    img.loading = 'lazy';
    img.alt = creature.name;
    img.dataset.fallback = 'bes';
    img.src = creature.image;
    media.appendChild(img);
    const catTag = document.createElement('span');
    catTag.className = 'creature-cat-tag tag-' + creature.category;
    catTag.textContent = getCategoryDisplay(creature.category);
    media.appendChild(catTag);
    card.appendChild(media);

    const body = document.createElement('div');
    body.className = 'creature-body';

    const name = document.createElement('h3');
    name.className = 'creature-name';
    name.textContent = creature.name;
    body.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'creature-meta';
    meta.appendChild(makeChip('Palier ' + creature.palier, 'chip-palier'));
    meta.appendChild(makeChip(creature.type, 'chip-type'));
    body.appendChild(meta);

    const stats = document.createElement('div');
    stats.className = 'creature-stats';
    const hp = document.createElement('div');
    hp.className = 'creature-hp';
    const hpLabel = document.createElement('span');
    hpLabel.className = 'hp-label';
    hpLabel.textContent = 'PV';
    const hpVal = document.createElement('span');
    hpVal.className = 'hp-val';
    hpVal.textContent = creature.hp;
    hp.appendChild(hpLabel);
    hp.appendChild(hpVal);
    stats.appendChild(hp);
    body.appendChild(stats);

    const zone = document.createElement('div');
    zone.className = 'creature-zone';
    zone.textContent = creature.location;
    body.appendChild(zone);

    const btn = document.createElement('span');
    btn.className = 'creature-details-btn';
    btn.textContent = 'Détails';
    body.appendChild(btn);

    card.appendChild(body);
    return card;
}

// --- Modal détail (DOM) ---
function openCreatureModal(id) {
    const creature = creaturesData.find(c => c.id === id);
    if (!creature) return;
    selectedCreature = creature;

    let modal = document.querySelector('.creature-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.className = 'creature-modal';
        document.body.appendChild(modal);
    }
    modal.innerHTML = '';

    const content = document.createElement('div');
    content.className = 'modal-content';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'modal-close';
    close.setAttribute('aria-label', 'Fermer');
    close.textContent = '×';
    content.appendChild(close);

    const header = document.createElement('div');
    header.className = 'modal-header';

    const media = document.createElement('div');
    media.className = 'modal-media';
    const img = document.createElement('img');
    img.alt = creature.name;
    img.dataset.fallback = 'bes';
    img.src = creature.image;
    media.appendChild(img);
    header.appendChild(media);

    const info = document.createElement('div');
    info.className = 'modal-info';
    const h2 = document.createElement('h2');
    h2.className = 'modal-name';
    h2.textContent = creature.name;
    info.appendChild(h2);

    const badges = document.createElement('div');
    badges.className = 'modal-badges';
    badges.appendChild(makeChip(getCategoryDisplay(creature.category), 'chip-' + creature.category));
    badges.appendChild(makeChip(creature.type, 'chip-type'));
    badges.appendChild(makeChip('Palier ' + creature.palier, 'chip-palier'));
    info.appendChild(badges);

    const statRow = document.createElement('div');
    statRow.className = 'modal-stats';
    statRow.appendChild(makeStat('Points de vie', creature.hp));
    statRow.appendChild(makeStat('Zone', creature.location));
    info.appendChild(statRow);
    header.appendChild(info);
    content.appendChild(header);

    if (creature.description) {
        content.appendChild(makeSection('Description', (sec) => {
            const p = document.createElement('p');
            p.className = 'modal-desc';
            p.textContent = creature.description;
            sec.appendChild(p);
        }));
    }

    content.appendChild(makeSection('Butin possible', (sec) => {
        if (creature.drops && creature.drops.length) {
            const dgrid = document.createElement('div');
            dgrid.className = 'drops-grid';
            creature.drops.forEach(drop => dgrid.appendChild(buildDrop(drop)));
            sec.appendChild(dgrid);
        } else {
            const none = document.createElement('p');
            none.className = 'modal-desc';
            none.textContent = 'Aucun butin connu.';
            sec.appendChild(none);
        }
    }));

    modal.appendChild(content);
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function makeStat(label, value) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-stat';
    const l = document.createElement('span');
    l.className = 'modal-stat-label';
    l.textContent = label;
    const v = document.createElement('span');
    v.className = 'modal-stat-value';
    v.textContent = value;
    wrap.appendChild(l);
    wrap.appendChild(v);
    return wrap;
}

function makeSection(title, fill) {
    const sec = document.createElement('div');
    sec.className = 'modal-section';
    const t = document.createElement('h4');
    t.className = 'modal-section-title';
    t.textContent = title;
    sec.appendChild(t);
    fill(sec);
    return sec;
}

function buildDrop(drop) {
    const el = document.createElement('div');
    el.className = 'drop-item';
    el.dataset.item = drop.name;
    el.title = 'Voir cet item';
    const img = document.createElement('img');
    img.className = 'drop-icon';
    img.alt = drop.name;
    img.dataset.fallback = 'bes';
    img.src = getDropImagePath(drop);
    el.appendChild(img);
    const info = document.createElement('div');
    info.className = 'drop-info';
    const n = document.createElement('span');
    n.className = 'drop-name';
    n.textContent = drop.name;
    info.appendChild(n);
    if (drop.rate !== null && drop.rate !== undefined) {
        const r = document.createElement('span');
        r.className = 'drop-rate';
        r.textContent = drop.rate + '%';
        info.appendChild(r);
    }
    el.appendChild(info);
    return el;
}

function closeModal() {
    const modal = document.querySelector('.creature-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
    selectedCreature = null;
}

// --- Pagination (DOM) ---
function updatePagination() {
    const container = document.getElementById('pagination-container');
    const info = document.getElementById('pagination-info-text');
    const numsEl = document.getElementById('pagination-numbers');
    const prev = document.getElementById('prev-page');
    const next = document.getElementById('next-page');
    const total = filteredCreatures.length;
    totalPages = Math.max(1, Math.ceil(total / itemsPerPage));

    if (container) container.style.display = total === 0 ? 'none' : '';
    if (info) {
        if (total === 0) {
            info.textContent = '';
        } else {
            const start = (currentPage - 1) * itemsPerPage + 1;
            const end = Math.min(currentPage * itemsPerPage, total);
            info.textContent = 'Affichage de ' + start + '-' + end + ' sur ' + total + ' créatures';
        }
    }
    if (prev) prev.disabled = currentPage <= 1;
    if (next) next.disabled = currentPage >= totalPages;

    if (numsEl) {
        numsEl.innerHTML = '';
        if (totalPages <= 1) return;
        const maxShow = 7;
        let s = Math.max(1, currentPage - 3);
        let en = Math.min(totalPages, s + maxShow - 1);
        if (en - s < maxShow - 1) s = Math.max(1, en - maxShow + 1);
        if (s > 1) { numsEl.appendChild(pageBtn(1)); if (s > 2) numsEl.appendChild(pageEllipsis()); }
        for (let i = s; i <= en; i++) numsEl.appendChild(pageBtn(i));
        if (en < totalPages) { if (en < totalPages - 1) numsEl.appendChild(pageEllipsis()); numsEl.appendChild(pageBtn(totalPages)); }
    }
}
function pageBtn(n) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pagination-number' + (n === currentPage ? ' active' : '');
    b.textContent = n;
    b.dataset.page = n;
    return b;
}
function pageEllipsis() {
    const s = document.createElement('span');
    s.className = 'pagination-ellipsis';
    s.textContent = '…';
    return s;
}

// --- Utilitaires ---
function getCategoryDisplay(category) {
    const categories = { boss: 'Boss', elite: 'Élite', creature: 'Créature' };
    return categories[category] || category;
}

function navigateToItem(itemName) {
    localStorage.setItem('searchItemFromBestiaire', itemName);
    if (window.NamelessSpaRouter && typeof window.NamelessSpaRouter.navigate === 'function') {
        window.NamelessSpaRouter.navigate('/items');
    } else {
        window.location.href = '/items';
    }
}
// Fonction pour générer le chemin de l'image d'un drop
function getDropImagePath(drop) {
    // Si une image est explicitement définie, l'utiliser
    if (drop.image) {
        return `../assets/items/Ressources/${drop.image}`;
    }
    
    // Mapping des noms de drops vers leurs images
    const dropImageMap = {
        // Ressources avec noms spéciaux
        'Spore Corrompu': 'SporeCorrompu.png',
        'Fragments de Feuilles': 'FragmentsdeFeuilles.png',
        'Poussière de givre': 'PoussièredeGivre.png',
        'Eclat Magique Glacial': 'EclatdeBoisMagique.png',
        'Soie d\'araignée': 'FildAraignée.png',
        'Soie renforcée': 'FildAraignéeRenforcé.png',
        'Venin mineur': 'VenindAraignée.png',
        'Venin puissant': 'VenindAraignée.png',
        'Carapace d\'Ika': 'CarapacedIka.png',
        'Crochets acérés': 'CrocsdeLoup.png',
        'Glande à poison': 'VenindAraignée.png',
        'Œuf d\'araignée': 'TissudAraignée.png',
        // Ressources standard
        'Gelée de Slime': 'GeléedeSlime.png',
        'Noyau de Slime': 'NoyaudeSlime.png',
        'Essence de Gorbel': 'EssencedeGorbel.png',
        'Peau de Sanglier': 'Peau de Sanglier.png',
        'Brindille Enchantée': 'BrindilleEnchantées.png',
        'Coeur de Bois': 'CoeurdeBois.png',
        'Tissu Spectral': 'TissuSpectral.png',
        'Pousse de Sylve': 'PoussedeSylve.png',
        'Éclat de Bois Magique': 'EclatdeBoisMagique.png',
        'Écorce Sylvestre': 'EcorceSylvestre.png',
        'Corde d\'arc Sylvestre': 'CordedarcSylvestre.png',
        'Écorce de Titan': 'EcorcedeTitan.png',
        'Racine Ancestrale': 'RacineAncestrale.png',
        'Mycélium Magique': 'MycéliumMagique.png',
        'Fourrure de Loup': 'FourruredeLoup.png',
        'Crocs de Loup': 'CrocsdeLoup.png',
        'Os de Squelette': 'OsdeSquelette.png',
        'Os de Squelette Renforcé': 'OsdeSqueletteRenforcé.png',
        'Poussière d\'Os': 'PoussièredOs.png',
        'Tissu d\'Araignée': 'TissudAraignée.png',
        'Venin d\'Araignée': 'VenindAraignée.png',
        'Fil d\'Araignée': 'FildAraignée.png',
        'Fil d\'Araignée Renforcé': 'FildAraignéeRenforcé.png'
    };
    
    // Chercher l'image dans le mapping
    if (dropImageMap[drop.name]) {
        return `../assets/items/Ressources/${dropImageMap[drop.name]}`;
    }
    
    // Fallback: essayer de générer automatiquement le nom de fichier
    const autoGenerated = drop.name
        .replace(/[\s']+/g, '')
        .replace(/é/g, 'é')
        .replace(/è/g, 'è')
        .replace(/ê/g, 'ê')
        .replace(/à/g, 'à')
        .replace(/ô/g, 'ô')
        .replace(/û/g, 'û')
        .replace(/î/g, 'î');
    
    return `../assets/items/Ressources/${autoGenerated}.png`;
}
