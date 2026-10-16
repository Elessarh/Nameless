// Identity evidence is checked independently of gameplay facts and rendering.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {nativeAssetIdentity,nativeModelIdentityProof,modelProof} from './official-model-identity.mjs';
let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
const hash=n=>String(n).repeat(64),url=stem=>'https://saominecraft.com/item-models/m/'+stem+'.json';
const flat={v:1,tex:['native.png'],flat:1,el:[{a:[0,0,7.5],b:[16,16,8.5],sh:0,f:{n:[0,0,16,16,0],s:[0,0,16,16,0]}}]};
const flatThicker={...flat,el:[{...flat.el[0],a:[0,0,7.48],b:[16,16,8.52]}]};
const cube={v:1,tex:['native.png'],el:[{a:[0,0,0],b:[16,16,16],f:{n:[0,0,16,16,0],e:[0,0,16,16,0],u:[0,0,16,16,0]}}],d:{gui:{r:[30,225,0]}}};
const spriteIdentity=nativeAssetIdentity(flat,[hash('a')]);
check(spriteIdentity?.sha256===nativeAssetIdentity(flatThicker,[hash('a')])?.sha256,'Proven whole-texture sprites remain identical when only source Z thickness differs');
check(spriteIdentity?.sha256!==nativeAssetIdentity(flat,[hash('b')])?.sha256,'Different native PNG bytes cannot corroborate a sprite');
check(!nativeAssetIdentity(flat,[])&&!nativeAssetIdentity(flat,['not-a-sha']),'An identity requires one verified texture SHA per native texture');
check(!nativeAssetIdentity({...flat,el:[{...flat.el[0],f:{n:[NaN,0,16,16,0]}}]},[hash('a')]),'Unsupported native UVs cannot become identity evidence');
const cubeIdentity=nativeAssetIdentity(cube,[hash('a')]);
check(cubeIdentity?.sha256!==nativeAssetIdentity({...cube,d:{gui:{r:[30,220,0]}}},[hash('a')])?.sha256,'A different GUI pose requires review even when geometry and pixels agree');
check(cubeIdentity?.sha256!==nativeAssetIdentity({...cube,el:[{...cube.el[0],b:[16,15,16]}]},[hash('a')])?.sha256,'Different geometry cannot qualify through a shared atlas');
check(cubeIdentity?.sha256!==nativeAssetIdentity({...cube,el:[{...cube.el[0],f:{...cube.el[0].f,n:[0,0,8,16,0]}}]},[hash('a')])?.sha256,'A different UV crop cannot qualify through a shared atlas');
const index={models:{'pack:icon':'pack/generated/icon','global:item':'unrelated/global'},items:{},alias:{current:'global:item'},vanilla:{iron_leggings:{e:[[6703,'pack/item/icon']]}}};
const item={sourceKey:'armor:current',sourceId:'current',material:'iron_leggings',customModelData:6703,sourceImage:'https://api.saominecraft.com/uploads/items/pack/icon.png?v=2',sourceModel:{stem:'pack/item/icon',url:url('pack/item/icon')}};
const nativeCandidates=[{sourceModelUrl:url('pack/item/icon'),sourceModelSha256:hash('1'),textureHashes:[hash('a')],model:flat},{sourceModelUrl:url('pack/generated/icon'),sourceModelSha256:hash('2'),textureHashes:[hash('a')],model:flatThicker}];
const selected={sourceModelUrl:url('pack/item/icon'),sourceModelSha256:hash('1'),textureHashes:[hash('a')],nativeCandidates};
check(!modelProof(index,item).exact,'An exact typed override conflicting with other source associations requires corroboration');
const proof=nativeModelIdentityProof(index,item,selected);
check(proof.exact&&proof.evidence.some(e=>e.kind==='native-equivalent-qualified-image'),'Exact CMD plus a qualified image resolving to equivalent native pixels corroborates the typed model');
check(!nativeModelIdentityProof(index,item,{...selected,sourceModelUrl:url('pack/generated/icon'),sourceModelSha256:hash('2')}).exact,'The equivalent qualified-image candidate does not create a second competing eligible model');
check(!nativeModelIdentityProof(index,item,{...selected,sourceModelSha256:hash('3')}).exact,'The selected model proof is bound to its verified source bytes');
check(!nativeModelIdentityProof(index,item,{...selected,textureHashes:[hash('b')]}).exact,'The selected model proof is bound to its verified native texture bytes');
check(!nativeModelIdentityProof(index,item,{...selected,nativeCandidates:nativeCandidates.map((candidate,i)=>i?{...candidate,textureHashes:[hash('b')]}:candidate)}).exact,'A qualified image with different pixels leaves the conflict unresolved');
check(!nativeModelIdentityProof(index,item,{...selected,nativeCandidates:nativeCandidates.map((candidate,i)=>({...candidate,model:i?{...cube,d:{gui:{r:[30,220,0]}}}:cube}))}).exact,'Different authored GUI poses cannot pass the generic equivalence proof');
const directIndex={...index,models:{...index.models,'pack:icon':'pack/item/icon'}};
const direct=nativeModelIdentityProof(directIndex,item,{sourceModelUrl:url('pack/item/icon'),sourceModelSha256:hash('1'),textureHashes:[hash('a')]});
check(direct.exact&&direct.evidence.some(e=>e.kind==='exact-cmd-and-qualified-image-agree'),'A missing public PNG does not erase agreement between exact typed CMD and the qualified public image identity');
check(!nativeModelIdentityProof(directIndex,item,{sourceModelUrl:url('unrelated/global'),sourceModelSha256:hash('1'),textureHashes:[hash('a')]}).exact,'A bare alias never overrides two concordant typed and qualified associations');
check(!nativeModelIdentityProof(directIndex,{...item,customModelData:6704},{sourceModelUrl:url('pack/item/icon'),sourceModelSha256:hash('1'),textureHashes:[hash('a')]}).exact,'A nearby CMD range is not an exact typed association');

