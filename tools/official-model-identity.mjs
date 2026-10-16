// Identity corroboration is separate from immutable public gameplay facts.
import {officialModel,officialModelCandidates,publishedImageModel,modelReference} from './import-official-items.mjs';
import {createHash} from 'node:crypto';
import {validateModel,wholeFlatTexture} from './official-preview-svg.mjs';
const REVIEWED_CANDIDATES=new Map([
    ['dungeon_key:key_sanctuary_of_xalzirith','elitecreatures:knight_assortment/key'],
    ['crossbow:ARBALETE_AMOUR_P3','lovestruck_em:crossbow_lovestruck_em'],
    ['crossbow:ARBALETE_HALLOWEEN_P3','plny_halloween_set:plny_halloween_crossbow'],
    ['crossbow:ARBALETE_NOEL_P3','plny_christmas_2025_set:plny_christmas_2025_set_crossbow']
]);
const REVIEWED_IDENTITIES=new Map([['amulet:AMULETTE_AMETHYSTE',{
    stem:'nerfs/item/ia_auto/amuletteamethyste',
    modelSha256:'92b8c9ad376ba030f61a2d50dc3e71175a602708c5419d0b6ae0cda6c0daedc1',
    textureSha256:'a0f5d3ba59efd9c9df4d45b6596c9c7bef8e05fa7006bfeb22c97ec1560e932d',
    proof:'docs/official-items-2026-10-14/native-samples.png'
}],['dagger:DAGUE_INTERMEDIAIRE',{
    stem:'nerfs_weapons/item/daggers/dague_entrainement',
    modelSha256:'1d45e18efa2cce38f8a170c973ce1653a3024decb0b368efe0453c3262411d87',
    textureSha256s:['66800bacbccd39630f3c3113d6baa702cb1d168dddc981e84fe5fddd700ec752'],
    proof:'docs/official-items-2026-10-15/reviewed-identities.png'
}],['material:FRAGMENT_ORICHALQUE',{
    stem:'crystal_pack/item/ia_auto/2d_medium_amber_bud',
    modelSha256:'aa681b778085ad5b7afb91aa9b77e0d4b8de7332cec7d2327de972b25db41f3f',
    textureSha256s:['2a5ffbabec14c24b94cfb107a5f16964d134598d6c13ffadcdf08b5eb8fd8358'],
    proof:'docs/official-items-2026-10-15/reviewed-identities.png'
}],['dagger:DAGUE_HEROIQUE',{
    stem:'nerfs_weapons/item/daggers/dague_heraut',
    modelSha256:'656e94d7f29ae42757f7377b28ab6bb4f8c31113edc779a2f6654cc5e2eedac2',
    textureSha256s:['88fa9bd395f0ef40af8e553cfd6a7cbce27780c5086ecdcdc090130d65f81065'],
    proof:'docs/official-items-2026-10-15/herald-dagger-reviewed.png'
}],['shield:BOUCLIER_POINTUE_BOIS',{
    stem:'elitecreatures/goblin_assortment/wooden_shield',
    modelSha256:'cc3ff63eaccbae3f1a072037d1971f1dfe8bc1f9b70ab21a4a8a02f59bd513ca',
    textureSha256s:['d87db26062f8133dbc745256611c0c242242e6c2eac2f721bf9b5659e54c7551'],
    proof:'docs/official-items-2026-10-15/reviewed-identities.png'
}],['shield:BOUCLIER_TOLBANA_SEMITANK',{
    stem:'elitecreatures/mage_assortment/shield',
    modelSha256:'32f40906cfbbbc861ec72c4167bcbe98951e2c741f529de3c41cf4b1d5fed18a',
    textureSha256s:['362c4b2f178a3a8bd619cb6ab9df9731fbc6bfecd67589ef3313b3b4b7298130','eba5fc5b8cd2988881822874ffb1d74c9fefe50fef0fd5c6b2d11cdfaf639676'],
    proof:'docs/official-items-2026-10-15/reviewed-identities.png'
}],['crossbow:ARBALETE_AMOUR_P3',{
    stem:'lovestruck_em/item/weapons/crossbow_lovestruck_em',
    modelSha256:'a9837b300e9572bb5182b0e9fe5d2a62ff263fa0e217ece608eaa07e8d25035a',
    textureSha256s:['0ea55c77d3a5df0281c0b2116bda616277e27d65892c7b5e1b02f996c516865d','1abce42dcca3ac575d0b1143c66f2d1be4bb05f93b6b43a0b32435bb8e9d6e7f'],
    proof:'docs/official-items-2026-10-15/crossbows-reviewed.png'
}],['crossbow:ARBALETE_HALLOWEEN_P3',{
    stem:'plny_halloween_set/crossbow',
    modelSha256:'eba6600d46f08db210a2e41d57db68010f345d58370f49439207cf8857d234a2',
    textureSha256s:['23696a492fc693b980143320828ad2978da81c217c24f09f7a81ff9b57418c60','e983f427d4a440fb4892fa80f25f0926e6bae46bccb31bdb6638ff50c4745c94'],
    proof:'docs/official-items-2026-10-15/crossbows-reviewed.png'
}],['crossbow:ARBALETE_NOEL_P3',{
    stem:'plny_christmas_2025_set/crossbow',
    modelSha256:'292d3e8fdd197cacb06093fe905ad5a684c90ab716609224641c346886982883',
    textureSha256s:['a4c4cb1213719640df3ba5d2886e90a8e6091c7f095b8810c64255e3d372379f','431486217e7392b8b9839b06f0b675fb5f8d29fb68e90fb73f70544a472cb753','96328ebff38d5170741253399694d3ccfbcb193c82db4d30901cfb269ed79ee2'],
    proof:'docs/official-items-2026-10-15/crossbows-reviewed.png'
}]]);

