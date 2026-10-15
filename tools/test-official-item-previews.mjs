import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {readOfficialItemPreviews, resolveItemPreview, validatePreviewSvg, auditOfficialItemPreviews, getOfficialCatalogueVersion} from './official-item-previews.mjs';
import {writeOfficialItemCatalogue} from './items-catalogue.mjs';
import {nativeModelIdentityProof} from './official-model-identity.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nameless-native-preview-test-'));
const sha = data => createHash('sha256').update(data).digest('hex');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
const rawImage = '/assets/items/official/raw.png', image = '/assets/items/official/previews/item.svg';
const modelStem = 'pack/item/current', modelUrl = 'https://saominecraft.com/item-models/m/' + modelStem + '.json';
const index = {models: {'pack:current': modelStem}, items: {}, alias: {}, vanilla: {}}, indexBytes = JSON.stringify(index);
const indexResource = {url: 'https://saominecraft.com/item-models/index.json', path: '/assets/items/official/previews/source/models/index.json', sha256: sha(indexBytes), bytes: Buffer.byteLength(indexBytes), kind: 'index'};
const modelBytes = JSON.stringify({v: 1, tex: ['native.png']});
const item = {id: 'official_a', sourceId: 'pack:current', sourceKey: 'test:CURRENT', image: rawImage, imageSha256: sha(png), sourceModel: {stem: modelStem, url: modelUrl}};
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><defs><clipPath id="face"><polygon points="0,0 16,0 16,16"/></clipPath></defs><image href="data:image/png;base64,' + png.toString('base64') + '" width="16" height="16" clip-path="url(#face)"/></svg>';
const record = {officialId: item.id, status: 'native-model-render', image, sha256: sha(svg), sourceModelUrl: item.sourceModel.url,
    association: nativeModelIdentityProof(index, item, {sourceModelUrl: modelUrl, sourceModelSha256: sha(modelBytes), textureHashes: [sha(png)]}),
    sourceModelPath: '/assets/items/official/model.json', sourceModelSha256: sha(modelBytes), textures: [{url: 'https://saominecraft.com/item-models/t/native.png', path: rawImage, sha256: sha(png), bytes: png.length, kind: 'texture'}],
    geometry: {elements: 1, sourceFaces: 1, projectedFragments: 1}, nativeFlatVerified: false, source2DVerified: false};
