"""Create responsive WebP copies of the original navigation art; never alter sources."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs" / "art-direction-2026-10-08"
SOURCES = DOCS / "sources"
OUTPUT = ROOT / "assets" / "illustrations"
WIDTHS = (256, 512, 768)
QUALITY = 76

DESCRIPTIONS = {
    "map": {
        "usage": "Home navigation: Carte d'Aincrad. Decorative exploration scene, never real map data.",
        "focal_point": [0.64, 0.35],
        "inspection": "Clear stone path and arched bridge; readable blue-grey citadel; coherent daylight and distance; no cartography or UI."
    },
    "bestiary": {
        "usage": "Home navigation: Bestiaire. Faithful artistic interpretation of the real Petit Slime; decorative environment only.",
        "focal_point": [0.59, 0.50],
        "inspection": "Cube silhouette and two dark square eyes match the source render; no mouth, limbs, armour or invented anatomy."
    },
    "items": {
        "usage": "Home navigation: Objets. Generic equipment workshop; does not replace a real game inventory item.",
        "focal_point": [0.69, 0.43],
        "inspection": "Single straight aligned sword; plausible kite shield; workshop materials and lighting agree with the collection."
    },
    "guild": {
        "usage": "Home navigation: Guilde. Empty council room; no fictional people, events or real game information.",
        "focal_point": [0.64, 0.45],
        "inspection": "Coherent oak council table and chairs, slate stone, ivory daylight; no members, legible documents or invented map."
    },
}

def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()

def metadata(path: Path) -> dict:
    with Image.open(path) as picture:
        return {
            "path": relative(path),
            "width": picture.width,
            "height": picture.height,
            "format": picture.format,
            "mode": picture.mode,
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        }

def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    records = []
    for category, description in DESCRIPTIONS.items():
        source = SOURCES / f"{category}-v2-source.png"
        source_before = metadata(source)
        with Image.open(source) as picture:
            original = picture.convert("RGB")
            variants = []
            for width in WIDTHS:
                if width > original.width:
                    raise ValueError("Upscaling is not permitted")
                height = round(original.height * width / original.width)
                output = OUTPUT / f"{category}-v2-{width}.webp"
                resized = original.resize((width, height), Image.Resampling.LANCZOS)
                resized.save(output, "WEBP", quality=QUALITY, method=6)
                variants.append(metadata(output))
        if source_before["sha256"] != sha256(source):
            raise ValueError(f"Source changed: {source}")
        records.append({"id": category, **description, "source": source_before, "variants": variants})
    manifest = {
        "version": "2026-10-08-navigation-v2",
        "generator": "built-in image_gen; one call per asset, no CLI/API fallback",
        "prompts": relative(DOCS / "navigation-prompts.json"),
        "artistic_bible": relative(DOCS / "ART_BIBLE.md"),
        "optimization": {
            "operation": "RGB WebP copies, Lanczos downscale only; no semantic retouching or synthetic repainting",
            "quality": QUALITY,
            "method": 6,
            "widths": list(WIDTHS),
        },
        "reference_subject": metadata(ROOT / "assets" / "mobs" / "Petit Slime.png"),
        "assets": records,
        "total_source_bytes": sum(record["source"]["bytes"] for record in records),
        "total_all_variants_bytes": sum(variant["bytes"] for record in records for variant in record["variants"]),
        "total_512_bytes": sum(variant["bytes"] for record in records for variant in record["variants"] if variant["width"] == 512),
        "total_256_bytes": sum(variant["bytes"] for record in records for variant in record["variants"] if variant["width"] == 256),
        "largest_variant_bytes": max(variant["bytes"] for record in records for variant in record["variants"]),
    }
    destination = DOCS / "navigation-art-manifest.json"
    destination.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: manifest[key] for key in ("total_source_bytes", "total_all_variants_bytes", "total_512_bytes", "total_256_bytes", "largest_variant_bytes")}))
    for record in records:
        print(json.dumps({"id": record["id"], "source": record["source"], "variants": record["variants"]}, ensure_ascii=False))

if __name__ == "__main__":
    main()