function reviewedCandidateStem(index,sourceKey){
    const key=REVIEWED_CANDIDATES.get(sourceKey);
    return key&&(index.items?.[key]||index.models?.[key]);
}

export function modelProof(index,item){
    const primary=officialModel(index,item),models=officialModelCandidates(index,item),image=publishedImageModel(index,item);
    if(!primary)return {exact:false,reason:'no-public-model',candidates:[]};
    const material=models.find(model=>model.exactCMD),alias=models.find(model=>model.resolution==='official-item-alias');
    const reviewedKey=REVIEWED_CANDIDATES.get(item.sourceKey),reviewedStem=reviewedCandidateStem(index,item.sourceKey);
    const nonexact=primary.resolution==='official-material-cmd'&&!material;
    if(nonexact&&!reviewedStem)return {exact:false,reason:'nonexact-cmd-range',model:primary,candidates:[]};
    const conflicts=[];
    if(item.sourceModel?.url&&item.sourceModel.url!==primary.url)conflicts.push({kind:'snapshot-selected-model-versus-current-primary',selected:item.sourceModel.url,primary:primary.url});
    if(material&&alias&&material.stem!==alias.stem)conflicts.push({kind:'global-alias-versus-exact-cmd',alias:alias.stem,exactCMD:material.stem});
    if(image&&image.stem!==(item.sourceModel?.stem||primary.stem))conflicts.push({kind:'qualified-image-versus-selected-model',image:image.stem,selected:item.sourceModel?.stem||primary.stem});
    if(reviewedStem&&reviewedStem!==primary.stem)conflicts.push({kind:'reviewed-qualified-image-candidate',candidate:reviewedStem,selected:primary.stem});
    const possible=[nonexact?null:primary,...models.filter(model=>model.resolution!=='official-material-cmd'||model.exactCMD),image,reviewedStem?{...modelReference(reviewedStem,'reviewed-qualified-image-candidate'),qualifiedKey:reviewedKey}:null].filter(Boolean);
    const candidates=[...new Map(possible.map(model=>[model.stem,model])).values()];
    return {exact:conflicts.length===0,model:primary,reason:conflicts.length?'conflicting-public-model-associations':null,candidates,conflicts,requiresCorroboration:conflicts.length>0};
}

const sha256=value=>createHash('sha256').update(value).digest('hex');
const validSHA=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
function stableJSON(value){
    if(Array.isArray(value))return '['+value.map(stableJSON).join(',')+']';
    if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stableJSON(value[key])).join(',')+'}';
    return JSON.stringify(value);
}

// Both the native geometry and its GUI pose must agree. For the proven flat
// shortcut only, Z thickness cannot change any displayed pixel.
export function nativeAssetIdentity(model,textureHashes){
    try{validateModel(model);}catch{return null;}
    if(!Array.isArray(textureHashes)||textureHashes.length!==model.tex.length||!textureHashes.every(validSHA))return null;
    const flat=wholeFlatTexture(model);
    return {kind:flat?'whole-flat-pixels':'native-geometry-uv-gui-pixels',sha256:sha256(stableJSON({kind:flat?'whole-flat-pixels':'native-geometry-uv-gui-pixels',textures:textureHashes,...flat?{}:{elements:model.el,gui:model.d?.gui||null}}))};
}

