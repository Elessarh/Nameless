// Source-preserving native projection, pipeline cache and atomic-write checks.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {rotatePoint,rotateGuiXYZ,wholeFlatTexture,validateModel,depthOrder,renderNativeSvg,clampTextureRegions,sampledFaceUvRect} from './official-preview-svg.mjs';
import {modelProof,allowedResource,atomicWrite,snapshotResourceCache,verifyIndexHash} from './build-official-item-previews.mjs';
import {nativeModelIdentityProof} from './official-model-identity.mjs';
let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
const near=(actual,expected)=>actual.every((value,i)=>Math.abs(value-expected[i])<1e-6);
check(near(rotatePoint([1,0,0],[0,0,90]),[0,1,0]),'Native Z rotations preserve their documented axis');
check(near(rotatePoint([9,8,8],[0,0,90],[8,8,8]),[8,9,8]),'Native rotations keep the authored pivot');
check(near(rotatePoint([0,1,0],[90,0,0]),[0,0,1]),'Native X rotation has the correct direction');
check(near(rotateGuiXYZ([1,0,0],[90,90,0]),[0,1,0]),'GUI Euler XYZ composes Rx times Ry: a vector receives the Y rotation before X');
check(near(rotateGuiXYZ([1,2,3],[90,90,90]),[3,-2,1]),'GUI Euler XYZ keeps the verified three-axis matrix composition');
// Matrix coefficients from THREE.Matrix4.makeRotationFromEuler's XYZ branch,
// also equivalent to JOML rotationX(30).rotateY(45).rotateZ(60).
check(near(rotateGuiXYZ([1,2,3],[30,45,60]),[1.250128862761327,.11976949160546035,3.524603962911527]),'An asymmetric point agrees with the independent THREE/JOML XYZ matrix fixture');
check(near(rotatePoint([1,2,3],[90,90,90]),[3,2,-1]),'Compact native element rotations retain their original order independently of the GUI correction');
for(const rotation of [[90,0,0],[0,-45,0],[0,0,90]])check(near(rotateGuiXYZ([1,2,3],rotation),rotatePoint([1,2,3],rotation)),'A single authored GUI axis remains identical to its original native rotation');
const flat={v:1,tex:['native.png'],flat:1,el:[{a:[0,0,7.5],b:[16,16,8.5],sh:0,f:{n:[0,0,16,16,0],s:[0,0,16,16,0]}}]};
check(wholeFlatTexture(flat),'Only a proven full-texture flat model qualifies for direct sprite presentation');
check(!wholeFlatTexture({...flat,d:{gui:{r:[0,0,90]}}}),'Authored GUI rotation cannot be silently discarded by the flat shortcut');
check(!wholeFlatTexture({...flat,el:[{...flat.el[0],f:{...flat.el[0].f,n:[0,0,8,16,0]}}]}),'An atlas UV crop cannot qualify as a whole image');
assert.throws(()=>validateModel({...flat,tex:['../private.png']}),/unsupported/);checks++;
assert.throws(()=>validateModel({...flat,el:[{...flat.el[0],r:[8,8,8,0,0,90,3]}]}),/unsupported/);checks++;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9sAAAAASUVORK5CYII=','base64');
const before=Buffer.from(png),result=renderNativeSvg(flat,[{bytes:png,width:1,height:1}]);
check(result.status==='safe-flat'&&result.geometry.sourceFaces===2,'Verified flat geometry uses its own source texture');
check(png.equals(before),'Preview production cannot paint or mutate the original bitmap');
const dom=new JSDOM(result.svg,{contentType:'image/svg+xml'});
check(dom.window.document.querySelectorAll('image').length===1&&dom.window.document.querySelector('image').getAttribute('href')==='data:image/png;base64,'+png.toString('base64'),'The exact PNG bytes are embedded, without external or executable references');
check(!dom.window.document.querySelector('script,foreignObject'),'Native previews contain no executable code');dom.window.close();
const singleAxis={...flat,flat:undefined,d:{gui:{r:[0,0,90]}}};
check(createHash('sha256').update(renderNativeSvg(singleAxis,[{bytes:png,width:1,height:1}]).svg).digest('hex')==='35c477df7c3be74259f2ef649bcdb03c4a3f9759ee0a2eb441df224f7d59e6ff','The single-axis GUI reference keeps its exact pre-correction SVG bytes');
check(renderNativeSvg({...flat,flat:undefined,d:{gui:{s:[1,1,1],t:[0,0,0]}}},[{bytes:png,width:1,height:1}]).svg===renderNativeSvg({...flat,flat:undefined},[{bytes:png,width:1,height:1}]).svg,'An absent authored GUI rotation keeps the existing orthographic fallback camera unchanged');
const sampleTexture={width:2,height:2};
check(JSON.stringify(sampledFaceUvRect([4,0,4,16,0],sampleTexture))==='[[0,0],[1,0],[1,2],[0,2]]','A constant U samples its exact native texel column while V keeps varying');
check(JSON.stringify(sampledFaceUvRect([0,4,16,4,0],sampleTexture))==='[[0,0],[2,0],[2,1],[0,1]]','A constant V samples its exact native texel row while U keeps varying');
check(JSON.stringify(sampledFaceUvRect([4,4,4,4,0],sampleTexture))==='[[0,0],[1,0],[1,1],[0,1]]','A point UV selects the first opaque source texel rather than dropping its face');
check(JSON.stringify(sampledFaceUvRect([12,4,12,4,0],sampleTexture))==='[[1,0],[2,0],[2,1],[1,1]]','A point UV selecting the transparent source texel retains that transparent sample');
check(JSON.stringify(sampledFaceUvRect([8,4,8,4,0],sampleTexture))==='[[1,0],[2,0],[2,1],[1,1]]','NEAREST on an exact texel boundary selects floor(s times size), matching the official sampler');
check(JSON.stringify(sampledFaceUvRect([16,16,16,16,0],sampleTexture))==='[[1,1],[2,1],[2,2],[1,2]]','The exact upper atlas boundary clamps to the last source texel');
check(JSON.stringify(sampledFaceUvRect([-1,-1,-1,-1,0],sampleTexture))==='[[0,0],[1,0],[1,1],[0,1]]','Negative constant UVs clamp to the first source texel rather than wrapping');
// Real 2x2 PNG: opaque red, transparent; opaque green, opaque blue.
const samplePng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAF0lEQVR4AWP4z8DwnwEM/jP8Z2D4/x8ALeQF+5UmdpkAAAAASUVORK5CYII=','base64'),sampleBefore=Buffer.from(samplePng);
const sampleModel=uv=>({...flat,flat:undefined,d:{gui:{r:[0,0,0]}},el:[{...flat.el[0],f:{s:uv}}]});
for(const [constant,crop] of [
    [[4,0,4,16,0],[0,0,8,16,0]],
    [[0,4,16,4,0],[0,0,16,8,0]],
    [[4,4,4,4,0],[0,0,8,8,0]],
    [[12,4,12,4,0],[8,0,16,8,0]],
    [[8,4,8,4,0],[8,0,16,8,0]],
    [[16,16,16,16,0],[8,8,16,16,0]]
]){
    const model=sampleModel(constant),original=JSON.stringify(model),textures=[{bytes:samplePng,width:2,height:2}];
    const sampled=renderNativeSvg(model,textures),reference=renderNativeSvg(sampleModel(crop),textures);
    check(sampled.svg===reference.svg,'A degenerate native UV renders exactly its NEAREST row, column or point texel interval, including transparency');
    check(JSON.stringify(model)===original&&samplePng.equals(sampleBefore),'Degenerate UV sampling cannot mutate native model coordinates or repaint source pixels');
}
const inverted={v:1,tex:['native.png'],el:[{a:[16,16,16],b:[0,0,0],f:{n:[16,16,0,0,0],s:[0,0,16,16,0],e:[0,0,16,16,0],w:[16,16,0,0,0],u:[0,0,16,16,0],d:[16,16,0,0,0]}}]};
const originalInverted=JSON.stringify(inverted),invertedResult=renderNativeSvg(inverted,[{bytes:png,width:1,height:1}]);
check(invertedResult.status==='native-model-render'&&invertedResult.geometry.sourceFaces===6,'Authored reversed endpoints remain valid signed native cuboids');
check(JSON.stringify(inverted)===originalInverted,'Rendering reversed endpoints preserves source coordinates, face winding and UVs');
const composedGui={...inverted,d:{gui:{r:[30,45,60],s:[.7,.8,.9],t:[1,-2,3]}}},composedBefore=JSON.stringify(composedGui);
check(renderNativeSvg(composedGui,[{bytes:png,width:1,height:1}]).status==='native-model-render'&&JSON.stringify(composedGui)===composedBefore,'GUI composition changes the projection without mutating native elements, pivots, UVs, scale, translation or pixels');
const clampedRegions=clampTextureRegions(16,32,{minU:-1,maxU:32,minV:-2,maxV:64});
check(clampedRegions.length===9,'UVs outside both axes use the native center, four edge texels and four corner texels');
const leftTop=clampedRegions.find(region=>region.rect[0]===-1&&region.rect[1]===-2);
check(JSON.stringify(leftTop)==='{"rect":[-1,-2,1,2],"matrix":[1,0,0,2,-1,-2]}','Negative UV corner sampling stretches the first native pixel and never wraps the atlas');
const rightBottom=clampedRegions.find(region=>region.rect[0]===16&&region.rect[1]===32);
check(JSON.stringify(rightBottom)==='{"rect":[16,32,16,32],"matrix":[16,0,0,32,-224,-960]}','Positive UV corner sampling stretches the final native pixel into the exact authored bounds');
const authoredUV={...flat,flat:undefined,d:{gui:{r:[0,0,0]}},el:[{...flat.el[0],f:{n:[-1,0,16,16,0],s:[0,0,32,32,0]}}]};
const authoredBefore=JSON.stringify(authoredUV),clamped=renderNativeSvg(authoredUV,[{bytes:png,width:1,height:1}]);
check(clamped.status==='native-model-render'&&clamped.svg.includes('href="#sampledTx0"'),'The real -1 Orbe and 32 Lovestruck UV formats render with edge-clamped native sampling');
check(JSON.stringify(authoredUV)===authoredBefore&&clamped.svg.includes('data:image/png;base64,'+png.toString('base64')),'Out-of-bounds UV support keeps original authored coordinates and every original PNG byte');
assert.throws(()=>validateModel({...authoredUV,el:[{...flat.el[0],f:{s:[0,0,65,16,0]}}]}),/unsupported-face-uv/);checks++;
const flattened={...flat,flat:undefined,d:{gui:{r:[0,-180,0],s:[.45,.45,0]}}},flattenedBefore=JSON.stringify(flattened);
const flattenedResult=renderNativeSvg(flattened,[{bytes:png,width:1,height:1}]);
check(flattenedResult.status==='native-model-render'&&flattenedResult.geometry.scale[2]===0&&flattenedResult.geometry.projectedFragments>0,'Catalyseur Damnée authored zero Z scale retains its visible planar native silhouette');
check(JSON.stringify(flattened)===flattenedBefore,'Supporting a zero GUI axis cannot inflate or normalize the original geometry');
assert.throws(()=>renderNativeSvg({...flattened,d:{gui:{s:[0,0,0]}}},[{bytes:png,width:1,height:1}]),/unsupported-empty-projection/);checks++;
assert.throws(()=>renderNativeSvg({...flattened,d:{gui:{s:[1,-1,1]}}},[{bytes:png,width:1,height:1}]),/unsupported-gui-scale/);checks++;
const square=z=>[[-1,-1,z],[1,-1,z],[1,1,z],[-1,1,z]];
assert.deepEqual(depthOrder([{id:'near',points:square(4)},{id:'far',points:square(0)}]).map(face=>face.id),['far','near']);checks++;
const crossing=depthOrder([{id:'sloping',points:[[-1,-1,-1],[1,-1,1],[1,1,1],[-1,1,-1]]},{id:'level',points:square(0)}]);
assert.deepEqual(crossing.map(face=>face.id),['level','sloping','level']);checks++;
check(crossing[0].points.every(point=>point[0]>=-1e-6)&&crossing[2].points.every(point=>point[0]<=1e-6),'Crossing native faces are split at their real intersection rather than sorted by average depth');
check(allowedResource('https://saominecraft.com/item-models/m/nerfs/item/native.json'),'Only current official model paths are eligible');
check(!allowedResource('https://attacker.invalid/item-models/m/native.json')&&!allowedResource('https://saominecraft.com/private/native.json')&&!allowedResource('https://u:p@saominecraft.com/item-models/m/native.json'),'Private, remote and credential-bearing model URLs are excluded');
const index={models:{},items:{},alias:{},vanilla:{paper:{e:[[100,'pack/item/a'],[200,'pack/item/b']]}}};
const item={sourceId:'CURRENT',material:'paper',customModelData:200,sourceModel:{url:'https://saominecraft.com/item-models/m/pack/item/b.json'}};
check(modelProof(index,item).exact,'An exact published material/CMD entry is a confirmed model association');
check(!modelProof(index,{...item,customModelData:201}).exact,'Nonexact CMD ranges remain neutral rather than impersonating another item');
check(!modelProof(index,{...item,sourceModel:{url:'https://saominecraft.com/item-models/m/pack/item/old.json'}}).exact,'A changed current registry cannot silently substitute a different model');
const fishSHA='a'.repeat(64),keySHA='b'.repeat(64);
const ambiguous={models:{'tavern:bar':'tavern/bar','tavern:beer_tank':'tavern/beer_tank','fishing_expansion:item/ia_auto/bass':'fishing_expansion/item/ia_auto/bass','elitecreatures:knight_assortment/key':'elitecreatures/knight_assortment/key','chinese_newyear:head_dragon_mask':'chinese_newyear/head_dragon_mask'},items:{'fishing_expansion:bass':'fishing_expansion/item/ia_auto/bass'},alias:{bar:'tavern:bar','chinese_newyear:head_dragon_mask':'chinese_newyear:head_dragon_mask'},vanilla:{cod:{e:[[485200,'fishing_expansion/item/ia_auto/bass']]},paper:{e:[[10072,'tavern/beer_tank'],[12308,'nerfs/item/ia_auto/amuletteamethyste']]}}};
const fish={sourceId:'BAR',sourceKey:'fishing_job:BAR',material:'cod',customModelData:485200,imageSha256:fishSHA,sourceImage:'https://api.saominecraft.com/uploads/items/fishing_expansion/bass.png?v=2',sourceModel:{stem:'tavern/bar',url:'https://saominecraft.com/item-models/m/tavern/bar.json'}};
check(!modelProof(ambiguous,fish).exact,'A generic Bar alias conflicting with typed fish metadata is insufficient');
const fishProof=nativeModelIdentityProof(ambiguous,fish,{sourceModelUrl:'https://saominecraft.com/item-models/m/fishing_expansion/item/ia_auto/bass.json',sourceModelSha256:'d'.repeat(64),textureHashes:[fishSHA]});
check(fishProof.exact&&fishProof.evidence.some(proof=>proof.kind==='exact-material-cmd')&&fishProof.evidence.some(proof=>proof.kind==='qualified-wiki-image-key'),'Bar requires its exact fish CMD, qualified current image and identical native pixels');
check(!nativeModelIdentityProof(ambiguous,fish,{sourceModelUrl:'https://saominecraft.com/item-models/m/tavern/bar.json',sourceModelSha256:'d'.repeat(64),textureHashes:[keySHA]}).exact,'A furniture alias cannot masquerade as a fish with unrelated pixels');
const key={sourceId:'key_sanctuary_of_xalzirith',sourceKey:'dungeon_key:key_sanctuary_of_xalzirith',material:'paper',customModelData:10072,imageSha256:keySHA,sourceImage:'https://api.saominecraft.com/uploads/items/elitecreatures/knight_key.png?v=2',sourceModel:{stem:'tavern/beer_tank',url:'https://saominecraft.com/item-models/m/tavern/beer_tank.json'}};
check(!modelProof(ambiguous,key).exact,'A conflicting exact paper CMD alone cannot prove the dungeon key identity');
check(nativeModelIdentityProof(ambiguous,key,{sourceModelUrl:'https://saominecraft.com/item-models/m/elitecreatures/knight_assortment/key.json',sourceModelSha256:'e'.repeat(64),textureHashes:[keySHA]}).exact,'A reviewed qualified key model is accepted only with the exact current wiki PNG');
check(!nativeModelIdentityProof(ambiguous,key,{sourceModelUrl:'https://saominecraft.com/item-models/m/elitecreatures/knight_assortment/key.json',sourceModelSha256:'e'.repeat(64),textureHashes:[fishSHA]}).exact,'The qualified key candidate fails closed when its native pixels differ');
const amulet={sourceId:'AMULETTE_AMETHYSTE',sourceKey:'amulet:AMULETTE_AMETHYSTE',material:'paper',customModelData:12308,imageSha256:fishSHA,sourceImage:'https://api.saominecraft.com/uploads/items/chinese_newyear/head_dragon_mask.png?v=2',sourceModel:{stem:'nerfs/item/ia_auto/amuletteamethyste',url:'https://saominecraft.com/item-models/m/nerfs/item/ia_auto/amuletteamethyste.json'}};
const amuletNative={sourceModelUrl:amulet.sourceModel.url,sourceModelSha256:'92b8c9ad376ba030f61a2d50dc3e71175a602708c5419d0b6ae0cda6c0daedc1',textureHashes:['a0f5d3ba59efd9c9df4d45b6596c9c7bef8e05fa7006bfeb22c97ec1560e932d']};
check(nativeModelIdentityProof(ambiguous,amulet,amuletNative).exact,'The byte-pinned reviewed amulet remains correct despite its unrelated dragon-mask fallback');
check(!nativeModelIdentityProof(ambiguous,amulet,{...amuletNative,sourceModelSha256:'0'.repeat(64)}).exact,'An old visual review cannot authorize changed amulet geometry');
check(!nativeModelIdentityProof(ambiguous,amulet,{sourceModelUrl:'https://saominecraft.com/item-models/m/chinese_newyear/head_dragon_mask.json',sourceModelSha256:'0'.repeat(64),textureHashes:[fishSHA]}).exact,'The known incorrect dragon-mask fallback is rejected even when its native texture equals the raw PNG');
check(!nativeModelIdentityProof(ambiguous,amulet,{...amuletNative,textureHashes:[fishSHA]}).exact,'Changed reviewed texture bytes neutralize the amulet rather than restoring its incorrect fallback');
const digest='a'.repeat(64),cached={snapshotSha256:digest,modelIndex:{sha256:digest},resources:[{url:'public-native-texture',sha256:digest}]};
check(snapshotResourceCache(cached,digest,digest).size===1,'A cache belongs to its exact official snapshot and model index');
check(snapshotResourceCache(cached,'b'.repeat(64),digest).size===0,'A refreshed official snapshot renews all model and pixel resources');
check(snapshotResourceCache(cached,digest,'b'.repeat(64)).size===0,'A changed model index cannot reuse old model or pixel bytes');
assert.throws(()=>verifyIndexHash(digest,'b'.repeat(64)),/fresh official item snapshot/);checks++;
verifyIndexHash(digest,digest);checks++;
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'nameless-native-preview-')),destination=path.join(temporary,'same.svg');
try{await Promise.all(Array.from({length:16},()=>atomicWrite(destination,Buffer.from('same-native-svg'))));check((await fs.readFile(destination,'utf8'))==='same-native-svg'&&(await fs.readdir(temporary)).length===1,'Shared model previews use unique atomic temporaries without lost rename races');}
finally{await fs.unlink(destination).catch(error=>{if(error.code!=='ENOENT')throw error;});await fs.rmdir(temporary);}
console.log('Official native renderer: '+checks+' checks passed; authored pivots, UV proof, texture bytes, exact depth partitions, cache renewal and concurrent writes.');
