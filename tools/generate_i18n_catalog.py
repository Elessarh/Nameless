"""Generate the static English catalogue used by js/i18n.js.

This is a development utility only. The generated website never calls a
translation service: it loads js/i18n-en.js like any other local asset.
"""

from __future__ import annotations

import html
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML_FILES = [ROOT / "index.html", ROOT / "404.html", *sorted((ROOT / "pages").glob("*.html"))]
JS_FILES = sorted((ROOT / "js").glob("*.js"))
OUTPUT = ROOT / "js" / "i18n-en.js"
ATTRIBUTES = {"aria-label", "aria-description", "placeholder", "title", "alt", "content"}
SKIPPED_TAGS = {"script", "style", "noscript", "code", "pre", "textarea"}
FRENCH_HINT = re.compile(
    r"[àâçéèêëîïôùûüÿœ]|\b(?:accueil|aucun|aucune|carte|chargement|choisir|connexion|"
    r"créature|déconnexion|détails|erreur|guilde|items?|joueur|langue|modifier|niveau|"
    r"page|palier|présence|profil|quête|recherche|répondre|sélectionner|supprimer|"
    r"utilisateur|wiki|affichage|ouvrir|fermer|enregistrer|annuler|publier|avec|dans|"
    r"depuis|pour|sans|cette|votre|vous|nous|leur|leurs|tous|toutes|trouvé|inconnu|"
    r"guerrier|commun|rare|légendaire|principal|secondaire|disponible|bientôt)\b",
    re.IGNORECASE,
)


OVERRIDES = {
    "Accueil": "Home",
    "Carte": "Map",
    "Bestiaire": "Bestiary",
    "Items": "Items",
    "Quêtes": "Quests",
    "Wiki": "Wiki",
    "Connexion": "Sign in",
    "Déconnexion": "Sign out",
    "Se déconnecter": "Sign out",
    "Ouvrir le menu": "Open menu",
    "Fermer le menu": "Close menu",
    "Navigation principale": "Main navigation",
    "Aller au contenu principal": "Skip to main content",
    "Sans nom. Jamais seuls.": "Nameless. Never alone.",
    "Rejoindre la guilde": "Join the guild",
    "Explorer le wiki": "Explore the wiki",
    "Choisir la langue": "Choose language",
    "Français": "French",
    "En cours...": "Working...",
    "Répondre": "Reply",
    "Supprimer": "Delete",
    "Modifier": "Edit",
    "Annuler": "Cancel",
    "Enregistrer": "Save",
    "Publier": "Publish",
    "Détails": "Details",
    "Rechercher...": "Search...",
    "Aucun résultat": "No results",
    "Chargement...": "Loading...",
    "Erreur de chargement": "Unable to load",
    "Mon profil": "My profile",
    "Espace guilde": "Guild area",
    "Dashboard admin": "Admin dashboard",
    "Nameless — Guilde Minecraft": "Nameless — Minecraft Guild",
    "Nous avons survécu à Aincrad, puis choisi l'oubli. Une guilde discrète et soudée, pour ceux qui préfèrent l'ombre à la gloire.": "We survived Aincrad, then chose obscurity. A close-knit, discreet guild for those who prefer the shadows to glory.",
    "Nameless réunit les": "Nameless brings together the",
    "d'un monde qui a voulu les effacer. Ici, pas de vantardise : de la": "of a world that tried to erase them. Here, there is no boasting—only",
    ", de la maîtrise, et une entraide sans faille. Explore notre monde, prépare tes expéditions, et forge ta place parmi les nôtres.": ", mastery, and unwavering mutual support. Explore our world, prepare your expeditions, and forge your place among us.",
    "Le domaine": "The world",
    "Boss de palier": "Floor boss",
    "Le premier gardien d'Aincrad. On l'étudie, on s'organise, on l'abat ensemble.": "Aincrad's first guardian. We study him, get organized, and take him down together.",
    "Préparer l'affrontement →": "Prepare for battle →",
    "Zones, donjons, villes et marchands — repérés palier par palier.": "Areas, dungeons, towns, and merchants—mapped floor by floor.",
    "Boss, élites et créatures : forces, faiblesses et zones d'apparition.": "Bosses, elites, and creatures: strengths, weaknesses, and spawn locations.",
    "Le catalogue d'items": "The item catalog",
    "Armes, armures et ressources d'Aincrad, classées par rareté.": "Weapons, armor, and resources from Aincrad, sorted by rarity.",
    "Les quêtes": "Quests",
    "Le parcours de la guilde : principales et secondaires, avec lieux et PNJ.": "The guild's journey: main and side quests, with locations and NPCs.",
    "Le savoir de la guilde": "Guild knowledge",
    "Règles, classes, métiers et donjons réunis dans le wiki.": "Rules, classes, professions, and dungeons—all gathered in the wiki.",
    "L'entraide au cœur": "Mutual support at heart",
    "Farm partagé, coups de main et préparation de groupe. On joue en meute.": "Shared farming, helping hands, and group preparation. We play as a pack.",
    "Prendre place parmi les nôtres": "Take your place among us",
    "Discret, fiable, motivé ? Lie ton compte Minecraft et présente-toi.": "Discreet, reliable, and motivated? Link your Minecraft account and introduce yourself.",
    "Préparation boss": "Boss preparation",
    "Analyse des patterns, rôles assignés et consommables prêts avant chaque affrontement de palier.": "Pattern analysis, assigned roles, and consumables ready before every floor battle.",
    "Cartographier Aincrad étage par étage : passages, ressources et dangers.": "Map Aincrad floor by floor: passages, resources, and dangers.",
    "Avancer les lignes principales et secondaires ensemble, sans laisser personne derrière.": "Complete the main and side questlines together, leaving no one behind.",
    "Optimisation équipement": "Gear optimization",
    "Forge, enchantements et builds : tirer le meilleur de chaque set.": "Crafting, enchantments, and builds: get the most from every gear set.",
    "Entraide membres": "Helping members",
    "Coups de main, farm partagé et conseils entre anciens et nouveaux.": "Helping hands, shared farming, and advice between veterans and newcomers.",
    "Documentation wiki": "Wiki documentation",
    "Des objectifs clairs, un planning et des rôles. On avance sans chaos.": "Clear goals, a schedule, and defined roles. We move forward without chaos.",
    "Entraide réelle": "Genuine mutual support",
    "Contenus difficiles": "Challenging content",
    "Sérieux, sans pression": "Serious, without pressure",
    "Exigeants sur le jeu, détendus sur le reste.": "Focused in-game, relaxed about everything else.",
    "Prête ou prêt à disparaître avec nous ?": "Ready to disappear with us?",
    "Nameless — Sans nom. Jamais seuls.": "Nameless — Nameless. Never alone.",
    "Règlement": "Rules",
    "Règlement Aincrad": "Aincrad Rules",
    "Règlement Chat Vocal": "Voice Chat Rules",
    "Règlement Discord": "Discord Rules",
    "Règlement dans l'Aincrad": "Rules in Aincrad",
}


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def meaningful(value: str) -> bool:
    return bool(value and re.search(r"[A-Za-zÀ-ÿ]", value) and not value.startswith(("http://", "https://")))


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[str] = []
        self.values: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.stack.append(tag.lower())
        for name, value in attrs:
            if name.lower() in ATTRIBUTES and value:
                clean = normalize(value)
                if meaningful(clean):
                    self.values.add(clean)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index] == tag:
                del self.stack[index:]
                break

    def handle_data(self, data: str) -> None:
        if any(tag in SKIPPED_TAGS for tag in self.stack):
            return
        clean = normalize(data)
        if meaningful(clean):
            self.values.add(clean)


