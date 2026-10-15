// Exact current public item-model associations only; raw snapshots stay intact.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {MODEL_INDEX,sniffImage} from './import-official-items.mjs';
import {renderNativeSvg,validateModel} from './official-preview-svg.mjs';
import {modelProof,nativeModelIdentityProof} from './official-model-identity.mjs';
export {modelProof} from './official-model-identity.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const BASE='https://saominecraft.com';
const ASSET='/assets/items/official/previews/';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const SAMPLE_IDS=['AMULETTE_AMETHYSTE','DOUBLE_HACHE_FER_P1','EPEE_ENTRAINEMENT','CASQUE_ABEILLE_ARCHER'];

function localPath(relative){
    if(typeof relative!=='string'||!relative.startsWith(ASSET)||relative.includes('..')||relative.includes('\\'))throw new Error('Unsafe preview cache path');
    const file=path.resolve(root,'.'+relative),base=path.resolve(root,'.'+ASSET);if(!file.startsWith(base+path.sep))throw new Error('Unsafe preview cache path');return file;
}
export function allowedResource(url){
    const parsed=new URL(url),decoded=decodeURIComponent(parsed.pathname);
    if(parsed.origin!==BASE||parsed.username||parsed.password||parsed.search||parsed.hash||decoded.split('/').some(p=>p==='..'))return false;
    return decoded==='/item-models/index.json'||/^\/item-models\/m\/[-a-zA-Z0-9_/]+\.json$/.test(decoded)||/^\/item-models\/t\/[-a-zA-Z0-9_/]+\.png$/.test(decoded);
}
const activeWrites=new Map();
export function atomicWrite(file,bytes){
    const digest=sha(bytes),prior=activeWrites.get(file);
    if(prior)return prior.digest===digest?prior.promise:prior.promise.then(()=>atomicWrite(file,bytes));
    const promise=(async()=>{
        const temporary=file+'.'+randomUUID()+'.preview-next';
        await fs.mkdir(path.dirname(file),{recursive:true});
        try{await fs.writeFile(temporary,bytes);await fs.rename(temporary,file);}
        finally{await fs.unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
    })();
    activeWrites.set(file,{digest,promise});
    promise.finally(()=>{if(activeWrites.get(file)?.promise===promise)activeWrites.delete(file);}).catch(()=>{});
    return promise;
}
export function snapshotResourceCache(previous,snapshotSha256,indexSha256){
    if(!previous||previous.snapshotSha256!==snapshotSha256||previous.modelIndex?.sha256!==indexSha256)return new Map();
    return new Map((previous.resources||[]).map(resource=>[resource.url,resource]));
}
export function verifyIndexHash(actual,expected){
    if(typeof expected!=='string'||!/^[0-9a-f]{64}$/.test(expected)||actual!==expected)throw new Error('Official model index changed; import a fresh official item snapshot before generating previews');
}
async function pool(list,limit,run){let cursor=0,failure=null;await Promise.all(Array.from({length:Math.min(limit,list.length)},async()=>{while(cursor<list.length&&!failure){try{await run(list[cursor++]);}catch(error){failure ||= error;}}}));if(failure)throw failure;}

export async function buildPreviews({sample=false,refresh=false}={}){
    const bytes=await fs.readFile(path.join(root,'data/official-items.json')),facts=JSON.parse(bytes),snapshotSha256=sha(bytes);
    let previous=null;try{previous=JSON.parse(await fs.readFile(path.join(root,'data/official-item-previews.json'),'utf8'));}catch{}
    const expectedIndexSha256=facts.source?.modelsIndex?.sha256;
    const cache=snapshotResourceCache(previous,snapshotSha256,expectedIndexSha256),inflight=new Map(),resources=new Map();
    let nextAt=0;
    async function resource(url,kind){
        if(!allowedResource(url))throw new Error('unsupported-public-source-url');
        if(inflight.has(url))return inflight.get(url);
        const promise=(async()=>{
            const prior=cache.get(url);
            if(prior&&!refresh){try{const cached=await fs.readFile(localPath(prior.path));if(cached.length===prior.bytes&&sha(cached)===prior.sha256){resources.set(url,prior);return {bytes:cached,record:prior};}}catch{}}
            for(let attempt=0;attempt<3;attempt++){
                try{
                    const scheduled=Math.max(Date.now(),nextAt);nextAt=scheduled+180;if(scheduled>Date.now())await new Promise(r=>setTimeout(r,scheduled-Date.now()));
                    const response=await fetch(url,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});
                    if(response.status===404||response.status===410)throw new Error('missing-public-'+kind);
                    if(!response.ok)throw new Error('source-http-'+response.status);
                    const parts=[];let size=0;const maximum=kind==='index'?4000000:kind==='model'?2000000:4000000;
                    for await(const part of response.body){size+=part.length;if(size>maximum)throw new Error('unsupported-source-budget');parts.push(part);}
                    const bytes=Buffer.concat(parts),digest=sha(bytes);
                    const relative=ASSET+'source/'+(kind==='texture'?'textures/':'models/')+digest+(kind==='texture'?'.png':'.json');
                    const record={url,path:relative,sha256:digest,bytes:bytes.length,fetchedAt:new Date().toISOString(),kind};
                    if(kind==='texture'){const format=sniffImage(bytes);if(format?.extension!=='png'||format.width<1||format.height<1||format.width>1024||format.height>1024)throw new Error('unsupported-native-texture');Object.assign(record,{width:format.width,height:format.height});}
                    else JSON.parse(bytes.toString('utf8'));
                    await atomicWrite(localPath(relative),bytes);resources.set(url,record);return {bytes,record};
                }catch(error){if(/^(missing|unsupported)/.test(error.message)||attempt===2)throw error;await new Promise(r=>setTimeout(r,500*(attempt+1)));}
            }
        })();inflight.set(url,promise);return promise;
    }
    const indexResponse=await resource(MODEL_INDEX,'index');verifyIndexHash(indexResponse.record.sha256,expectedIndexSha256);
    const index=JSON.parse(indexResponse.bytes);
    const selected=sample?facts.items.filter(item=>SAMPLE_IDS.includes(item.sourceId)):facts.items;
    if(sample&&selected.length!==4)throw new Error('Missing required native-preview sample');
    const records=new Map(facts.items.map(item=>{
        const proof=modelProof(index,item);
        const status=!item.sourceModel?'unavailable-model':!proof.exact&&!proof.requiresCorroboration?'uncertain-model-reference':'pending';
        return [item.id,{officialId:item.id,name:item.name,status,image:null,sha256:null,sourceModelUrl:item.sourceModel?.url||null,source2DVerified:false,nativeFlatVerified:false,reason:status==='pending'?null:proof.reason||'no-public-model',association:proof}];
    }));
    let done=0;
    const rendered=new Map();
    await pool(selected,2,async item=>{
        const record=records.get(item.id);if(record.status!=='pending')return;
        try{
            const context=record.association,eligible=[];let firstFailure=null;
            for(const candidate of context.requiresCorroboration?context.candidates:[context.model]){
                try{
                    const original=await resource(candidate.url,'model'),model=JSON.parse(original.bytes);validateModel(model);
                    const textures=await Promise.all(model.tex.map(name=>resource(BASE+'/item-models/t/'+name.split('/').map(encodeURIComponent).join('/'),'texture')));
                    const identity=nativeModelIdentityProof(index,item,{sourceModelUrl:candidate.url,sourceModelSha256:original.record.sha256,textureHashes:textures.map(texture=>texture.record.sha256)});
                    if(identity.exact)eligible.push({original,model,textures,identity});
                    if(!context.requiresCorroboration&&eligible.length)break;
                }catch(error){if(error.code)throw error;firstFailure ||= error;}
            }
            if(!eligible.length){if(!context.requiresCorroboration&&firstFailure)throw firstFailure;record.status='uncertain-model-reference';record.reason='conflicting-model-without-independent-corroboration';return;}
            const distinct=[...new Map(eligible.map(result=>[result.identity.model.stem,result])).values()];
            const reviewed=distinct.filter(result=>result.identity.evidence.some(proof=>proof.kind==='reviewed-native-identity'));
            if(distinct.length>1&&!reviewed.length){record.status='uncertain-model-reference';record.reason='multiple-corroborated-models';return;}
            const {original,model,textures,identity}=reviewed[0]||distinct[0];
            record.association=identity;record.sourceModelUrl=identity.model.url;record.sourceModelSha256=original.record.sha256;record.sourceModelPath=original.record.path;
            record.textures=textures.map(texture=>texture.record);
            const key=sha(Buffer.from(JSON.stringify({model:original.record.sha256,textures:textures.map(t=>t.record.sha256),renderer:1})));
            let preview=rendered.get(key);if(!preview){preview=renderNativeSvg(model,textures.map(t=>({bytes:t.bytes,width:t.record.width,height:t.record.height})));rendered.set(key,preview);}
            const svgBytes=Buffer.from(preview.svg),image=ASSET+sha(svgBytes)+'.svg';await atomicWrite(localPath(image),svgBytes);
            Object.assign(record,{status:preview.status,image,sha256:sha(svgBytes),bytes:svgBytes.length,geometry:preview.geometry,nativeFlatVerified:preview.nativeFlatVerified,source2DVerified:preview.nativeFlatVerified&&item.imageSha256===textures[0].record.sha256});
        }catch(error){if(error.code)throw error;record.status=/missing-public-texture/.test(error.message)?'missing-source-texture':/missing-public-model/.test(error.message)?'unavailable-model':'unsupported-model';record.reason=error.message;}
        if(++done%50===0||sample)console.log('Native previews '+done+'/'+selected.length+': '+item.sourceId+' '+record.status);
    });
    if(sha(await fs.readFile(path.join(root,'data/official-items.json')))!==snapshotSha256)throw new Error('Official snapshot changed during native preview generation');
    const counts={};for(const record of records.values())counts[record.status]=(counts[record.status]||0)+1;
    const manifest={schemaVersion:1,rendererVersion:1,snapshotSha256,partial:sample,createdAt:new Date().toISOString(),noDeploy:true,noAI:true,sourceGeometryModified:false,modelIndex:{url:MODEL_INDEX,sha256:indexResponse.record.sha256},renderMethod:'Verified flat texture or native cuboids, original UV and GUI transforms, orthographic projection, back-face culling, BSP painter depth, unchanged embedded PNG alpha',counts,records:[...records.values()],resources:[...resources.values()],limits:{elements:384,fragments:6000,svgBytes:750000},limitations:['Correspondences selected only by a nonexact CMD range remain neutral.','Unsupported native geometry, UVs, texture format or preview budget remains neutral.','Only the current public models needed by these 1382 facts are requested; raw facts and PNG snapshot are immutable.']};
    await atomicWrite(path.join(root,'data/official-item-previews.json'),Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
    console.log(JSON.stringify({partial:sample,counts,resources:resources.size}));return manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
    const args=process.argv.slice(2);if(args.some(arg=>!['--sample','--refresh'].includes(arg)))throw new Error('Usage: node tools/build-official-item-previews.mjs [--sample] [--refresh]');await buildPreviews({sample:args.includes('--sample'),refresh:args.includes('--refresh')});
}
