"""Compose review sheets from preserved assets and raw browser screenshots.

This only writes QA documents. It never changes served images or screenshots.
Run after taking the screenshots described in CAPTURE_PROTOCOL.md.
"""
import hashlib
import json
import textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

root = Path(__file__).resolve().parent.parent
report = root / 'docs/definitive-hybrid-2026-10-09'
font = lambda size: ImageFont.truetype('C:/Windows/Fonts/arial.ttf', size)
ink, muted, gold = '#DDD7CB', '#94A3AB', '#D3BE91'
inventory = json.loads((report/'phase-0/asset-inventory.json').read_text(encoding='utf-8'))
inspections = {
    'Logo Nameless': ('Fourni et validé par l’utilisateur ; SHA comparé à la source', 'Emblème de guilde validé', 'Net à taille de header', 'RGBA propre, petits détails fins', 'Conserver original et variantes 64/128 px'),
    'Ville Minecraft': ('Image fournie antérieurement ; lieu officiel inconnu', 'Blocs Minecraft identifiables', 'Nette, mais point focal central et vue aérienne plate', 'RGB opaque', 'Conserver comme repli ; recomposer le hero avec une autre source justifiée'),
    'Carte palier': ('Ressource cartographique déjà présente dans le projet', 'Terrain Minecraft réel utilisé par le module', 'Adaptée à la carte et au crop de navigation', 'RGBA ; 461 pixels semi-transparents au contour', 'Garder données et alpha ; crop de navigation enregistré'),
    'Illfang': ('Modèle du bestiaire existant', 'Véritable apparence du catalogue', 'Silhouette nette, arme et bouclier reconnaissables', 'Alpha antialiasé ; pointes proches des limites du canvas', 'Utiliser la vignette et du padding, sans reconstruire le modèle'),
    'Gorbel': ('Modèle du bestiaire existant', 'Slime couronné du catalogue', 'Silhouette lisible', 'Semi-transparence naturelle du slime, à conserver', 'Conserver original et vignette, ne pas seuiller l’alpha'),
    'Potion de Mana': ('Archive Items_Cleaned_FirstPass.zip, manifeste confirmé', 'Sprite de l’item réel', 'Pixels nets à taille native', '120 pixels semi-transparents conservés', 'PNG intact à 46×46 ; image-rendering pixelated'),
    'Gelée de Slime': ('Archive Items_Cleaned_FirstPass.zip, manifeste confirmé', 'Sprite de l’item réel', 'Pixels nets à taille native', 'Contour alpha net', 'PNG intact à 47×48 ; aucune conversion'),
    'Bâton du Shaman': ('Archive fournie ; nettoyage antérieur enregistré', 'Arme du catalogue réel', 'Pixels natifs préservés', '48 pixels de cadre rendus transparents antérieurement', 'Conserver le PNG final de 48×48, SHA conforme au manifeste'),
    'Scène de guilde': ('Illustration voxel historique du dépôt ; origine officielle inconnue', 'Personnages voxel cohérents, aucune identité réelle certifiée', 'Lecture correcte dans une bande de navigation', 'RGB opaque', 'Crop existant ; ne pas présenter comme un lieu ou événement officiel'),
    'Ancien hero': ('Ancienne ressource du dépôt', 'Fantasy sans blocs identifiables', 'Inadapté à la direction actuelle', 'RGB opaque', 'Exclure de l’accueil ; garder l’original restaurable'),
    'Panorama peint v2': ('Génération antérieure explicitement rejetée', 'Peinture fantasy, identité Minecraft insuffisante', 'Composition large mais style incorrect', 'RGB opaque', 'Historique seulement ; aucune remise en service'),
}
for asset in inventory:
    asset.update(dict(zip(('origin','minecraftCoherence','quality','edges','treatment'), inspections[asset['name']])))