def extract_html() -> set[str]:
    values: set[str] = set()
    for path in HTML_FILES:
        parser = TextExtractor()
        parser.feed(path.read_text(encoding="utf-8"))
        values.update(parser.values)
    return values


def iter_javascript_strings(source: str):
    """Yield real JS string literals while ignoring comments and source code."""
    index = 0
    length = len(source)
    while index < length:
        if source.startswith("//", index):
            newline = source.find("\n", index + 2)
            index = length if newline == -1 else newline + 1
            continue
        if source.startswith("/*", index):
            end = source.find("*/", index + 2)
            index = length if end == -1 else end + 2
            continue

        quote = source[index]
        if quote not in {"'", '"', "`"}:
            index += 1
            continue

        index += 1
        value: list[str] = []
        while index < length:
            char = source[index]
            if char == "\\" and index + 1 < length:
                escaped = source[index + 1]
                value.append({"n": " ", "r": " ", "t": " ", quote: quote}.get(escaped, escaped))
                index += 2
                continue
            if char == quote:
                index += 1
                yield "".join(value)
                break
            value.append(char)
            index += 1


def extract_javascript() -> set[str]:
    values: set[str] = set()
    for path in JS_FILES:
        if path.name.startswith("i18n"):
            continue
        source = path.read_text(encoding="utf-8")
        for raw in iter_javascript_strings(source):
            if "${" in raw or "<" in raw:
                continue
            clean = normalize(raw)
            if clean.startswith((".", "/", "../", ")", "[", "{")):
                continue
            if re.search(r"\.(?:avif|gif|html?|jpe?g|png|svg|webp)(?:\?|$)", clean, re.IGNORECASE):
                continue
            if any(token in clean for token in (
                "=>", ".replace(", "const ", "let ", "var ", "function ", "document.",
                "window.", "querySelector", "getElementById", "addEventListener", "return ", " = ", ";",
            )):
                continue
            if meaningful(clean) and FRENCH_HINT.search(clean):
                values.add(clean)
    return values


def load_translator():
    try:
        from argostranslate import translate
    except ImportError as error:
        raise SystemExit("Argos Translate is required to regenerate the catalogue.") from error

    installed = translate.get_installed_languages()
    french = next((language for language in installed if language.code == "fr"), None)
    english = next((language for language in installed if language.code == "en"), None)
    if not french or not english:
        raise SystemExit("The Argos French-to-English language package is not installed.")
    return french.get_translation(english)


def main() -> None:
    values = sorted(extract_html() | extract_javascript() | set(OVERRIDES))
    translator = load_translator()
    # Initialise the sentence splitter before worker threads share it.
    translator.translate("Bonjour")
    catalog: dict[str, str] = {}

    def translate_one(source: str) -> tuple[str, str]:
        if source in OVERRIDES:
            translated = OVERRIDES[source]
        elif len(source) <= 2 or source.isupper() and len(source.split()) == 1:
            translated = source
        else:
            translated = normalize(translator.translate(source))
        return source, translated

    with ThreadPoolExecutor(max_workers=8) as executor:
        translated_values = executor.map(translate_one, values)
        for index, (source, translated) in enumerate(translated_values, start=1):
            if translated and translated != source:
                catalog[source] = translated
            if index % 50 == 0 or index == len(values):
                print(f"Translated {index}/{len(values)}", flush=True)

    catalog.update(OVERRIDES)
    payload = json.dumps(dict(sorted(catalog.items())), ensure_ascii=False, indent=2)
    OUTPUT.write_text(
        "/* Generated local FR -> EN catalogue. No runtime translation API. */\n"
        "(function (global) {\n"
        "  'use strict';\n"
        "  global.NamelessTranslations = global.NamelessTranslations || {};\n"
        f"  global.NamelessTranslations.en = {payload};\n"
        "})(window);\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(catalog)} translations to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
