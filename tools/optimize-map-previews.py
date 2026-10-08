#!/usr/bin/env python3
"""Reproducible, derived map WebPs. Requires Pillow; never writes the originals."""
import argparse
import hashlib
import json
from pathlib import Path

import PIL
from PIL import Image, features


SOURCES = (
    (1, "assets/carte.webp", 1600),
    (2, "assets/Palier2-map.webp", 1400),
    (3, "assets/Palier3-map.webp", 1274),
)


def digest(filename):
    return hashlib.sha256(filename.read_bytes()).hexdigest()


def optimize(root):
    root = root.resolve()
    destination = root / "assets/map-preview"
    destination.mkdir(parents=True, exist_ok=True)
    manifest = {
        "version": 1,
        "tool": "tools/optimize-map-previews.py",
        "process": {
            "library": "Pillow",
            "pillowVersion": PIL.__version__,
            "webpVersion": features.version("webp"),
            "format": "WebP",
            "lossless": False,
            "resize": "LANCZOS",
            "method": 6,
            "desktopQuality": 82,
            "mobileQuality": 80,
            "detailQuality": 84,
            "description": "Resize and encode the existing map artwork only; no drawing or generated imagery.",
        },
        "floors": [],
    }
    for floor, relative_source, desktop_width in SOURCES:
        source = root / relative_source
        original_hash = digest(source)
        with Image.open(source) as opened:
            opened.load()
            width, height = opened.size
            original = opened.convert("RGBA" if "A" in opened.getbands() else "RGB")
        entry = {
            "floor": floor,
            "source": {"path": relative_source, "sha256": original_hash, "bytes": source.stat().st_size, "width": width, "height": height},
            "outputs": [],
        }
        for variant, target_width, quality in (("desktop", desktop_width, 82), ("mobile", 768, 80), ("detail", width, 84)):
            target_height = int(height * target_width / width + 0.5)
            image = original if (target_width, target_height) == original.size else original.resize((target_width, target_height), Image.Resampling.LANCZOS)
            output = destination / f"floor-{floor}-{variant}.webp"
            if output.resolve() == source.resolve():
                raise RuntimeError("Derived map output must differ from the original source")
            image.save(output, format="WEBP", quality=quality, method=6, lossless=False)
            with Image.open(output) as encoded:
                encoded.load()
                if encoded.size != (target_width, target_height):
                    raise RuntimeError(f"Invalid encoded dimensions: {output}")
            entry["outputs"].append({
                "variant": variant,
                "path": output.relative_to(root).as_posix(),
                "sha256": digest(output),
                "bytes": output.stat().st_size,
                "width": target_width,
                "height": target_height,
                "quality": quality,
                "method": 6,
                "lossless": False,
            })
        if digest(source) != original_hash:
            raise RuntimeError(f"Original map changed during optimization: {source}")
        manifest["floors"].append(entry)
        print(f"Floor {floor}: original {entry['source']['bytes']:,} bytes; " + ", ".join(f"{item['variant']} {item['width']}×{item['height']} {item['bytes']:,} bytes" for item in entry["outputs"]), flush=True)
    manifest_path = root / "docs/map-exploration-2026-10-08/preview-manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    optimize(parser.parse_args().root)
