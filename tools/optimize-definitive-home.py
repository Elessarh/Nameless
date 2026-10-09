"""Build responsive copies of the single Minecraft hero illustration.

No repainting or recoloring. Sources and framing are recorded for review.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
report = root / 'docs/definitive-hybrid-2026-10-09'
source = report / 'sources/hero-blocks-final.png'
digest = lambda data: hashlib.sha256(data).hexdigest()
outputs = []
with Image.open(source) as image:
    image.load()
    dimensions = image.size
    for width, quality in ((1920, 80), (1440, 79), (960, 78)):
        width = min(width, image.width)
        height = round(width * image.height / image.width)
        output = root / f'assets/home/aincrad-minecraft-{width}.webp'
        image.convert('RGB').resize((width, height), Image.Resampling.LANCZOS).save(output, 'WEBP', quality=quality, method=6)
        outputs.append({'path':output.relative_to(root).as_posix(), 'dimensions':[width,height], 'bytes':output.stat().st_size, 'sha256':digest(output.read_bytes()), 'quality':quality, 'crop':None})
    crop = [950, 0, 1930, 700]
    framed = image.crop(tuple(crop)).convert('RGB')
    width = 640
    height = round(width * framed.height / framed.width)
    output = root / 'assets/home/aincrad-minecraft-mobile.webp'
    framed.resize((width,height),Image.Resampling.LANCZOS).save(output,'WEBP',quality=79,method=6)
    outputs.append({'path':output.relative_to(root).as_posix(), 'dimensions':[width,height], 'bytes':output.stat().st_size, 'sha256':digest(output.read_bytes()), 'quality':79, 'crop':crop})
manifest = {'source':source.relative_to(root).as_posix(), 'sourceDimensions':list(dimensions), 'sourceSha256':digest(source.read_bytes()), 'origin':'Built-in image_gen; single Minecraft atmosphere interpretation, followed by framing repair. Not an official server capture or map.', 'prompt':'docs/definitive-hybrid-2026-10-09/HERO_PROMPT.md', 'processing':'Aspect-preserving resize, recorded mobile crop, WebP compression. No invented resolution.', 'outputs':outputs}

# A fifth genuine catalogue record fills the compact gallery. Keep the real
# voxel silhouette and the resized alpha; do not repaint any source details.
wolf_source = root / 'assets/mobs/Loup Sinistre Blanc.png'
with Image.open(wolf_source) as wolf:
    wolf.load()
    width = 256
    height = round(width * wolf.height / wolf.width)
    resized = wolf.convert('RGBA').resize((width,height),Image.Resampling.LANCZOS)
    alpha = resized.getchannel('A').tobytes()
    wolf_output = root / 'assets/home/white-wolf-256.webp'
    resized.save(wolf_output,'WEBP',quality=84,method=6,alpha_quality=100,exact=True)
    with Image.open(wolf_output) as decoded:
        decoded_alpha = decoded.convert('RGBA').getchannel('A').tobytes()
    if decoded_alpha != alpha:
        raise AssertionError('Wolf thumbnail alpha changed')
    manifest['creatureThumbnail'] = {'source':wolf_source.relative_to(root).as_posix(), 'sourceDimensions':list(wolf.size), 'sourceSha256':digest(wolf_source.read_bytes()), 'path':wolf_output.relative_to(root).as_posix(), 'dimensions':[width,height], 'bytes':wolf_output.stat().st_size, 'sha256':digest(wolf_output.read_bytes()), 'resizedAlphaSha256':digest(alpha), 'decodedAlphaSha256':digest(decoded_alpha)}
(report/'hero-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'outputs':[{'path':o['path'],'dimensions':o['dimensions'],'bytes':o['bytes']} for o in outputs]}))
