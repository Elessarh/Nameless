"""Apply the reviewed archive mapping; preserve exact catalogue paths and backups.

Requires Pillow for image validation only. Original and candidate PNG bytes are
copied unchanged; this tool never resizes, repaints or generates an image.
"""
from pathlib import Path
from PIL import Image
import argparse
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parent.parent
QA = ROOT / 'docs/item-assets-2026-10-07'
STAGING = QA / 'source-archive'


def read_json(name):
    return json.loads((QA / name).read_text(encoding='utf-8'))


def sha(data):
    return hashlib.sha256(data).hexdigest()


def contained(file, parent):
    file = Path(file).resolve()
    if not file.is_relative_to(parent.resolve()):
        raise ValueError('Path outside intended directory: ' + str(file))
    return file


def info(file):
    raw = file.read_bytes()
    with Image.open(file) as image:
        image.load()
        if image.format != 'PNG':
            raise ValueError('Expected PNG: ' + str(file))
        rgba = image.convert('RGBA')
        alpha = rgba.getchannel('A').histogram()
        return {
            'sha256': sha(raw), 'bytes': len(raw),
            'width': image.width, 'height': image.height,
            'transparentPixels': alpha[0], 'partialAlphaPixels': sum(alpha[1:255]),
            'rgbaSha256': sha(rgba.tobytes()),
            'visibleBounds': rgba.getbbox(),
        }


def integrate(apply=False):
    proposal = read_json('mapping-proposed.json')
    catalogue = read_json('catalogue-before.json')
    details = {item['id']: (category, group['name'], item)
               for category, group in catalogue.items() for item in group['items']}
    auto = {row['itemId']: row for row in read_json('cleanup-candidates.json')['candidates']}
    manual = {row['itemId']: row for row in read_json('manual-cleanup-candidates.json')}
    manual.update({row['itemId']: row for row in read_json('hole-cleanup-candidates.json')['candidates']})
    late = next(row for row in read_json('cleanup-candidates.json')['lateComparisons']
                if row['itemId'] == 'lingot_cramoisi')
    records = []
    for row in proposal['mapping']:
        target = contained(ROOT / row['targetPath'], ROOT / 'assets/items')
        preferred = contained(STAGING / row['sourceArchiveEntry'], STAGING)
        if sha(preferred.read_bytes()) != row['sourceSha256']:
            raise ValueError('Archive source changed: ' + row['itemId'])
        selected = preferred
        action = 'archive-copy'
        edits = []
        reason = 'Preferred item_use_cleaned file, unchanged.'
        if row['itemId'] == 'lingot_cramoisi':
            selected = contained(late['alternativePath'], STAGING)
            if sha(selected.read_bytes()) != late['alternativeSha256']:
                raise ValueError('Reference source changed')
            action = 'reference-copy'
            reason = 'Existing late_cleaned 79x79 sprite replaces the 1080x1080 oversized variant; no recreated pixels.'
        elif row['itemId'] in auto or row['itemId'] in manual:
            cleanup = auto.get(row['itemId']) or manual[row['itemId']]
            if cleanup['sourceSha256'] != row['sourceSha256']:
                raise ValueError('Cleanup does not belong to this source')
            selected = contained(cleanup['candidatePath'] if Path(cleanup['candidatePath']).is_absolute()
                                 else ROOT / cleanup['candidatePath'], QA)
            with Image.open(preferred) as original, Image.open(selected) as candidate:
                if original.size != candidate.size or original.convert('RGB').tobytes() != candidate.convert('RGB').tobytes():
                    raise ValueError('Cleanup changed shape or colours')
                edits = cleanup['changes']
                expected = original.convert('RGBA')
                for edit in edits:
                    value = expected.getpixel((edit['x'], edit['y']))
                    if value[3] != edit['beforeAlpha'] or edit['afterAlpha'] != 0:
                        raise ValueError('Unexpected alpha edit')
                    expected.putpixel((edit['x'], edit['y']), (*value[:3], 0))
                if expected.tobytes() != candidate.convert('RGBA').tobytes():
                    raise ValueError('Unrecorded pixel modification')
            action = 'alpha-cleanup'
            reason = 'Visually reviewed UI border/background residue only; all RGB values and canvas dimensions preserved.'
        after = info(selected)
        if not (1 <= after['width'] <= 128 and 1 <= after['height'] <= 128
                and after['bytes'] <= 65536 and after['transparentPixels'] > 0):
            raise ValueError('Unexpected final image metrics: ' + row['itemId'])
        backup = QA / 'previous' / target.relative_to(ROOT / 'assets/items')
        if not backup.exists():
            if sha(target.read_bytes()) != row['currentFile']['sha256']:
                raise ValueError('Original unavailable; do not overwrite: ' + str(target))
            if apply:
                backup.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(target, backup)
        before_file = backup if backup.exists() else target
        before = info(before_file)
        if before['sha256'] != row['currentFile']['sha256']:
            raise ValueError('Backup differs from inspected original')
        if apply:
            shutil.copyfile(selected, target)
            if sha(target.read_bytes()) != after['sha256']:
                raise ValueError('Copy verification failed')
        category, category_name, item = details[row['itemId']]
        records.append({
            'itemId': row['itemId'], 'itemName': item['name'],
            'catalogueCategory': category, 'catalogueCategoryName': category_name,
            'rarity': item['rarity'], 'catalogueImageOriginal': item['image'],
            'targetPath': row['targetPath'],
            'preferredArchiveEntry': row['sourceArchiveEntry'],
            'selectedSourcePath': selected.relative_to(ROOT).as_posix(),
            'action': action, 'reason': reason, 'before': before, 'after': after,
            'pixelsChangedLocally': len(edits), 'alphaEdits': edits,
            'backupPath': before_file.relative_to(ROOT).as_posix(),
        })
    summary = {
        'catalogueImages': len(records),
        'filesReplaced': sum(r['before']['sha256'] != r['after']['sha256'] for r in records),
        'filesAlreadyIdentical': sum(r['before']['sha256'] == r['after']['sha256'] for r in records),
        'preferredCopiedUnchanged': sum(r['action'] == 'archive-copy' for r in records),
        'referenceCopiedUnchanged': sum(r['action'] == 'reference-copy' for r in records),
        'locallyRetouched': sum(r['action'] == 'alpha-cleanup' for r in records),
        'pixelsChangedLocally': sum(r['pixelsChangedLocally'] for r in records),
        'recreated': 0,
        'beforeBytes': sum(r['before']['bytes'] for r in records),
        'afterBytes': sum(r['after']['bytes'] for r in records),
    }
    manifest = {'schemaVersion': 1, 'date': '2026-10-07', 'archive': proposal['archive'],
                'applied': apply, 'summary': summary, 'records': records}
    if apply:
        (QA / 'integration-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Copy reviewed files and write the integration manifest.')
    integrate(parser.parse_args().apply)