let checks = 0;
function check(value, message) {assert.ok(value, message); checks++;}
function fails(fn, message) {assert.throws(fn); checks++;}
function writeManifest(records, extra = {}) {
    const snapshotBytes = fs.readFileSync(path.join(root, 'data/official-items.json'));
    const resources = [indexResource, {url: record.sourceModelUrl, path: record.sourceModelPath, sha256: record.sourceModelSha256, bytes: Buffer.byteLength(modelBytes), kind: 'model'}, ...record.textures];
    fs.writeFileSync(path.join(root, 'data/official-item-previews.json'), JSON.stringify({schemaVersion: 1, snapshotSha256: sha(snapshotBytes), partial: false, modelIndex: {url: indexResource.url, sha256: indexResource.sha256}, resources, records, ...extra}));
}
try {
    fs.mkdirSync(path.join(root, 'data')); fs.mkdirSync(path.join(root, 'assets/items/official/previews'), {recursive: true});
    fs.writeFileSync(path.join(root, rawImage.slice(1)), png); fs.writeFileSync(path.join(root, image.slice(1)), svg);
    fs.writeFileSync(path.join(root, record.sourceModelPath.slice(1)), modelBytes);
    fs.mkdirSync(path.dirname(path.join(root, indexResource.path.slice(1))), {recursive: true});
    fs.writeFileSync(path.join(root, indexResource.path.slice(1)), indexBytes);
    fs.writeFileSync(path.join(root, 'data/official-items.json'), JSON.stringify({schemaVersion: 1, source: {modelsIndex: {url: indexResource.url, sha256: indexResource.sha256}}, items: [item]}));
    check(resolveItemPreview(item).image === null, 'A present raw PNG is not evidence that it represents the item');
    check(resolveItemPreview(item, {...record, image: null, status: 'unsupported-model', source2DVerified: true, nativeFlatVerified: true}).image === null, 'An unsupported model cannot fall back to a potentially misleading atlas');
    check(resolveItemPreview(item, {...record, image: null, status: 'safe-flat', source2DVerified: true}).image === null, 'One raw-image flag cannot turn a 3D atlas into a flat preview');
    const flat = {...record, status: 'safe-flat', image: null, sha256: null, source2DVerified: true, nativeFlatVerified: true};
    check(resolveItemPreview(item, flat).image === rawImage, 'Only native whole-UV evidence with identical source bytes enables the raw icon');
    check(resolveItemPreview(item, {...flat, textures: [{sha256: 'b'.repeat(64)}]}).image === null, 'A mismatched native texture never authorizes a raw wiki PNG');
    check(resolveItemPreview(item, record).image === image, 'A verified native-model rendering takes precedence over the raw atlas');
    check(resolveItemPreview(item, {...record, association: {exact: false}}).image === null, 'A plausible model thumbnail cannot conceal an uncertain current identity association');
    const noPreviews = getOfficialCatalogueVersion({root});
    writeManifest([record]);
    check(getOfficialCatalogueVersion({root}) !== noPreviews, 'Preview availability refreshes the catalogue cache without changing gameplay facts');
    const loaded = readOfficialItemPreviews({root});
    check(loaded.records.size === 1 && loaded.partial === false, 'A manifest covers current identities exactly');
    check(auditOfficialItemPreviews({root}).errors.length === 0, 'A self-contained SVG and matching source evidence pass the preview audit');
    fs.mkdirSync(path.join(root, 'js')); fs.mkdirSync(path.join(root, '_site'));
    fs.writeFileSync(path.join(root, 'js/items-catalog-official.js'), 'KEEP_EXISTING_CATALOGUE');
    fs.writeFileSync(path.join(root, '_site/index.html'), 'KEEP_EXISTING_BUILD');
    writeManifest([record], {partial: true});
    fails(() => writeOfficialItemCatalogue({root}), 'A sample preview manifest cannot update the browser catalogue');
    check(fs.readFileSync(path.join(root, 'js/items-catalog-official.js'), 'utf8') === 'KEEP_EXISTING_CATALOGUE' && fs.readFileSync(path.join(root, '_site/index.html'), 'utf8') === 'KEEP_EXISTING_BUILD', 'Rejected sample publication preserves generated JS and the existing publication artifact');
    fs.unlinkSync(path.join(root, 'data/official-item-previews.json'));
    fails(() => writeOfficialItemCatalogue({root}), 'An absent availability manifest cannot update the browser catalogue');
    writeManifest([{...record, status: 'pending', image: null, sha256: null}]);
    fails(() => writeOfficialItemCatalogue({root}), 'An unfinished preview status cannot masquerade as a complete publication manifest');
    writeManifest([flat]);
    check(auditOfficialItemPreviews({root}).errors.length === 0, 'A proven whole-texture PNG also passes source-byte verification');
    for (const records of [[], [record, record], [{...record, officialId: 'unknown'}], [{...record, status: 'uncertain-model-reference'}], [{...record, sha256: 'b'.repeat(64)}], [{...record, image: '/assets/items/official/previews/../raw.png'}]]) {
        writeManifest(records); fails(() => readOfficialItemPreviews({root}), 'Invalid identity, unsafe status/path or changed render bytes are rejected');
    }
    writeManifest([record], {snapshotSha256: 'b'.repeat(64)}); fails(() => readOfficialItemPreviews({root}), 'A render manifest must match the current fact snapshot');
    writeManifest([{...record, textures: [{...record.textures[0], sha256: 'b'.repeat(64)}]}]);
    check(auditOfficialItemPreviews({root}).errors.length > 0, 'Texture source tampering is detected independently from the SVG hash');
    writeManifest([{...record, sourceModelSha256: 'b'.repeat(64)}]);
    check(auditOfficialItemPreviews({root}).errors.length > 0, 'Native geometry source tampering is detected independently from the SVG hash');
    writeManifest([record], {modelIndex: {...indexResource, sha256: 'b'.repeat(64)}});
    check(auditOfficialItemPreviews({root}).errors.length > 0, 'An index different from the immutable current snapshot cannot authorize previews');
    writeManifest([record]);
    fs.writeFileSync(path.join(root, indexResource.path.slice(1)), '{}');
    check(auditOfficialItemPreviews({root}).errors.length > 0, 'Local index byte tampering is rejected before identity resolution');
    fs.writeFileSync(path.join(root, indexResource.path.slice(1)), indexBytes);
    writeManifest([{...record, association: {...record.association, evidence: []}}]);
    check(auditOfficialItemPreviews({root}).errors.length > 0, 'Recorded identity claims are compared with the independently recomputed official proof');
    writeManifest([{...record, sourceModelUrl: 'https://saominecraft.com/item-models/m/pack/item/unrelated.json'}]);
    check(auditOfficialItemPreviews({root}).errors.length > 0, 'A plausible rendering cannot borrow a different model identity');
    writeManifest([{...record, textures: [{...record.textures[0], url: 'https://saominecraft.com/item-models/t/unrelated.png'}]}]);
    check(auditOfficialItemPreviews({root}).errors.length > 0, 'Independent corroboration uses textures actually named by the native model');
    const originalSnapshot = fs.readFileSync(path.join(root, 'data/official-items.json'));
    fs.writeFileSync(path.join(root, 'data/official-items.json'), JSON.stringify({schemaVersion: 1, source: {modelsIndex: {url: indexResource.url, sha256: indexResource.sha256}}, items: [{...item, sourceId: 'UNKNOWN'}]}));
    writeManifest([record]);
    check(auditOfficialItemPreviews({root}).errors.length > 0, 'Unregistered current identities fail even when all acquired assets and recorded evidence look valid');
    const fishStem = 'fishing_expansion/item/ia_auto/bass', fishUrl = 'https://saominecraft.com/item-models/m/' + fishStem + '.json';
    const correctedIndex = {models: {'tavern:bar': 'tavern/bar'}, items: {'fishing_expansion:bass': fishStem}, alias: {bar: 'tavern:bar'}, vanilla: {cod: {e: [[485200, fishStem]]}}};
    const correctedBytes = JSON.stringify(correctedIndex), correctedIndexResource = {...indexResource, sha256: sha(correctedBytes), bytes: Buffer.byteLength(correctedBytes)};
    const fish = {...item, sourceId: 'BAR', sourceKey: 'fishing_job:BAR', material: 'cod', customModelData: 485200, sourceImage: 'https://api.saominecraft.com/uploads/items/fishing_expansion/bass.png?v=2', sourceModel: {stem: 'tavern/bar', url: 'https://saominecraft.com/item-models/m/tavern/bar.json'}};
    const corrected = {...record, sourceModelUrl: fishUrl, association: nativeModelIdentityProof(correctedIndex, fish, {sourceModelUrl: fishUrl, sourceModelSha256: record.sourceModelSha256, textureHashes: [sha(png)]})};
    fs.writeFileSync(path.join(root, indexResource.path.slice(1)), correctedBytes);
    fs.writeFileSync(path.join(root, 'data/official-items.json'), JSON.stringify({schemaVersion: 1, source: {modelsIndex: {url: correctedIndexResource.url, sha256: correctedIndexResource.sha256}}, items: [fish]}));
    writeManifest([corrected], {modelIndex: {url: correctedIndexResource.url, sha256: correctedIndexResource.sha256}, resources: [correctedIndexResource, {url: fishUrl, path: record.sourceModelPath, sha256: record.sourceModelSha256, bytes: Buffer.byteLength(modelBytes), kind: 'model'}, ...record.textures]});
    check(corrected.sourceModelUrl !== fish.sourceModel.url && auditOfficialItemPreviews({root}).errors.length === 0, 'Independent current image and native-byte proof can correct an old derived model association without editing gameplay facts');
    fs.writeFileSync(path.join(root, 'data/official-items.json'), originalSnapshot);
    fs.writeFileSync(path.join(root, indexResource.path.slice(1)), indexBytes);
    check(validatePreviewSvg(svg, new Set([sha(png)])), 'Safe clip fragments and embedded native PNGs are accepted');
    for (const unsafe of [
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://outside.example/pixel.png"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/svg+xml;base64,PHN2Zy8+"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="url(https://outside.example/a)"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" xml:base="https://outside.example/"><use href="#face"/></svg>',
        '<?xml-stylesheet href="https://outside.example/style.css"?><svg xmlns="http://www.w3.org/2000/svg"/>',
        '<!DOCTYPE svg [<!ENTITY content SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg"/>'
    ]) fails(() => validatePreviewSvg(unsafe), 'SVG executable/external content is rejected');
    fails(() => validatePreviewSvg(svg, new Set()), 'An SVG cannot embed texture bytes absent from its native source evidence');
    const repository = path.resolve(import.meta.dirname, '..');
    const nativeDocument = JSON.parse(fs.readFileSync(path.join(repository, 'data/official-item-previews.json'), 'utf8'));
    const native = nativeDocument.records.find(row => row.status === 'native-model-render' && row.image);
    check(native, 'A real current native cuboid rendering is present for SVG regression coverage');
    const nativeSvg = fs.readFileSync(path.join(repository, native.image.slice(1)), 'utf8');
    check(nativeSvg.includes('<filter') && nativeSvg.includes('<feColorMatrix'), 'The real 3D rendering exercises native face shading filters');
    check(validatePreviewSvg(nativeSvg, new Set(native.textures.map(texture => texture.sha256))), 'A real native 3D rendering keeps its safe local filters and exact embedded textures');
    console.log('Native official preview contract passed: ' + checks + ' checks; no atlas fallback, snapshot coverage, cache refresh, source bytes and safe self-contained SVG.');
} finally {
    const resolved = path.resolve(root), temporary = path.resolve(os.tmpdir()) + path.sep;
    if (!resolved.startsWith(temporary) || !path.basename(resolved).startsWith('nameless-native-preview-test-')) throw new Error('Unsafe preview test cleanup');
    fs.rmSync(resolved, {recursive: true, force: true});
}
