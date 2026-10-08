"""Create small home thumbnails from existing artwork without changing sources.

Run with the bundled Python/Pillow runtime. Item sprites and the hero are
intentionally excluded. Dimensions and byte hashes are recorded for review.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


SOURCES = (
    ("map", "assets/brand/page-font-map-mobile.webp", (256, 512), 82),
    ("bestiary", "assets/brand/page-font-bestiaire-mobile.webp", (256, 512), 82),
    ("items", "assets/brand/page-font-items-mobile.webp", (256, 512), 82),
    ("guild", "assets/caroussel_ensemble.webp", (256, 512), 82),
    ("illfang", "assets/mobs/illfang.png", (256,), 84),
    ("gorbel", "assets/mobs/Gorbel.png", (256,), 84),
)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def generate(root: Path) -> dict:
    root = root.resolve(strict=True)
    destination = root / "assets/home"
    destination.mkdir(parents=True, exist_ok=True)
    records = []
    for key, relative, widths, quality in SOURCES:
        source_path = root / relative
        source_bytes = source_path.read_bytes()
        source_hash = sha256(source_bytes)
        with Image.open(source_path) as original:
            original.load()
            rgba = original.convert("RGBA")
            record = {
                "key": key,
                "source": relative,
                "sourceSha256": source_hash,
                "sourceBytes": len(source_bytes),
                "sourceDimensions": list(rgba.size),
                "outputs": [],
            }
            # The council occupies the right side of the panorama. Keep the
            # source intact and record this crop instead of shrinking its void.
            if key == "guild":
                record["crop"] = [900, 0, rgba.width, rgba.height]
                rgba = rgba.crop(tuple(record["crop"]))
            record["displaySourceDimensions"] = list(rgba.size)
            for requested_width in widths:
                width = min(requested_width, rgba.width)
                height = max(1, round(rgba.height * width / rgba.width))
                resized = rgba.resize((width, height), Image.Resampling.LANCZOS)
                alpha = resized.getchannel("A").tobytes()
                output_path = destination / f"{key}-{width}.webp"
                resized.save(output_path, format="WEBP", quality=quality,
                             method=6, alpha_quality=100, exact=True)
                with Image.open(output_path) as decoded:
                    decoded.load()
                    decoded_alpha = decoded.convert("RGBA").getchannel("A").tobytes()
                    if decoded.size != (width, height) or decoded_alpha != alpha:
                        raise AssertionError(f"Dimensions or alpha changed while encoding {output_path}")
                output_bytes = output_path.read_bytes()
                record["outputs"].append({
                    "path": output_path.relative_to(root).as_posix(),
                    "sha256": sha256(output_bytes),
                    "bytes": len(output_bytes),
                    "dimensions": [width, height],
                    "quality": quality,
                    "alphaPreservedExactly": True,
                    "resizedAlphaSha256": sha256(alpha),
                    "decodedAlphaSha256": sha256(decoded_alpha),
                })
        if sha256(source_path.read_bytes()) != source_hash:
            raise AssertionError(f"Source unexpectedly changed: {relative}")
        records.append(record)

    manifest = {
        "version": 2,
        "generator": "tools/optimize-home-art.py",
        "processing": "Aspect-preserving Lanczos resize and WebP compression. The guild council has a recorded crop of its empty left margin. No recoloring, background removal or regenerated artwork.",
        "alpha": "WebP alpha is byte-identical to the resized source alpha. Resize changes dimensions; it does not threshold or repaint the silhouette.",
        "excluded": ["Hero artwork", "Original artwork", "All item PNG sprites"],
        "artwork": records,
        "sourceBytesTotal": sum(row["sourceBytes"] for row in records),
        "largestVariantBytesTotal": sum(max(output["bytes"] for output in row["outputs"]) for row in records),
        "allVariantBytesTotal": sum(output["bytes"] for row in records for output in row["outputs"]),
    }
    manifest_path = root / "docs/hybrid-mmorpg-2026-10-08/home-art-manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    arguments = parser.parse_args()
    result = generate(arguments.root)
    print(json.dumps({
        "sources": len(result["artwork"]),
        "sourceBytes": result["sourceBytesTotal"],
        "largestVariantsBytes": result["largestVariantBytesTotal"],
        "allVariantsBytes": result["allVariantBytesTotal"],
    }))
