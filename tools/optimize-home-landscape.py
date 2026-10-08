"""Produce responsive WebPs of the original panorama, without repainting."""
import hashlib
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
source = root / "docs/art-direction-2026-10-08/sources/aincrad-panorama-v2.png"
hash_bytes = lambda data: hashlib.sha256(data).hexdigest()
source_bytes = source.read_bytes()
outputs = []
with Image.open(source) as image:
    image.load()
    dimensions = image.size
    for width, quality in ((image.width, 83), (1600, 82), (960, 82)):
        height = round(width * image.height / image.width)
        resized = image.convert("RGB").resize((width, height), Image.Resampling.LANCZOS)
        destination = root / f"assets/illustrations/aincrad-panorama-v2-{width}.webp"
        resized.save(destination, "WEBP", quality=quality, method=6)
        data = destination.read_bytes()
        outputs.append({"path": destination.relative_to(root).as_posix(),
                        "dimensions": [width, height], "bytes": len(data),
                        "sha256": hash_bytes(data), "quality": quality})
    # A dedicated portrait-friendly framing spends mobile pixels on the
    # monument rather than downloading the invisible left terrace.
    crop = [980, 0, 1836, image.height]
    framed = image.crop(tuple(crop))
    mobile_width = 640
    mobile_height = round(mobile_width * framed.height / framed.width)
    mobile = framed.convert("RGB").resize((mobile_width, mobile_height), Image.Resampling.LANCZOS)
    destination = root / "assets/illustrations/aincrad-panorama-v2-mobile.webp"
    mobile.save(destination, "WEBP", quality=78, method=6)
    data = destination.read_bytes()
    outputs.append({"path": destination.relative_to(root).as_posix(),
                    "dimensions": [mobile_width, mobile_height], "bytes": len(data),
                    "sha256": hash_bytes(data), "quality": 78, "crop": crop})
manifest = {"source": source.relative_to(root).as_posix(),
            "production": "Original illustration generated with the built-in image_gen tool; see HERO_PROMPT.md and ART_BIBLE.md.",
            "sourceDimensions": list(dimensions), "sourceBytes": len(source_bytes),
            "sourceSha256": hash_bytes(source_bytes),
            "processing": "Aspect-preserving resize and WebP compression. Mobile uses the recorded crop of the original monument. No generated or repainted details.",
            "outputs": outputs}
destination = root / "docs/art-direction-2026-10-08/landscape-manifest.json"
destination.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"sourceBytes":len(source_bytes), "outputs": [{"path": o["path"], "bytes":o["bytes"]} for o in outputs]}))