// Exercise the real cached public resources without networking or regeneration.
const manifest=JSON.parse(await fs.readFile(new URL('../data/official-item-previews.json',import.meta.url)));
const facts=JSON.parse(await fs.readFile(new URL('../data/official-items.json',import.meta.url)));
const resources=new Map(manifest.resources.map(record=>[record.url,record]));
const bytes=async record=>fs.readFile(new URL('..'+record.path,import.meta.url));
const publicIndex=JSON.parse(await bytes(resources.get(manifest.modelIndex.url)));
const sourceIds=['fallen_herald_boots','fallen_herald_chestplate','fallen_herald_leggins','fallen_reaper_boots','fallen_reaper_chestplate','fallen_reaper_leggins','fallen_warden_boots','fallen_warden_chestplate','fallen_warden_leggins','ingot_metal_enchanted','reaper_soul','scrap_metal_enchanted','scrap_soulmetal','RAIE','SARDINE'];
for(const sourceId of sourceIds){
    const fact=facts.items.find(item=>item.sourceId===sourceId),context=modelProof(publicIndex,fact),native=[];
    for(const model of context.candidates){const resource=resources.get(model.url);if(!resource)continue;const parsed=JSON.parse(await bytes(resource));native.push({sourceModelUrl:model.url,sourceModelSha256:resource.sha256,model:parsed,textureHashes:parsed.tex.map(texture=>resources.get('https://saominecraft.com/item-models/t/'+texture)?.sha256)});}
    const eligible=native.map(candidate=>nativeModelIdentityProof(publicIndex,fact,{...candidate,nativeCandidates:native})).filter(proof=>proof.exact);
    check(eligible.length===1,'Public identity has exactly one corroborated model: '+sourceId);
}

