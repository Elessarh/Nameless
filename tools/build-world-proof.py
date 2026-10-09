"""Review documents only: raw screenshot metadata and a comparison board."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

root=Path(__file__).resolve().parent.parent
report=root/'docs/world-of-aincrad-2026-10-09'
digest=lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
records=[]
for folder in ('baseline','screenshots'):
    for p in sorted((report/folder).glob('*.jpg')):
        with Image.open(p) as im:
            records.append({'file':p.relative_to(report).as_posix(),'dimensions':list(im.size),'bytes':p.stat().st_size,'sha256':digest(p)})
(report/'screenshot-manifest.json').write_text(json.dumps(records,indent=2)+'\n',encoding='utf-8')
assets=[]
for name,kind in [('assets/ui/world-stone.svg','Hand-drawn material tile'),('assets/ui/world-foreground.svg','Hand-drawn stepped stone foreground'),('assets/ui/world-canopy.svg','Hand-drawn voxel vegetation silhouette'),('assets/home/aincrad-minecraft-1920.webp','Preserved atmosphere illustration'),('assets/home/aincrad-minecraft-mobile.webp','Preserved mobile crop'),('assets/home/sao-guild-512.webp','Preserved historical guild illustration')]:
    p=root/name
    assets.append({'file':name,'usage':kind,'bytes':p.stat().st_size,'sha256':digest(p),'serverCapture':False})
(report/'asset-manifest.json').write_text(json.dumps(assets,indent=2)+'\n',encoding='utf-8')
performance={}
for version,filename in [('before','baseline/lighthouse-home.json'),('after','lighthouse-home.json')]:
    lh=json.loads((report/filename).read_text(encoding='utf-8'))
    performance[version]={'time':lh['fetchTime'],'scores':{k:round(v['score']*100) for k,v in lh['categories'].items()},'metrics':{k:lh['audits'][k]['numericValue'] for k in ('first-contentful-paint','largest-contentful-paint','total-blocking-time','cumulative-layout-shift','total-byte-weight')},'warnings':lh.get('runWarnings',[])}
(report/'performance-comparison.json').write_text(json.dumps(performance,indent=2)+'\n',encoding='utf-8')
board=Image.new('RGB',(1640,1160),'#030B12')
d=ImageDraw.Draw(board)
font=lambda size: ImageFont.truetype('C:/Windows/Fonts/arial.ttf',size)
d.text((24,18),'NAMELESS 2.0 — WORLD OF AINCRAD',font=font(28),fill='#DDD7CB')
d.text((24,57),'Même composition · matière, lumière, profondeur et section de guilde enrichies',font=font(19),fill='#94A3AB')
for x,label,filename in [(20,'Avant — accueil définitif','baseline/home-1920.jpg'),(830,'Après — World Atmosphere','screenshots/home-1920.jpg')]:
    d.text((x,103),label,font=font(23),fill='#D3BE91')
    with Image.open(report/filename) as im:
        preview=ImageOps.contain(im.convert('RGB'),(790,450),Image.Resampling.LANCZOS)
    board.paste(preview,(x+(790-preview.width)//2,141))
d.text((24,616),'Référence fournie : structure et densité, sans ses données fictives',font=font(22),fill='#D3BE91')
with Image.open(root/'docs/definitive-hybrid-2026-10-09/phase-0/reference-seven.png') as ref:
    preview=ImageOps.contain(ref.crop((10,2,620,569)).convert('RGB'),(560,480),Image.Resampling.LANCZOS)
board.paste(preview,(50,659))
d.text((658,656),'Transformations observables',font=font(24),fill='#DDD7CB')
for i,text in enumerate(['Fond de pierre discret et lumière turquoise','Scènes Carte / Forêt / Inventaire / Guilde','Brume, lumière et premier plan indépendants','Relief des commandes et marqueur de sélection','Décor de guilde avec foyer ambre','Potion horizontale sur mobile','Transitions et pause à tester dans le navigateur']):
    d.text((660,710+i*47),'• '+text,font=font(22),fill='#94A3AB')
board.save(report/'comparison-home.jpg',quality=92)
print(json.dumps({'screenshots':len(records),'assets':len(assets),'performance':performance}))
