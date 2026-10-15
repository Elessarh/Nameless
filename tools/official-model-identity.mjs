// Identity corroboration is separate from immutable public gameplay facts.
import {officialModel,officialModelCandidates,publishedImageModel,modelReference} from './import-official-items.mjs';
const REVIEWED_CANDIDATES=new Map([['dungeon_key:key_sanctuary_of_xalzirith','elitecreatures:knight_assortment/key']]);
const REVIEWED_IDENTITIES=new Map([['amulet:AMULETTE_AMETHYSTE',{
    stem:'nerfs/item/ia_auto/amuletteamethyste',
    modelSha256:'92b8c9ad376ba030f61a2d50dc3e71175a602708c5419d0b6ae0cda6c0daedc1',
    textureSha256:'a0f5d3ba59efd9c9df4d45b6596c9c7bef8e05fa7006bfeb22c97ec1560e932d',
    proof:'docs/official-items-2026-10-14/native-samples.png'
}]]);

export function modelProof(index,item){
    const primary=officialModel(index,item),models=officialModelCandidates(index,item),image=publishedImageModel(index,item);
    if(!primary)return {exact:false,reason:'no-public-model',candidates:[]};
    const material=models.find(model=>model.exactCMD),alias=models.find(model=>model.resolution==='official-item-alias');
    if(primary.resolution==='official-material-cmd'&&!material)return {exact:false,reason:'nonexact-cmd-range',model:primary,candidates:[]};
    const conflicts=[];
    if(item.sourceModel?.url&&item.sourceModel.url!==primary.url)conflicts.push({kind:'snapshot-selected-model-versus-current-primary',selected:item.sourceModel.url,primary:primary.url});
    if(material&&alias&&material.stem!==alias.stem)conflicts.push({kind:'global-alias-versus-exact-cmd',alias:alias.stem,exactCMD:material.stem});
    if(image&&image.stem!==(item.sourceModel?.stem||primary.stem))conflicts.push({kind:'qualified-image-versus-selected-model',image:image.stem,selected:item.sourceModel?.stem||primary.stem});
    const reviewedKey=REVIEWED_CANDIDATES.get(item.sourceKey),reviewedStem=reviewedKey&&index.models?.[reviewedKey];
    if(reviewedStem&&reviewedStem!==primary.stem)conflicts.push({kind:'reviewed-qualified-image-candidate',candidate:reviewedStem,selected:primary.stem});
    const possible=[primary,...models.filter(model=>model.resolution!=='official-material-cmd'||model.exactCMD),image,reviewedStem?{...modelReference(reviewedStem,'reviewed-qualified-image-candidate'),qualifiedKey:reviewedKey}:null].filter(Boolean);
    const candidates=[...new Map(possible.map(model=>[model.stem,model])).values()];
    return {exact:conflicts.length===0,model:primary,reason:conflicts.length?'conflicting-public-model-associations':null,candidates,conflicts,requiresCorroboration:conflicts.length>0};
}

export function nativeModelIdentityProof(index,item,{sourceModelUrl,sourceModelSha256,textureHashes}){
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
    if(reviewedKey&&index.models?.[reviewedKey]===candidate.stem)evidence.push({kind:'reviewed-qualified-image-candidate',qualifiedKey:reviewedKey,sourceImage:item.sourceImage,stem:candidate.stem});
    const pixels=typeof item.imageSha256==='string'&&Array.isArray(textureHashes)&&textureHashes.includes(item.imageSha256);
    if(pixels)evidence.push({kind:'wiki-png-equals-native-texture',sha256:item.imageSha256,sourceImage:item.sourceImage});
    const reviewed=REVIEWED_IDENTITIES.get(item.sourceKey),humanReviewed=reviewed&&reviewed.stem===candidate.stem&&reviewed.modelSha256===sourceModelSha256&&textureHashes?.includes(reviewed.textureSha256);
    if(humanReviewed)evidence.push({kind:'reviewed-native-identity',sourceKey:item.sourceKey,modelSha256:reviewed.modelSha256,textureSha256:reviewed.textureSha256,proof:reviewed.proof});
    const independent=pixels||humanReviewed;
    // A reviewed identity is exclusive: its known incorrect fallback must
    // never replace the approved geometry if the current source later changes.
    const exact=reviewed?humanReviewed:context.requiresCorroboration?independent:context.exact&&candidate.stem===context.model.stem;
    return {exact:!!exact,model:modelReference(candidate.stem,candidate.resolution),evidence,conflicts:context.conflicts||[],reason:exact?null:reviewed?'reviewed-native-identity-changed':'conflicting-model-without-independent-corroboration'};
}
