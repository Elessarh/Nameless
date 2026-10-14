// Snapshot only the anonymous public SAO item wiki. Never executes remote JS.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';

export const WIKI = 'https://saominecraft.com/fr/wiki';
export const MODEL_INDEX = 'https://saominecraft.com/item-models/index.json';
const API_ORIGIN = 'https://api.saominecraft.com';
const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
const hash = value => createHash('sha256').update(value).digest('hex');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clean = value => String(value ?? '').replace(/\r\n/g, '\n').trim();
let nextDocumentAt = 0;

async function documentPacing() {
    const now = Date.now(), scheduled = Math.max(now,nextDocumentAt);
    nextDocumentAt = scheduled + 1000;
    if(scheduled>now)await new Promise(resolve=>setTimeout(resolve,scheduled-now));
}

function walk(value, visit) {
    if (!value || typeof value !== 'object') return;
    visit(value);
    for (const child of Object.values(value)) walk(child, visit);
}

// Flight payloads are JSON string arrays embedded by Next.js. Parsing their
// content as JSON is sufficient; no eval or server/client module is executed.
export function flightRecords(html) {
    const chunks = [];
    for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
        const script = match[1].trim();
        if (!script.startsWith('self.__next_f.push(') || !script.endsWith(')')) continue;
        const row = JSON.parse(script.slice('self.__next_f.push('.length, -1));
        if (row[0] === 1 && typeof row[1] === 'string') chunks.push(row[1]);
    }
    const records = [];
    for (const line of chunks.join('').split('\n')) {
        const content = line.slice(line.indexOf(':') + 1);
        if (!/^[\[{]/.test(content)) continue;
        try { records.push(JSON.parse(content)); } catch { /* Non-JSON Flight control records. */ }
    }
    return records;
}

export function publicImageUrl(value) {
    if (!value) return null;
    const url = new URL(value, WIKI);
    if (url.origin === new URL(WIKI).origin && url.pathname === '/_next/image') return publicImageUrl(url.searchParams.get('url'));
    if (url.origin !== API_ORIGIN || !url.pathname.startsWith('/uploads/items/') || url.username || url.password) return null;
    if (decodeURIComponent(url.pathname).split('/').some(part => part === '..')) return null;
    return url.href;
}

export function snapshotId(category, sourceId) {
    if (!/^[a-z0-9_]+$/.test(category) || typeof sourceId !== 'string' || !sourceId || sourceId.length > 200) throw new Error('Invalid public item identity');
    return 'official_' + category + '_' + hash(category + ':' + sourceId).slice(0, 16);
}

export function parsePage(html, sourceUrl, category = null) {
    const dom = new JSDOM(html, {url: sourceUrl});
    try {
        const doc = dom.window.document;
        const resultHeading = [...doc.querySelectorAll('p,h1,h2,h3,h4,span')].find(node => /^Résultats\s*\(\d+\)$/.test(clean(node.textContent)));
        if (!resultHeading) throw new Error('The public wiki result count is absent: ' + sourceUrl);
        const total = Number(resultHeading.textContent.match(/\((\d+)\)/)[1]);
        const records = flightRecords(html);
        let metadata = null;
        const models = [];
        for (const record of records) walk(record, value => {
            if (Array.isArray(value.categories) && Array.isArray(value.rarities) && value.current && value.labels?.filters) metadata ||= value;
            if (value.item && typeof value.item.id === 'string' && Object.hasOwn(value, 'fallback')) models.push(value);
        });
        if (!metadata) throw new Error('Public wiki category/rarity metadata is absent');
        const names = [...doc.querySelectorAll('p')].filter(node => node.classList.contains('truncate') && node.classList.contains('font-bold'));
        if (names.length !== models.length || names.length > 12 || total && !names.length) throw new Error('Public SSR cards and identities do not align');
        const items = names.map((nameNode, index) => {
            const model = models[index];
            const card = nameNode.parentElement?.parentElement?.parentElement;
            if (!card?.classList.contains('overflow-hidden')) throw new Error('Unrecognized public item card');
            const rarityLabel = clean(nameNode.parentElement.querySelector('span')?.textContent);
            const rarity = metadata.rarities.find(entry => entry.label === rarityLabel);
            if (!rarity) throw new Error('Unrecognized official rarity: ' + rarityLabel);
            const levelText = [...nameNode.parentElement.querySelectorAll('span')].map(node => clean(node.textContent)).find(text => /^Lv\.\s*\d+$/.test(text));
            const level = levelText ? Number(levelText.replace(/^Lv\.\s*/, '')) : null;
            const loreNode = [...card.children].find(node => node.tagName === 'P');
            const description = clean(loreNode?.textContent);
            const stats = [...card.querySelectorAll('div')].filter(node => node.classList.contains('justify-between')).map(node => {
                const spans = [...node.children].filter(child => child.tagName === 'SPAN');
                if (spans.length !== 2) throw new Error('Unrecognized public item identification');
                return {label: clean(spans[0].textContent), value: clean(spans[1].textContent)};
            });
            const sourceImage = publicImageUrl(card.querySelector('img')?.getAttribute('src'));
            const sourceId = model.item.id;
            const sourceKey = category ? category.slug + ':' + sourceId : null;
            return {id: category ? snapshotId(category.slug, sourceId) : null, sourceId, sourceKey,
                category: category ? {id: category.id, slug: category.slug, label: category.label} : null,
                type: category?.slug || null, name: clean(nameNode.textContent),
                rarity: {slug: rarity.slug, label: rarity.label, color: rarity.color || null}, level,
                description, lore: description ? description.split('\n') : [], stats,
                material: model.item.material || null, customModelData: model.item.cmd ?? null,
                modelKey: model.item.key || null, image: null, sourceImage, sourceUrl,
                imageStatus: sourceImage ? 'pending' : 'not-published'};
        });
        return {total, items, categories: metadata.categories, rarities: metadata.rarities,
            identifications: metadata.identifications || [], current: metadata.current};
    } finally { dom.window.close(); }
}

export function sniffImage(bytes) {
    if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return {extension:'png',width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
    if (bytes.length >= 12 && bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP') return {extension:'webp'};
    if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return {extension:'jpg'};
    return null;
}

// Resolve only associations published by the official viewer's registry. A
// generic vanilla texture is never invented for an unidentified custom item.
export function officialModel(index,item) {
    const candidates=[item.sourceId,item.modelKey].filter(value=>typeof value==='string'&&value.trim());
    let stem=null, resolution=null;
    for(const value of candidates){const key=value.trim().toLowerCase().replace(/^(ia|itemsadder):/,'');if(key.includes(':')&&(index.items?.[key]||index.models?.[key])){stem=index.items?.[key]||index.models?.[key];resolution='official-key';break;}}
    if(!stem)for(const value of candidates){const m=/^MMO:([^.]+)\.(.+)$/i.exec(value);const key=(m?m[2]:value.includes(':')?value.split(':').slice(1).join(':'):value).toLowerCase();const target=index.alias?.[key];if(target&&index.models?.[target]){stem=index.models[target];resolution='official-item-alias';break;}}
    if(!stem&&Number(item.customModelData)>0){const material=String(item.material||'').replace(/^minecraft:/i,'').toLowerCase();for(const [threshold,target] of index.vanilla?.[material]?.e||[])if(threshold<=Number(item.customModelData))stem=target;if(stem)resolution='official-material-cmd';}
    if(!stem)return null;
    if(typeof stem!=='string'||!/^[-a-z0-9_/.]+$/i.test(stem)||stem.split('/').some(part=>part==='..'||part===''))throw new Error('Unsafe public model path');
    return {stem,url:new URL('/item-models/m/'+stem.split('/').map(encodeURIComponent).join('/')+'.json',WIKI).href,resolution};
}

export function uniqueAssets(assets) {
    const files=new Map();
    for(const asset of assets){const existing=files.get(asset.path);if(existing){if(existing.sha256!==asset.sha256||existing.bytes!==asset.bytes)throw new Error('Conflicting item asset content');existing.sourceUrls.push(asset.sourceUrl);}else files.set(asset.path,{...asset,sourceUrls:[asset.sourceUrl]});}
    return [...files.values()].sort((a,b)=>a.path.localeCompare(b.path,'en'));
}

async function boundedGet(url, maximum) {
    const allowed = new URL(url);
    if (![new URL(WIKI).origin, API_ORIGIN].includes(allowed.origin)) throw new Error('Non-public source host');
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            if(maximum===MAX_DOCUMENT_BYTES)await documentPacing();
            const response = await fetch(url, {signal: AbortSignal.timeout(25000), redirect:'error', credentials:'omit', headers:{'User-Agent':'Nameless-public-wiki-snapshot/1.0'}});
            if (!response.ok) {
                if (response.status === 404 || response.status === 410) return {missing:true,status:response.status};
                throw new Error('HTTP ' + response.status + ': ' + url);
            }
            const declared = Number(response.headers.get('content-length'));
            if (declared > maximum) throw new Error('Oversized public source');
            const parts = []; let size = 0;
            for await (const part of response.body) {
                size += part.length;
                if (size > maximum) { await response.body.cancel().catch(()=>{}); throw new Error('Oversized public source'); }
                parts.push(part);
            }
            return {bytes:Buffer.concat(parts),status:response.status,date:response.headers.get('date'),lastModified:response.headers.get('last-modified')};
        } catch (error) {
            if (attempt === 2) throw error;
            await new Promise(resolve=>setTimeout(resolve, 500 * (attempt + 1)));
        }
    }
}

async function pool(list, limit, run) {
    let cursor = 0, failure = null;
    await Promise.all(Array.from({length:Math.min(limit,list.length)},async()=>{
        while(cursor<list.length&&!failure){try{await run(list[cursor++]);}catch(error){failure ||= error;}}
    }));
    if(failure)throw failure;
}

export function validateSnapshot(snapshot, expectedCount = snapshot.source.announcedCount) {
    if (snapshot.schemaVersion !== 1 || snapshot.items.length !== expectedCount) throw new Error('Official catalogue coverage mismatch');
    const ids = new Set(), keys = new Set();
    for (const item of snapshot.items) {
        if (ids.has(item.id) || keys.has(item.sourceKey)) throw new Error('Duplicate official item identity');
        ids.add(item.id); keys.add(item.sourceKey);
        if (item.id !== snapshotId(item.category.slug,item.sourceId) || item.sourceKey !== item.category.slug + ':' + item.sourceId || !item.name || !snapshot.categories.some(c=>c.slug===item.category.slug) || !snapshot.rarities.some(r=>r.slug===item.rarity.slug)) throw new Error('Incomplete public item identity');
        if (item.level !== null && (!Number.isFinite(item.level) || item.level < 0)) throw new Error('Invalid official level');
        if (!Array.isArray(item.stats) || item.stats.some(stat=>typeof stat.label!=='string'||typeof stat.value!=='string')) throw new Error('Invalid public item statistics');
        if (item.image && !/^\/assets\/items\/official\/[a-f0-9]{32}\.(png|webp|jpg)$/.test(item.image)) throw new Error('Unsafe snapshot image path');
    }
    return true;
}

async function atomicWrite(file, bytes) {
    const temporary = file + '.import-next';
    await fs.writeFile(temporary, bytes);
    await fs.rename(temporary, file);
}

export async function importOfficialItems({expectedCount,metadataOnly=false}={}) {
    const startedAt = new Date().toISOString();
    const responses = [], assets = [], missingImages = [];
    async function getPage(url, category, expectedTotal) {
        for(let attempt=0;attempt<6;attempt++){
            const response = await boundedGet(url,MAX_DOCUMENT_BYTES);
            if (!response.bytes) throw new Error('Public wiki page is unavailable');
            const parsed=parsePage(response.bytes.toString('utf8'),url,category);
            // The official server sometimes emits a temporary empty SSR result
            // under load. Retry that response, never compile an empty page as
            // evidence of removed items during an otherwise nonempty category.
            if(expectedTotal>0&&parsed.total===0&&attempt<5){console.log('Temporary empty official page; retrying '+url);await new Promise(resolve=>setTimeout(resolve,5000*(attempt+1)));continue;}
            responses.push({url,sha256:hash(response.bytes),bytes:response.bytes.length,httpDate:response.date});
            return parsed;
        }
    }
    const first = await getPage(WIKI);
    if(expectedCount!=null&&first.total!==expectedCount)throw new Error('The official result count changed: '+first.total);
    const categories=first.categories.filter(category=>category.visible!==false);
    if(!categories.length||categories.length>100)throw new Error('Invalid public category coverage');
    const items=[],categoryCounts={};
    let completed=0;
    await pool(categories,2,async category=>{
        const url=new URL(WIKI);url.searchParams.set('categories',category.slug);
        const initial=await getPage(url.href,category);
        if(!String(initial.current.categories||'').split(',').includes(category.slug))throw new Error('The official category filter was not applied');
        const records=initial.items;
        for(let page=2;page<=Math.ceil(initial.total/12);page++){
            url.searchParams.set('page',String(page));const next=await getPage(url.href,category,initial.total);
            if(next.total!==initial.total)throw new Error('Official category changed while paginating '+category.slug+' page '+page+': '+initial.total+' -> '+next.total+' ('+url.href+')');
            records.push(...next.items);
        }
        if(records.length!==initial.total||new Set(records.map(item=>item.sourceKey)).size!==initial.total)throw new Error('Official category pagination is incomplete: '+category.slug);
        categoryCounts[category.slug]=records.length;items.push(...records);
        if(++completed%5===0||completed===categories.length)console.log('Official categories '+completed+'/'+categories.length+': '+items.length+' public item records.');
    });
    items.sort((a,b)=>a.sourceKey.localeCompare(b.sourceKey,'en'));
    const snapshot={schemaVersion:1,source:{wikiUrl:WIKI,method:'anonymous Next.js SSR category pagination; JSON-only Flight identities and visible card metadata',announcedCount:first.total,categoryCounts,freshness:'Public wiki snapshot; no guarantee of real-time server synchronization'},fetchedAt:startedAt,categories,rarities:first.rarities,identifications:first.identifications,items};
    validateSnapshot(snapshot,first.total);
    const modelResponse=await boundedGet(MODEL_INDEX,MAX_DOCUMENT_BYTES);
    if(modelResponse.bytes){
        const index=JSON.parse(modelResponse.bytes.toString('utf8'));
        snapshot.source.modelsIndex={url:MODEL_INDEX,sha256:hash(modelResponse.bytes),httpDate:modelResponse.date,version:index.v,format:index.format};
        for(const item of items){item.sourceModel=officialModel(index,item);item.imageRole='official-wiki-fallback';}
    }
    if(metadataOnly)return snapshot;
    const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'nameless-official-items-'));
    try{
        const images=[...new Set(items.map(item=>item.sourceImage).filter(Boolean))];
        const byUrl=new Map();let downloaded=0;
        await pool(images,3,async url=>{
            const result=await boundedGet(url,MAX_IMAGE_BYTES);
            if(result.missing){byUrl.set(url,{image:null,imageStatus:'missing-http-'+result.status});missingImages.push({url,status:result.status});return;}
            const format=sniffImage(result.bytes);
            if(!format){byUrl.set(url,{image:null,imageStatus:'unsupported-public-format'});missingImages.push({url,status:'unsupported-format'});return;}
            const filename=hash(result.bytes).slice(0,32)+'.'+format.extension;
            const image='/assets/items/official/'+filename;
            await fs.writeFile(path.join(temporary,filename),result.bytes);
            byUrl.set(url,{image,imageStatus:'downloaded',imageSha256:hash(result.bytes),...(format.width?{imageWidth:format.width,imageHeight:format.height}:{})});
            assets.push({sourceUrl:url,path:image,bytes:result.bytes.length,sha256:hash(result.bytes),...format});
            if(++downloaded%100===0||downloaded===images.length)console.log('Official images '+downloaded+'/'+images.length+'.');
        });
        for(const item of items)if(item.sourceImage)Object.assign(item,byUrl.get(item.sourceImage));
        validateSnapshot(snapshot,first.total);
        snapshot.completedAt=new Date().toISOString();
        const snapshotBytes=Buffer.from(JSON.stringify(snapshot,null,2)+'\n');
        const manifest={schemaVersion:1,wikiUrl:WIKI,fetchedAt:startedAt,completedAt:snapshot.completedAt,noDeploy:true,noDatabaseWrite:true,remoteCodeExecuted:false,expectedCount:first.total,itemCount:items.length,categoryCounts,sourcePages:responses.sort((a,b)=>a.url.localeCompare(b.url,'en')),modelsIndex:snapshot.source.modelsIndex,snapshotSha256:hash(snapshotBytes),assets:uniqueAssets(assets),images:{role:'Official wiki fallback PNG/raster; not an invented 3D render',itemsWithImages:items.filter(item=>item.image).length,itemsWithPublicModel:items.filter(item=>item.sourceModel).length,itemsWithoutImages:items.filter(item=>!item.image).map(item=>({id:item.id,sourceKey:item.sourceKey,name:item.name,status:item.imageStatus,sourceModel:item.sourceModel})),missing:missingImages},limitations:['Only information currently exposed by the public wiki is included.','Identification values retain their official display text; no guessed numeric stats, loot sources or locations.','Public fallback item art is copied as supplied, and model URLs are documented; no generated art or old local server files.','Public wiki freshness is not a real-time game-server guarantee.']};
        const assetDirectory=path.join(root,'assets/items/official');
        await fs.mkdir(assetDirectory,{recursive:true});
        for(const filename of new Set(assets.map(asset=>path.basename(asset.path))))await atomicWrite(path.join(assetDirectory,filename),await fs.readFile(path.join(temporary,filename)));
        await atomicWrite(path.join(root,'data/official-items.json'),snapshotBytes);
        await atomicWrite(path.join(root,'data/official-items.manifest.json'),Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
        console.log(JSON.stringify({items:items.length,categories:categories.length,images:manifest.images.itemsWithImages,missing:manifest.images.itemsWithoutImages.length,snapshotSha256:manifest.snapshotSha256}));
        return snapshot;
    }finally{
        if(path.dirname(temporary)!==path.resolve(os.tmpdir())||!path.basename(temporary).startsWith('nameless-official-items-'))throw new Error('Unexpected snapshot staging directory');
        await fs.rm(temporary,{recursive:true,force:true});
    }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
    const args=process.argv.slice(2);const expect=args.find(arg=>arg.startsWith('--expect-count='));
    if(args.some(arg=>arg!=='--metadata-only'&&!/^--expect-count=\d+$/.test(arg)))throw new Error('Usage: node tools/import-official-items.mjs [--expect-count=1382] [--metadata-only]');
    await importOfficialItems({expectedCount:expect?Number(expect.split('=')[1]):undefined,metadataOnly:args.includes('--metadata-only')});
}