function corroboratedMaterial(index,item,nativeCandidates){
    const facts=officialModelCandidates(index,item),material=facts.find(model=>model.exactCMD),image=publishedImageModel(index,item);
    if(!material||!image)return null;
    // These are independent published associations: an exact typed override
    // and a namespace-qualified image identity. A bare alias is not enough.
    if(material.stem===image.stem)return {stem:material.stem,evidence:{kind:'exact-cmd-and-qualified-image-agree',material:material.material,customModelData:material.matchedCMD,qualifiedKey:image.qualifiedKey,sourceImage:image.sourceImage}};
    if(!Array.isArray(nativeCandidates))return null;
    const selected=nativeCandidates.find(model=>model.sourceModelUrl===material.url),pictured=nativeCandidates.find(model=>model.sourceModelUrl===image.url);
    if(!selected||!pictured||!validSHA(selected.sourceModelSha256)||!validSHA(pictured.sourceModelSha256))return null;
    const a=nativeAssetIdentity(selected.model,selected.textureHashes),b=nativeAssetIdentity(pictured.model,pictured.textureHashes);
    if(!a||!b||a.sha256!==b.sha256)return null;
    return {stem:material.stem,evidence:{kind:'native-equivalent-qualified-image',identityKind:a.kind,identitySha256:a.sha256,material:material.material,customModelData:material.matchedCMD,qualifiedKey:image.qualifiedKey,sourceImage:image.sourceImage,selected:{url:selected.sourceModelUrl,sha256:selected.sourceModelSha256,textureHashes:selected.textureHashes},pictured:{url:pictured.sourceModelUrl,sha256:pictured.sourceModelSha256,textureHashes:pictured.textureHashes}}};
}

export function nativeModelIdentityProof(index,item,{sourceModelUrl,sourceModelSha256,textureHashes,nativeCandidates}){
    const context=modelProof(index,item),candidate=context.candidates.find(model=>model.url===sourceModelUrl);
    if(!candidate)return {exact:false,reason:context.reason||'unregistered-model-candidate',conflicts:context.conflicts||[]};
    const facts=officialModelCandidates(index,item),evidence=[];
    for(const model of facts.filter(model=>model.stem===candidate.stem)){
        if(model.resolution==='official-key')evidence.push({kind:'qualified-source-key',qualifiedKey:model.qualifiedKey,stem:model.stem});
        else if(model.exactCMD)evidence.push({kind:'exact-material-cmd',material:model.material,customModelData:model.matchedCMD,stem:model.stem});
        else if(model.resolution==='official-item-alias')evidence.push({kind:'published-global-alias',alias:model.alias,stem:model.stem});
    }
    const image=publishedImageModel(index,item);
    if(image?.stem===candidate.stem)evidence.push({kind:'qualified-wiki-image-key',qualifiedKey:image.qualifiedKey,url:image.sourceImage,stem:image.stem});
    const reviewedKey=REVIEWED_CANDIDATES.get(item.sourceKey);
    if(reviewedKey&&reviewedCandidateStem(index,item.sourceKey)===candidate.stem)evidence.push({kind:'reviewed-qualified-image-candidate',qualifiedKey:reviewedKey,sourceImage:item.sourceImage,stem:candidate.stem});
    const pixels=typeof item.imageSha256==='string'&&Array.isArray(textureHashes)&&textureHashes.includes(item.imageSha256);
    if(pixels)evidence.push({kind:'wiki-png-equals-native-texture',sha256:item.imageSha256,sourceImage:item.sourceImage});
    const reviewed=REVIEWED_IDENTITIES.get(item.sourceKey),reviewedTextures=reviewed&&(reviewed.textureSha256s||[reviewed.textureSha256]);
    const humanReviewed=reviewed&&reviewed.stem===candidate.stem&&reviewed.modelSha256===sourceModelSha256&&Array.isArray(textureHashes)&&stableJSON(textureHashes)===stableJSON(reviewedTextures);
    if(humanReviewed)evidence.push({kind:'reviewed-native-identity',sourceKey:item.sourceKey,modelSha256:reviewed.modelSha256,textureSha256:reviewedTextures.length===1?reviewedTextures[0]:null,textureSha256s:reviewedTextures,proof:reviewed.proof});
    const materialIdentity=corroboratedMaterial(index,item,nativeCandidates);
    const corroborated=materialIdentity?.stem===candidate.stem&&(materialIdentity.evidence.kind!=='native-equivalent-qualified-image'||(materialIdentity.evidence.selected.sha256===sourceModelSha256&&stableJSON(materialIdentity.evidence.selected.textureHashes)===stableJSON(textureHashes)));
    if(corroborated)evidence.push(materialIdentity.evidence);
    const independent=pixels||humanReviewed||corroborated;
    // A reviewed identity is exclusive: its known incorrect fallback must
    // never replace the approved geometry if the current source later changes.
    const exact=reviewed?humanReviewed:materialIdentity?corroborated:context.requiresCorroboration?independent:context.exact&&candidate.stem===context.model.stem;
    return {exact:!!exact,model:modelReference(candidate.stem,candidate.resolution),evidence,conflicts:context.conflicts||[],reason:exact?null:reviewed?'reviewed-native-identity-changed':'conflicting-model-without-independent-corroboration'};
}
