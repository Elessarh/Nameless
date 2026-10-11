import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const banned=/art-v3|reference-v2|aincrad-minecraft|sao-guild|page-font-(?:bestiaire|items|wiki)/;
const files=['index.html',...fs.readdirSync('pages').filter(name=>name.endsWith('.html')).map(name=>'pages/'+name),...fs.readdirSync('css/components').filter(name=>name.endsWith('.css')).map(name=>'css/components/'+name)];
for(const file of files)assert.ok(!banned.test(fs.readFileSync(file,'utf8')),'Retired generated/unknown-origin scenery must not be referenced: '+file);
const manifest=JSON.parse(fs.readFileSync('docs/sao-minecraft-home-2026-10-08/asset-manifest.json'));
const city=manifest.artwork.find(row=>row.key==='city');
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(hash(city.source.path),city.source.sha256,'Native Minecraft source stays intact');
for(const output of city.outputs)assert.equal(hash(output.path),output.sha256,'Native view variants stay intact');
const home=fs.readFileSync('index.html','utf8');
const exports=new Set();
const series=['art-v4','art-v5'];
for(const name of series){
const reviewed=JSON.parse(fs.readFileSync('assets/'+name+'/asset-manifest.json'));
assert.equal(reviewed.mode,'built-in image_gen');
assert.equal(reviewed.artwork.length,name==='art-v4'?4:1);
for(const record of reviewed.artwork){
    assert.equal(record.origin,'AI-generated illustration','Provenance stays explicit');
    assert.equal(hash(record.source.path),record.source.sha256,'Generated source matches the reviewed version');
    for(const output of record.outputs){
        assert.equal(hash(output.path),output.sha256);
        assert.equal(fs.statSync(output.path).size,output.bytes);
        const crop=output.crop;
        const [width,height]=crop?[crop[2]-crop[0],crop[3]-crop[1]]:record.source.dimensions;
        assert.ok(output.dimensions[0]<=width,'Scenery derivatives do not upscale');
        assert.ok(Math.abs(output.dimensions[1]-height*output.dimensions[0]/width)<=.5,'Scenery crop proportions are preserved');
        exports.add(output.path);
    }
}
}
for(const file of files)for(const match of fs.readFileSync(file,'utf8').matchAll(/assets\/art-v(?:4|5)\/[a-z0-9-]+\.(?:webp|png)/g)){
    assert.ok(exports.has(match[0]),'Pages only load optimized reviewed derivatives: '+file+' '+match[0]);
}
assert.ok(home.includes('/assets/art-v4/aincrad-1672.webp'));
assert.ok(home.includes('/assets/art-v4/aincrad-mobile.webp'));
assert.ok(home.includes('Illustration d’Aincrad'));
const css=fs.readFileSync('css/components/reference-catalogs.css','utf8');
assert.ok(css.includes('--catalogue-card-scene: none'),'Inventory backgrounds remain readable and do not repeat scenery');
console.log('Art policy: '+files.length+' page/style sources exclude retired scenery; five reviewed generated environments, twenty optimized derivatives; native city sources intact.');
