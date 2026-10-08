"""Make home variants from original SAO/Minecraft sources.

Only recorded rectangular crops, aspect-preserving Lanczos resize and WebP
compression are applied. Original artwork is never painted or recolored.

First run: --city-source /path/to/font-page-city.png
Later runs use the byte-identical city source archived beside the manifest.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image


REPORT_DIRECTORY = Path("docs/sao-minecraft-home-2026-10-08")
CITY_SOURCE = REPORT_DIRECTORY / "sources/city.png"
CITY_SHA256 = "0c3fd1a17d78ea130db320ea8a4e2d60813557e62848fa1050d4ce0a07c6c6e0"
RECIPES = (
    {
        "key": "city",
        "source": CITY_SOURCE.as_posix(),
        "outputs": (
            ("sao-city-1920.webp", 1920, 80, None),
            ("sao-city-1600.webp", 1600, 80, None),
            ("sao-city-960.webp", 960, 78, None),
            ("sao-city-mobile.webp", 640, 78, (580, 80, 1340, 720)),
        ),
    },
    {
        "key": "map",
        "source": "assets/carte-overview-mobile.webp",
        "outputs": (
            ("sao-map-512.webp", 512, 80, (160, 600, 720, 915)),
            ("sao-map-256.webp", 256, 80, (160, 600, 720, 915)),
        ),
    },
    {
        "key": "guild",
        "source": "assets/caroussel_ensemble.webp",
        "outputs": (
            ("sao-guild-512.webp", 512, 82, (900, 0, 2172, 724)),
            ("sao-guild-256.webp", 256, 82, (900, 0, 2172, 724)),
        ),
    },
)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def describe(path: Path, root: Path) -> dict:
    data = path.read_bytes()
    with Image.open(path) as artwork:
        artwork.load()
        return {
            "path": path.relative_to(root).as_posix(),
            "dimensions": list(artwork.size),
            "mode": artwork.mode,
            "hasAlpha": "A" in artwork.getbands(),
            "bytes": len(data),
            "sha256": sha256(data),
        }


def generate(root: Path, city_source: Path | None = None) -> dict:
    root = root.resolve(strict=True)
    archived_city = root / CITY_SOURCE
    supplied_city = (city_source or archived_city).resolve(strict=True)
    if sha256(supplied_city.read_bytes()) != CITY_SHA256:
        raise ValueError("The city input differs from the inspected original source.")
    archived_city.parent.mkdir(parents=True, exist_ok=True)
    if supplied_city != archived_city:
        shutil.copyfile(supplied_city, archived_city)
    if sha256(archived_city.read_bytes()) != CITY_SHA256:
        raise AssertionError("The archived city source is not byte-identical.")

    destination = root / "assets/home"
    destination.mkdir(parents=True, exist_ok=True)
    records = []
    for recipe in RECIPES:
        source_path = root / recipe["source"]
        source_metadata = describe(source_path, root)
        record = {"key": recipe["key"], "source": source_metadata, "outputs": []}
        with Image.open(source_path) as original:
            original.load()
            source = original.convert("RGBA" if source_metadata["hasAlpha"] else "RGB")
            for name, requested_width, quality, crop in recipe["outputs"]:
                if crop and not (0 <= crop[0] < crop[2] <= source.width
                                 and 0 <= crop[1] < crop[3] <= source.height):
                    raise ValueError(f"Crop lies outside {source_path}: {crop}")
                framed = source.crop(crop) if crop else source
                width = min(requested_width, framed.width)
                height = max(1, round(framed.height * width / framed.width))
                resized = framed.resize((width, height), Image.Resampling.LANCZOS)
                alpha = resized.getchannel("A").tobytes() if source_metadata["hasAlpha"] else None
                output_path = destination / name
                resized.save(output_path, format="WEBP", quality=quality,
                             method=6, alpha_quality=100, exact=True)
                output = describe(output_path, root)
                if output["dimensions"] != [width, height]:
                    raise AssertionError(f"Wrong encoded dimensions: {output_path}")
                output.update({
                    "quality": quality,
                    "crop": list(crop) if crop else None,
                    "croppedSourceDimensions": list(framed.size),
                })
                if alpha is not None:
                    with Image.open(output_path) as decoded:
                        decoded_alpha = decoded.convert("RGBA").getchannel("A").tobytes()
                    if decoded_alpha != alpha:
                        raise AssertionError(f"Alpha changed in {output_path}")
                    output.update({
                        "alphaPreservedExactly": True,
                        "resizedAlphaSha256": sha256(alpha),
                        "decodedAlphaSha256": sha256(decoded_alpha),
                    })
                record["outputs"].append(output)
        if sha256(source_path.read_bytes()) != source_metadata["sha256"]:
            raise AssertionError(f"Original source changed: {source_path}")
        records.append(record)

    # Reuse the already validated portrait instead of making an identical file.
    portrait_path = root / "assets/home/illfang-256.webp"
    reused = describe(portrait_path, root)
    if reused["dimensions"] != [256, 231] or not reused["hasAlpha"]:
        raise AssertionError("The existing Illfang portrait is not the expected alpha variant.")
    reused.update({
        "key": "illfang",
        "source": "assets/mobs/illfang.png",
        "sourceManifest": "docs/hybrid-mmorpg-2026-10-08/home-art-manifest.json",
        "processing": "Reused unchanged; no duplicate generated.",
    })

    manifest = {
        "version": 1,
        "date": "2026-10-08",
        "generator": "tools/optimize-sao-home.py",
        "processing": "Recorded crop, aspect-preserving Lanczos resize, WebP compression. No generated illustration, repainting, recoloring, invented map markers or semantic edits.",
        "citySourcePreservedExactly": True,
        "artwork": records,
        "reused": [reused],
        "sourceBytesTotal": sum(row["source"]["bytes"] for row in records),
        "allVariantBytesTotal": sum(output["bytes"] for row in records for output in row["outputs"]),
    }
    manifest_path = root / REPORT_DIRECTORY / "asset-manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--city-source", type=Path)
    arguments = parser.parse_args()
    result = generate(arguments.root, arguments.city_source)
    print(json.dumps({
        "manifest": (REPORT_DIRECTORY / "asset-manifest.json").as_posix(),
        "sourceBytes": result["sourceBytesTotal"],
        "variantBytes": result["allVariantBytesTotal"],
        "outputs": [output for row in result["artwork"] for output in row["outputs"]],
    }, ensure_ascii=False, indent=2))
