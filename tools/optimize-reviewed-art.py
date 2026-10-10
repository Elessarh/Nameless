"""Encode reviewed generated scenery; never touch native map/item/model pixels."""
from pathlib import Path
from PIL import Image
import hashlib
import json
import argparse

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--series', choices=('art-v3', 'art-v4'), default='art-v3')
series = parser.parse_args().series
DEST = ROOT / 'assets' / series
PROMPTS = ('docs/sao-reference-art-2026-10-11/prompts.json' if series == 'art-v4'
           else 'docs/art-direction-2026-10-11/prompts.json')

def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

records = []
for key in ('aincrad', 'forest', 'guild', 'workshop'):
    source = DEST / f'{key}-source.png'
    with Image.open(source) as image:
        image = image.convert('RGB')
        record = {'key': key, 'origin': 'AI-generated illustration',
                  'source': {'path': source.relative_to(ROOT).as_posix(),
                             'sha256': sha(source), 'dimensions': list(image.size)},
                  'review': {'approved': True, 'checks': ['coherent modular architecture',
                            'readable silhouettes', 'no logo or text', 'consistent palette',
                            'separate from native game records']}, 'outputs': []}
        widths = (1672, 1280, 960) if key == 'aincrad' else (1280, 960, 640, 320)
        for width in widths:
            assert width <= image.width
            resized = image.resize((width, round(image.height * width / image.width)), Image.Resampling.LANCZOS)
            output = DEST / f'{key}-{width}.webp'
            resized.save(output, 'WEBP', quality=84, method=6)
            record['outputs'].append({'path': output.relative_to(ROOT).as_posix(),
                'dimensions': list(resized.size), 'sha256': sha(output),
                'bytes': output.stat().st_size, 'crop': None})
        if key == 'aincrad':
            # Keep the right-hand focal scene; desktop copy uses quiet space on the left.
            crop = (780, 0, 1672, 941)
            framed = image.crop(crop)
            resized = framed.resize((640, round(framed.height * 640 / framed.width)), Image.Resampling.LANCZOS)
            output = DEST / 'aincrad-mobile.webp'
            resized.save(output, 'WEBP', quality=84, method=6)
            record['outputs'].append({'path': output.relative_to(ROOT).as_posix(),
                'dimensions': list(resized.size), 'sha256': sha(output),
                'bytes': output.stat().st_size, 'crop': list(crop)})
        records.append(record)

manifest = {'version': 1, 'date': '2026-10-11', 'mode': 'built-in image_gen',
            'prompts': PROMPTS, 'usage': 'decorative environments only; native gameplay assets preserved',
            'artwork': records}
(DEST / 'asset-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Reviewed art: {len(records)} original sources, {sum(len(r["outputs"]) for r in records)} WebP variants; no upscaling.')