(report/'phase-0/asset-inventory.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
hero = json.loads((report/'hero-manifest.json').read_text(encoding='utf-8'))
active = [inventory[0], {
    'name':'Panorama Minecraft', 'path':hero['source'], 'status':'A',
    'usage':'Hero desktop/mobile', 'note':'Création décorative ; pas une capture du serveur.'
}] + inventory[2:9]
active.insert(5, {
    'name':'Loup Blanc', 'path':hero['creatureThumbnail']['source'], 'status':'A',
    'usage':'Fiche creature:12', 'note':'Modèle réel intact ; vignette WebP à alpha conservé.'
})
sheet = Image.new('RGB', (1280, 1710), '#030B12')
draw = ImageDraw.Draw(sheet)
draw.text((28,20), 'NAMELESS — ASSETS DE L’ACCUEIL', font=font(28), fill=ink)
draw.text((28,58), 'Sources conservées · statut A/B · aucune réinvention des modèles ou objets', font=font(18), fill=muted)
for i, asset in enumerate(active):
    x, y = 24 + (i%2)*628, 100 + (i//2)*318
    draw.rectangle((x,y,x+604,y+298), fill='#07131B', outline='#35454A')
    with Image.open(root/asset['path']) as original:
        resampling = Image.Resampling.NEAREST if '/items/' in asset['path'] else Image.Resampling.LANCZOS
        preview = ImageOps.contain(original.convert('RGBA'), (558,154), method=resampling)
        sheet.paste(preview, (x+302-preview.width//2, y+14+(154-preview.height)//2), preview)
        dimensions = original.size
    draw.text((x+16,y+180), f"{asset['status']} · {asset['name']} · {dimensions[0]}×{dimensions[1]}", font=font(21), fill=gold)
    for j,line in enumerate(textwrap.wrap(asset['path'], 68)):
        draw.text((x+16,y+211+j*18), line, font=font(15), fill=muted)
    draw.text((x+16,y+254), asset['usage'], font=font(17), fill=ink)
    draw.text((x+16,y+276), asset['note'], font=font(14), fill=muted)
sheet.save(report/'phase-1/asset-control-after.jpg', quality=92)

# A comparison board is a reading aid, not a new screenshot or pixel-diff score.
board = Image.new('RGB', (1500,1580), '#030B12')
bd = ImageDraw.Draw(board)
bd.text((24,18), 'NAMELESS — RÉFÉRENCE / ÉTAT DE DÉPART / ACCUEIL CORRIGÉ', font=font(26), fill=ink)
panels = [
    ('Référence fournie — écran accueil (recadré)', report/'phase-0/reference-seven.png', (10,2,620,569)),
    ('Accueil avant cette passe — 8 octobre', report/'phase-0/screenshots/home-baseline-1920.jpg', None),
    ('Accueil corrigé — capture navigateur, viewport 1920 px', report/'phase-1/screenshots/home-1920.jpg', None),
]
for i,(label,src,crop) in enumerate(panels):
    y = 64 + i*500
    bd.text((24,y), label, font=font(22), fill=gold)
    with Image.open(src) as original:
        framed = original.crop(crop) if crop else original.copy()
        preview = ImageOps.contain(framed.convert('RGB'), (1452,450), Image.Resampling.LANCZOS)
    board.paste(preview, (24+(1452-preview.width)//2,y+36))
board.save(report/'phase-1/comparison-home.jpg', quality=92)

shots=[]
for phase in ('phase-0','phase-1'):
    for p in sorted((report/phase/'screenshots').glob('*.jpg')):
        with Image.open(p) as im:
            shots.append({'file':p.relative_to(report).as_posix(),'dimensions':list(im.size),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(report/'screenshot-manifest.json').write_text(json.dumps(shots,indent=2)+'\n', encoding='utf-8')
lh=json.loads((report/'phase-1/lighthouse-home.json').read_text(encoding='utf-8'))
summary={'fetchTime':lh['fetchTime'],'mode':'Local Lighthouse mobile simulation; not field Core Web Vitals', 'scores':{k:round(v['score']*100) for k,v in lh['categories'].items()},'metrics':{k:lh['audits'][k]['numericValue'] for k in ('first-contentful-paint','largest-contentful-paint','total-blocking-time','cumulative-layout-shift','total-byte-weight')},'warnings':lh.get('runWarnings',[])}
(report/'phase-1/performance-summary.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'assets':len(active),'screenshots':len(shots),'performance':summary}))
