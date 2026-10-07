"""Build before/after contact sheets for every integrated catalogue image."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
import math

ROOT = Path(__file__).resolve().parent.parent
QA = ROOT / 'docs/item-assets-2026-10-07'
records = json.loads((QA / 'integration-manifest.json').read_text(encoding='utf-8'))['records']
font_path = Path('C:/Windows/Fonts/consola.ttf')
font = ImageFont.truetype(str(font_path), 16) if font_path.exists() else ImageFont.load_default()
heading_font = ImageFont.truetype(str(font_path), 23) if font_path.exists() else font


def preview(board, file, left, top, checker=False):
    image = Image.open(file).convert('RGBA')
    scale = min(160 / image.width, 160 / image.height)
    if scale >= 1:
        scale = min(2, math.floor(scale))
    width, height = max(1, round(image.width * scale)), max(1, round(image.height * scale))
    image = image.resize((width, height), Image.Resampling.NEAREST)
    tile = Image.new('RGB', (180, 180), (10, 15, 29))
    if checker:
        draw = ImageDraw.Draw(tile)
        for y in range(0, 180, 10):
            for x in range(0, 180, 10):
                draw.rectangle((x, y, x+9, y+9), fill=(72, 80, 95) if (x//10+y//10) % 2 else (38, 45, 58))
    tile.paste(image, ((180-width)//2, (180-height)//2), image)
    board.paste(tile, (left, top))


for sheet in range(math.ceil(len(records) / 16)):
    batch = records[sheet*16:(sheet+1)*16]
    height = 90 + math.ceil(len(batch)/4)*305
    for checker in [False, True]:
        board = Image.new('RGB', (1720, height), (5, 7, 13))
        draw = ImageDraw.Draw(board)
        draw.text((16, 13), 'NAMELESS | ITEMS | AVANT / APRES | ' + str(sheet+1), font=heading_font, fill=(228, 205, 151))
        draw.text((16, 48), 'Ancien fichier a gauche | Nouveau a droite | Apercus NEAREST | Sources et IDs conserves', font=font, fill=(170, 180, 197))
        for index, row in enumerate(batch):
            left, top = (index % 4)*430, 90+(index//4)*305
            draw.rectangle((left+5, top+3, left+421, top+295), outline=(50, 58, 73))
            draw.text((left+14, top+12), row['itemName'][:39], font=font, fill=(225, 230, 236))
            for side, key in [(0, 'before'), (1, 'after')]:
                x = left+16+side*205
                metrics = row[key]
                draw.text((x, top+37), ('Avant ' if side==0 else 'Apres ') + str(metrics['width'])+'x'+str(metrics['height']), font=font, fill=(170, 180, 197))
                preview(board, ROOT/(row['backupPath'] if side==0 else row['targetPath']), x, top+61, checker)
            action = {'archive-copy':'Archive intacte', 'reference-copy':'Source existante', 'alpha-cleanup':'Transparence nettoyee'}[row['action']]
            draw.text((left+14, top+248), row['itemId'], font=font, fill=(170, 180, 197))
            draw.text((left+14, top+274), action, font=font, fill=(136, 196, 166))
        suffix = '-checker' if checker else ''
        board.save(QA / ('comparison-'+str(sheet+1).zfill(2)+suffix+'.png'))
print('Built 7 before/after sheets and 7 transparency variants for 104 items.')