const reviewedCMD=['DAGUE_INTERMEDIAIRE','FRAGMENT_ORICHALQUE','BOUCLIER_POINTUE_BOIS','BOUCLIER_TOLBANA_SEMITANK'].map(sourceId=>{
    const fact=facts.items.find(item=>item.sourceId===sourceId),resource=resources.get(fact.sourceModel.url);
    return {fact,sourceModelUrl:resource.url,sourceModelSha256:resource.sha256};
});
for(const row of reviewedCMD){const model=JSON.parse(await bytes(resources.get(row.sourceModelUrl)));row.textureHashes=model.tex.map(texture=>resources.get('https://saominecraft.com/item-models/t/'+texture).sha256);}
reviewedCMD.push({fact:facts.items.find(item=>item.sourceId==='DAGUE_HEROIQUE'),sourceModelUrl:url('nerfs_weapons/item/daggers/dague_heraut'),sourceModelSha256:'656e94d7f29ae42757f7377b28ab6bb4f8c31113edc779a2f6654cc5e2eedac2',textureHashes:['88fa9bd395f0ef40af8e553cfd6a7cbce27780c5086ecdcdc090130d65f81065']});
const crossbowEvidence=JSON.parse(await fs.readFile(new URL('../docs/official-items-2026-10-15/crossbow-evidence.json',import.meta.url)));
const reviewedCrossbows=crossbowEvidence.records.map(row=>({fact:facts.items.find(item=>item.sourceKey===row.sourceKey),qualifiedKey:row.qualifiedKey,sourceModelUrl:row.modelUrl,sourceModelSha256:row.modelSha256,textureHashes:row.nativeTextures.map(texture=>texture.sha256)}));
for(const row of [...reviewedCMD,...reviewedCrossbows]){
    const proof=nativeModelIdentityProof(publicIndex,row.fact,row),label=row.fact.sourceKey;
    check(proof.exact&&proof.evidence.some(e=>e.kind==='reviewed-native-identity'),'The byte-pinned reviewed candidate is eligible: '+label);
    check(!nativeModelIdentityProof(publicIndex,row.fact,{...row,sourceModelSha256:hash('0')}).exact,'Changed reviewed geometry fails closed: '+label);
    for(const [i] of row.textureHashes.entries())check(!nativeModelIdentityProof(publicIndex,row.fact,{...row,textureHashes:row.textureHashes.map((value,n)=>n===i?hash('0'):value)}).exact,'Every reviewed texture is required at its exact source position: '+label+' texture '+i);
    check(!nativeModelIdentityProof(publicIndex,row.fact,{...row,textureHashes:[...row.textureHashes,hash('0')]}).exact,'Unreviewed additional native texture fails closed: '+label);
    for(const candidate of modelProof(publicIndex,row.fact).candidates.filter(candidate=>candidate.url!==row.sourceModelUrl))check(!nativeModelIdentityProof(publicIndex,row.fact,{...row,sourceModelUrl:candidate.url}).exact,'Alternative geometry cannot replace the reviewed candidate: '+label);
}
for(const row of reviewedCrossbows){
    const context=modelProof(publicIndex,row.fact);
    check(context.requiresCorroboration&&context.candidates.some(candidate=>candidate.url===row.sourceModelUrl),'A reviewed qualified registry key makes this exact candidate available despite the unrelated CMD range: '+row.fact.sourceKey);
    const withoutQualifiedKey={...publicIndex,items:{...publicIndex.items},models:{...publicIndex.models}};delete withoutQualifiedKey.items[row.qualifiedKey];delete withoutQualifiedKey.models[row.qualifiedKey];
    check(!nativeModelIdentityProof(withoutQualifiedKey,row.fact,row).exact,'An absent qualified registry key invalidates a range exception: '+row.fact.sourceKey);
}
const unreviewedRanges=facts.items.filter(item=>modelProof(publicIndex,item).reason==='nonexact-cmd-range');
check(unreviewedRanges.length===5&&unreviewedRanges.every(item=>modelProof(publicIndex,item).candidates.length===0),'The other five CMD range associations remain neutral, with no name-based candidate exception');
console.log('Official model identity: '+checks+' checks passed; exact typed overrides, qualified public images, byte-bound equivalence and conservative conflict rejection.');
