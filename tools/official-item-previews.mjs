// Native-model presentation is separate from the immutable gameplay snapshot.
// A raw wiki PNG can be a UV atlas, so its presence is not preview evidence.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {nativeModelIdentityProof} from './official-model-identity.mjs';

const defaultRoot = path.resolve(import.meta.dirname, '..');
export const PREVIEW_MANIFEST_PATH = 'data/official-item-previews.json';
export const MAX_PREVIEW_BYTES = 750000;
export const MAX_SOURCE_ELEMENTS = 384;
export const MAX_PROJECTED_FRAGMENTS = 6000;
const statuses = new Set(['safe-flat', 'native-model-render', 'uncertain-model-reference', 'unavailable-model', 'unsupported-model', 'missing-source-texture', 'pending']);
const approved = new Set(['safe-flat', 'native-model-render']);
const hash = value => createHash('sha256').update(value).digest('hex');

export function previewFile(root, url, directory = 'assets/items/official') {
    if (typeof url !== 'string' || !url.startsWith('/' + directory + '/') || /[\\?#\0]/.test(url)) throw new Error('Unsafe official preview asset path');
    const decoded = decodeURIComponent(url);
    const boundary = fs.realpathSync(path.join(root, directory)) + path.sep;
    const filename = path.resolve(root, '.' + decoded);
    const real = fs.realpathSync(filename);
    if (!filename.startsWith(boundary) || !real.startsWith(boundary) || !fs.statSync(real).isFile()) throw new Error('Official preview path escapes its imported directory');
    return real;
}

export function readOfficialItemPreviews({root = defaultRoot, snapshot, snapshotBytes} = {}) {
    root = path.resolve(root);
    snapshotBytes ||= fs.readFileSync(path.join(root, 'data/official-items.json'));
    snapshot ||= JSON.parse(snapshotBytes);
    const filename = path.join(root, PREVIEW_MANIFEST_PATH);
    if (!fs.existsSync(filename)) return {document: null, records: new Map(), manifestHash: null, partial: true};
    const bytes = fs.readFileSync(filename), document = JSON.parse(bytes);
    if (document.schemaVersion !== 1 || document.snapshotSha256 !== hash(snapshotBytes) || !Array.isArray(document.records) || typeof document.partial !== 'boolean') throw new Error('Official preview manifest does not match the current snapshot');
    const identities = new Set(snapshot.items.map(item => item.id)), records = new Map();
    for (const record of document.records) {
        if (!record || !identities.has(record.officialId) || records.has(record.officialId)) throw new Error('Missing, duplicate or unknown official preview identity');
        if (!statuses.has(record.status)) throw new Error('Unknown official preview status: ' + record.status);
        if (record.image !== null && record.image !== undefined) {
            if (!approved.has(record.status) || !record.image.endsWith('.svg')) throw new Error('An unverified model must not publish an official preview');
            const file = previewFile(root, record.image, 'assets/items/official/previews');
            const bytes = fs.readFileSync(file);
            if (bytes.length > MAX_PREVIEW_BYTES) throw new Error('Official preview exceeds the 750000-byte static SVG budget');
            if (!/^[a-f0-9]{64}$/.test(record.sha256 || '') || hash(bytes) !== record.sha256) throw new Error('Official preview SHA differs from its manifest: ' + record.officialId);
        }
        records.set(record.officialId, record);
    }
    if (records.size !== identities.size) throw new Error('Official preview manifest must cover every current item, including unavailable previews');
    return {document, records, manifestHash: hash(bytes), partial: document.partial === true};
}

export function resolveItemPreview(item, record) {
    if (record && record.association?.exact === true && approved.has(record.status) && record.image) return {image: record.image, status: record.status, sourceModelUrl: record.sourceModelUrl || null};
    // Both flags and identical official texture bytes are necessary. A single
    // plane using only part of an atlas is deliberately not a safe flat icon.
    if (record?.association?.exact === true && record.status === 'safe-flat' && record.nativeFlatVerified === true && record.source2DVerified === true && item.image
        && record.textures?.some(texture => texture.sha256 === item.imageSha256)) {
        return {image: item.image, status: 'safe-flat', sourceModelUrl: record.sourceModelUrl || null};
    }
    return {image: null, status: record?.status || 'preview-not-verified', sourceModelUrl: null};
}

export function getOfficialCatalogueVersion({root = defaultRoot} = {}) {
    const digest = createHash('sha256').update(fs.readFileSync(path.join(root, 'data/official-items.json')));
    const previews = path.join(root, PREVIEW_MANIFEST_PATH);
    if (fs.existsSync(previews)) digest.update(fs.readFileSync(previews));
    return digest.digest('hex').slice(0, 12);
}

export function getOfficialSearchVersion({root = defaultRoot} = {}) {
    return createHash('sha256').update(getOfficialCatalogueVersion({root}))
        .update(fs.readFileSync(path.join(root, 'js/global-search.js'))).digest('hex').slice(0, 12);
}

const tags = new Set(['svg', 'g', 'defs', 'clipPath', 'path', 'polygon', 'polyline', 'rect', 'circle', 'ellipse', 'line', 'image', 'use', 'title', 'desc', 'style', 'filter', 'feColorMatrix']);
export function validatePreviewSvg(source, textureHashes = null, parser) {
    if (/<!DOCTYPE|<!ENTITY|<\?(?!xml\s)[\s\S]*?\?>/i.test(source)) throw new Error('SVG must not define document types, entities or external processing instructions');
    const owner = parser ? null : new JSDOM('');
    parser ||= new owner.window.DOMParser();
    try {
        const document = parser.parseFromString(source, 'image/svg+xml');
        if (document.querySelector('parsererror') || document.documentElement.localName !== 'svg' || document.documentElement.namespaceURI !== 'http://www.w3.org/2000/svg') throw new Error('Invalid native SVG document');
        for (const element of document.querySelectorAll('*')) {
            if (!tags.has(element.localName) || element.namespaceURI !== 'http://www.w3.org/2000/svg') throw new Error('Unsupported or executable SVG element: ' + element.localName);
            if (element.localName === 'style' && /@import|javascript:|data:|https?:|\/\//i.test(element.textContent)) throw new Error('SVG style must not load external content');
            for (const attribute of element.attributes) {
                if (/^on/i.test(attribute.localName)) throw new Error('SVG event handlers are forbidden');
                const value = attribute.value;
                if (attribute.localName === 'href') {
                    if (/^#[a-z0-9_-]+$/i.test(value)) continue;
                    if (!/^data:image\/png;base64,[a-z0-9+/]+=*$/i.test(value)) throw new Error('SVG image URI must embed a native PNG or reference a local fragment');
                    const bytes = Buffer.from(value.slice(value.indexOf(',') + 1), 'base64');
                    if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('SVG image payload is not PNG');
                    if (textureHashes && !textureHashes.has(hash(bytes))) throw new Error('SVG embeds texture bytes absent from its native source evidence');
                } else if (attribute.localName !== 'xmlns' && attribute.prefix !== 'xmlns') {
                    if (/javascript:|@import|(?:https?|file|ftp):|\/\//i.test(value)) throw new Error('Executable or external SVG attribute URI');
                    for (const match of value.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) if (!/^#[a-z0-9_-]+$/i.test(match[2])) throw new Error('SVG attributes must not fetch external URLs');
                }
            }
        }
    } finally { owner?.window.close(); }
    return true;
}

export function auditOfficialItemPreviews({root = defaultRoot} = {}) {
    const errors = []; let checked = 0, available = 0;
    const dom = new JSDOM(''), parser = new dom.window.DOMParser();
    try {
        const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'data/official-items.json')));
        const previews = readOfficialItemPreviews({root, snapshot});
        if (!previews.document) throw new Error('Current official previews require an explicit availability manifest');
        let index = null;
        if (snapshot.items.some(item => resolveItemPreview(item, previews.records.get(item.id)).image)) {
            const expected = snapshot.source?.modelsIndex, recorded = previews.document.modelIndex;
            if (expected?.url !== 'https://saominecraft.com/item-models/index.json' || !/^[a-f0-9]{64}$/.test(expected.sha256 || '')
                || recorded?.url !== expected.url || recorded.sha256 !== expected.sha256) throw new Error('Preview model index must match the immutable current snapshot');
            const sources = previews.document.resources?.filter(resource => resource.kind === 'index' && resource.url === expected.url) || [];
            if (sources.length !== 1 || sources[0].sha256 !== expected.sha256) throw new Error('Preview model index requires one matching local source resource');
            const bytes = fs.readFileSync(previewFile(root, sources[0].path));
            if (hash(bytes) !== expected.sha256 || bytes.length !== sources[0].bytes) throw new Error('Official model index bytes differ from current source evidence');
            index = JSON.parse(bytes);
        }
        for (const item of snapshot.items) {
            const record = previews.records.get(item.id);
            try {
                const selected = resolveItemPreview(item, record);
                if (record.image && record.association?.exact !== true) throw new Error('A model preview requires an exact current official identity association');
                if (record.source2DVerified === true && (record.nativeFlatVerified !== true || !record.textures?.some(texture => texture.sha256 === item.imageSha256))) throw new Error('Safe raw preview proof does not match the native whole texture');
                if (selected.image) {
                    if (!record.sourceModelUrl?.startsWith('https://') || !/^[a-f0-9]{64}$/.test(record.sourceModelSha256 || '')) throw new Error('Rendered preview must identify its current source model');
                    const modelBytes = fs.readFileSync(previewFile(root, record.sourceModelPath));
                    if (hash(modelBytes) !== record.sourceModelSha256) throw new Error('Native model SHA differs from preview source evidence');
                    const modelResources = previews.document.resources?.filter(resource => resource.kind === 'model' && resource.url === record.sourceModelUrl) || [];
                    if (modelResources.length !== 1 || modelResources[0].path !== record.sourceModelPath || modelResources[0].sha256 !== record.sourceModelSha256
                        || modelResources[0].bytes !== modelBytes.length) throw new Error('Selected native model differs from its acquired public resource evidence');
                    const model = JSON.parse(modelBytes);
                    if (!Array.isArray(record.textures) || !record.textures.length) throw new Error('Rendered preview must identify its native textures');
                    if (!Array.isArray(model.tex) || model.tex.length !== record.textures.length) throw new Error('Preview textures must match the selected native model');
                    const textureHashes = new Set();
                    for (const [position, texture] of record.textures.entries()) {
                        const textureName = model.tex[position];
                        if (typeof textureName !== 'string' || !/^[-a-z0-9_/]+\.png$/i.test(textureName) || textureName.split('/').some(part => part === '..' || !part)) throw new Error('Native model references an unsafe texture');
                        const sourceUrl = 'https://saominecraft.com/item-models/t/' + textureName.split('/').map(encodeURIComponent).join('/');
                        if (texture.url !== sourceUrl) throw new Error('Preview texture URL differs from its native model reference');
                        const bytes = fs.readFileSync(previewFile(root, texture.path));
                        if (hash(bytes) !== texture.sha256 || (texture.bytes != null && bytes.length !== texture.bytes)) throw new Error('Native texture SHA differs from preview source evidence');
                        const textureResources = previews.document.resources?.filter(resource => resource.kind === 'texture' && resource.url === texture.url) || [];
                        if (textureResources.length !== 1 || textureResources[0].path !== texture.path || textureResources[0].sha256 !== texture.sha256
                            || textureResources[0].bytes !== bytes.length) throw new Error('Selected native texture differs from its acquired public resource evidence');
                        textureHashes.add(texture.sha256);
                    }
                    const proof = nativeModelIdentityProof(index, item, {sourceModelUrl: record.sourceModelUrl, sourceModelSha256: hash(modelBytes), textureHashes: [...textureHashes]});
                    if (!proof.exact || proof.model?.url !== record.sourceModelUrl) throw new Error('Preview identity is not independently corroborated by the current official index and native bytes');
                    for (const field of ['model', 'evidence', 'conflicts', 'reason']) if (JSON.stringify(record.association[field]) !== JSON.stringify(proof[field])) throw new Error('Recorded preview identity evidence differs from independently verified source proof');
                    for (const field of ['elements', 'sourceFaces', 'projectedFragments']) if (!Number.isSafeInteger(record.geometry?.[field]) || record.geometry[field] < 0) throw new Error('Native preview geometry evidence is missing or invalid');
                    if (record.geometry.elements > MAX_SOURCE_ELEMENTS || record.geometry.projectedFragments > MAX_PROJECTED_FRAGMENTS) throw new Error('Native preview exceeds the recorded geometry budget');
                    if (record.image) validatePreviewSvg(fs.readFileSync(previewFile(root, record.image, 'assets/items/official/previews'), 'utf8'), textureHashes, parser);
                    else if (hash(fs.readFileSync(previewFile(root, item.image))) !== item.imageSha256) throw new Error('Verified flat PNG differs from its native source');
                    if (record.status === 'safe-flat' && record.nativeFlatVerified !== true) throw new Error('Safe flat preview is not verified as a native plane');
                }
                if (selected.image) available++;
                checked++;
            } catch (error) { errors.push(item.id + ': ' + error.message); }
        }
        return {errors, checked, available, partial: previews.partial};
    } catch (error) { errors.push(error.message); return {errors, checked, available}; }
    finally { dom.window.close(); }
}

export function assertCompleteOfficialItemPreviews({root = defaultRoot} = {}) {
    const previews = readOfficialItemPreviews({root});
    if (!previews.document || previews.partial || [...previews.records.values()].some(record => record.status === 'pending')) throw new Error('Publication requires a complete official preview manifest; sample, absent or pending previews cannot update the catalogue');
    const audit = auditOfficialItemPreviews({root});
    if (audit.errors.length) throw new Error('Official preview audit failed: ' + audit.errors.join('; '));
    return audit;
}
