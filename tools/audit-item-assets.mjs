#!/usr/bin/env node
// Item replacement audit: immutable catalogue references and independently decoded PNG pixels.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const defaultRoot = path.resolve(import.meta.dirname, '..');
const manifestRelativePath = 'docs/item-assets-2026-10-07/integration-manifest.json';
const itemCount = 104;
const maxDimension = 128;
const maxBytes = 65536;
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

// Read the catalogue data alone; do not execute the page or its lifecycle.
function readLiteral(source, name) {
    const declaration = new RegExp('\\b(?:const|let|var)\\s+' + name + '\\s*=\\s*').exec(source);
    if (!declaration) throw new Error('Missing catalogue data: ' + name);
    const start = declaration.index + declaration[0].length;
    if (!['[', '{'].includes(source[start])) throw new Error('Expected catalogue literal: ' + name);
    const stack = [];
    let quote = '', escaped = false, lineComment = false, blockComment = false;
    for (let i = start; i < source.length; i++) {
        const char = source[i], next = source[i + 1];
        if (lineComment) { if (char === '\n') lineComment = false; continue; }
        if (blockComment) { if (char === '*' && next === '/') { blockComment = false; i++; } continue; }
        if (quote) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === quote) quote = '';
            continue;
        }
        if (char === '/' && next === '/') { lineComment = true; i++; continue; }
        if (char === '/' && next === '*') { blockComment = true; i++; continue; }
        if (char === '"' || char === "'") { quote = char; continue; }
        if (char === '`') throw new Error('Template expressions are not catalogue literals: ' + name);
        if (char === '[' || char === '{') stack.push(char);
        if (char === ']' || char === '}') {
            const open = stack.pop();
            if ((char === ']' && open !== '[') || (char === '}' && open !== '{')) throw new Error('Invalid catalogue literal: ' + name);
            if (!stack.length) {
                const context = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
                return vm.runInContext('(' + source.slice(start, i + 1) + ')', context, { timeout: 1000 });
            }
        }
    }
    throw new Error('Unclosed catalogue literal: ' + name);
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
    for (let bit = 0; bit < 8; bit++) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    return value >>> 0;
});
function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}
function paeth(left, up, upperLeft) {
    const prediction = left + up - upperLeft;
    const a = Math.abs(prediction - left), b = Math.abs(prediction - up), c = Math.abs(prediction - upperLeft);
    return a <= b && a <= c ? left : b <= c ? up : upperLeft;
}

export function decodeItemPng(bytes) {
    if (!Buffer.isBuffer(bytes)) throw new Error('PNG input must be a Buffer');
    if (bytes.length > maxBytes) throw new Error('PNG exceeds 65536 bytes');
    if (bytes.length < 8 || !bytes.subarray(0, 8).equals(pngSignature)) throw new Error('Invalid PNG signature');
    let offset = 8, header = null, ended = false, idatStarted = false, idatEnded = false, paletteSeen = false;
    const compressed = [];
    while (offset < bytes.length) {
        if (bytes.length - offset < 12) throw new Error('Truncated PNG chunk');
        const length = bytes.readUInt32BE(offset);
        if (length > bytes.length - offset - 12) throw new Error('PNG chunk extends beyond file');
        const typeBytes = bytes.subarray(offset + 4, offset + 8);
        const type = typeBytes.toString('ascii');
        if (!typeBytes.every(byte => (byte >= 65 && byte <= 90) || (byte >= 97 && byte <= 122)) || !(typeBytes[2] >= 65 && typeBytes[2] <= 90)) throw new Error('Invalid PNG chunk type');
        const data = bytes.subarray(offset + 8, offset + 8 + length);
        if (crc32(bytes.subarray(offset + 4, offset + 8 + length)) !== bytes.readUInt32BE(offset + 8 + length)) throw new Error('CRC mismatch in ' + type);
        if (!header && type !== 'IHDR') throw new Error('IHDR must be the first PNG chunk');
        if (type === 'IHDR') {
            if (header || length !== 13) throw new Error('Invalid or repeated IHDR');
            const width = data.readUInt32BE(0), height = data.readUInt32BE(4);
            if (width < 1 || height < 1 || width > maxDimension || height > maxDimension) throw new Error('PNG dimensions must be 1..128');
            if (data[8] !== 8 || data[9] !== 6 || data[10] !== 0 || data[11] !== 0 || data[12] !== 0) throw new Error('PNG must use noninterlaced RGBA8 with standard compression/filter methods');
            header = { width, height };
        } else if (type === 'IDAT') {
            if (idatEnded) throw new Error('PNG IDAT chunks must be consecutive');
            idatStarted = true;
            compressed.push(data);
        } else {
            if (idatStarted) idatEnded = true;
            if (type === 'IEND') {
                if (length !== 0 || !idatStarted) throw new Error('Invalid IEND or missing IDAT');
                ended = true;
            } else if (type === 'PLTE') {
                if (paletteSeen || idatStarted || !length || length > 768 || length % 3) throw new Error('Invalid PNG palette');
                paletteSeen = true;
            } else if (type === 'tRNS' || type === 'acTL' || type === 'fcTL' || type === 'fdAT') {
                throw new Error('Unsupported transparency or animation chunk: ' + type);
            } else if (typeBytes[0] >= 65 && typeBytes[0] <= 90) {
                throw new Error('Unknown critical PNG chunk: ' + type);
            }
        }
        offset += 12 + length;
        if (ended) {
            if (offset !== bytes.length) throw new Error('Data after PNG IEND');
            break;
        }
    }
    if (!header || !ended) throw new Error('Incomplete PNG');
    const stride = header.width * 4;
    const expectedLength = (stride + 1) * header.height;
    const compressedBytes = Buffer.concat(compressed);
    const result = zlib.inflateSync(compressedBytes, { maxOutputLength: expectedLength, info: true });
    if (result.engine.bytesWritten !== compressedBytes.length) throw new Error('Trailing data in PNG zlib stream');
    const filtered = result.buffer;
    if (filtered.length !== expectedLength) throw new Error('PNG pixel stream length differs from dimensions');
    const rgba = Buffer.alloc(stride * header.height);
    for (let row = 0; row < header.height; row++) {
        const sourceOffset = row * (stride + 1), rowOffset = row * stride;
        const filter = filtered[sourceOffset];
        if (filter > 4) throw new Error('Invalid PNG row filter: ' + filter);
        for (let column = 0; column < stride; column++) {
            const left = column >= 4 ? rgba[rowOffset + column - 4] : 0;
            const up = row ? rgba[rowOffset + column - stride] : 0;
            const upperLeft = row && column >= 4 ? rgba[rowOffset + column - stride - 4] : 0;
            const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : paeth(left, up, upperLeft);
            rgba[rowOffset + column] = (filtered[sourceOffset + 1 + column] + predictor) & 255;
        }
    }
    let transparentPixels = 0, partialAlphaPixels = 0;
    for (let alpha = 3; alpha < rgba.length; alpha += 4) {
        if (rgba[alpha] === 0) transparentPixels++;
        else if (rgba[alpha] < 255) partialAlphaPixels++;
    }
    const cornerAlphas = [3, (header.width - 1) * 4 + 3, (header.height - 1) * stride + 3, rgba.length - 1].map(index => rgba[index]);
    return { ...header, transparentPixels, partialAlphaPixels, rgbaSha256: sha256(rgba), cornerAlphas };
}

function within(directory, filename) {
    const relative = path.relative(directory, filename);
    return relative !== '' && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}
function safeTarget(root, targetPath) {
    if (typeof targetPath !== 'string' || !targetPath.startsWith('assets/items/') || targetPath.includes('\\') || targetPath.includes('\0') || !targetPath.endsWith('.png')) throw new Error('Invalid item target path');
    const assets = fs.realpathSync(path.join(root, 'assets/items'));
    const filename = path.resolve(root, targetPath);
    if (!within(assets, filename)) throw new Error('Item path leaves assets/items');
    const real = fs.realpathSync(filename);
    if (!within(assets, real) || !fs.statSync(real).isFile()) throw new Error('Item target is not a file within assets/items');
    return real;
}

export function auditItemAssets({ root = defaultRoot, manifestPath = path.join(root, manifestRelativePath) } = {}) {
    const errors = [];
    let manifest, catalogue;
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        catalogue = readLiteral(fs.readFileSync(path.join(root, 'js/items-catalog-hdv.js'), 'utf8'), 'itemsCatalog');
    } catch (error) {
        return { errors: ['Cannot load item audit inputs: ' + error.message], checked: 0, cornerTouchingItems: 0 };
    }
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return { errors: ['Integration manifest must be an object'], checked: 0, cornerTouchingItems: 0 };
    const items = [];
    try {
        if (!catalogue || typeof catalogue !== 'object' || Array.isArray(catalogue)) throw new Error('Catalogue must be an object');
        for (const [category, group] of Object.entries(catalogue)) {
            if (!group || typeof group.name !== 'string' || !Array.isArray(group.items)) throw new Error('Invalid catalogue group: ' + category);
            for (const item of group.items) {
                if (!item || ['id', 'name', 'image', 'rarity'].some(field => typeof item[field] !== 'string' || !item[field])) throw new Error('Invalid item fields in catalogue group: ' + category);
                items.push({ ...item, category, categoryName: group.name });
            }
        }
    } catch (error) {
        return { errors: ['Invalid catalogue data: ' + error.message], checked: 0, cornerTouchingItems: 0 };
    }
    const records = manifest.records;
    if (!Array.isArray(records)) return { errors: ['Integration manifest must contain a records array'], checked: 0, cornerTouchingItems: 0 };
    if (items.length !== itemCount) errors.push('Catalogue must contain exactly 104 items');
    if (records.length !== itemCount) errors.push('Manifest must contain exactly 104 item records');
    const catalogueIds = new Set(), recordIds = new Set(), targets = new Set();
    for (const item of items) {
        if (typeof item.id !== 'string' || !item.id || catalogueIds.has(item.id)) errors.push('Missing or duplicate catalogue item ID: ' + item.id);
        catalogueIds.add(item.id);
    }
    let checked = 0, cornerTouchingItems = 0;
    for (const record of records) {
        try {
            if (!record || typeof record !== 'object' || typeof record.itemId !== 'string' || !record.itemId) throw new Error('Missing item ID');
            if (recordIds.has(record.itemId)) throw new Error('Duplicate manifest item ID');
            recordIds.add(record.itemId);
            const item = items.find(candidate => candidate.id === record.itemId);
            if (!item) throw new Error('Manifest item ID no longer exists in catalogue');
            for (const [field, current] of [['itemName', item.name], ['catalogueCategory', item.category], ['catalogueCategoryName', item.categoryName], ['rarity', item.rarity], ['catalogueImageOriginal', item.image]]) {
                if (record[field] !== current) throw new Error('Catalogue ' + field + ' changed or is absent from manifest');
            }
            const expectedPath = 'assets/items/' + decodeURIComponent(item.image);
            if (record.targetPath !== expectedPath) throw new Error('Target differs from original catalogue image URL');
            if (targets.has(record.targetPath)) throw new Error('Duplicate manifest target');
            targets.add(record.targetPath);
            const filename = safeTarget(root, record.targetPath);
            if (fs.statSync(filename).size > maxBytes) throw new Error('PNG exceeds 65536 bytes');
            const bytes = fs.readFileSync(filename);
            const actual = { bytes: bytes.length, sha256: sha256(bytes), ...decodeItemPng(bytes) };
            if (!actual.transparentPixels) throw new Error('Cleaned item PNG must contain fully transparent pixels');
            const after = record.after;
            if (!after || typeof after !== 'object') throw new Error('Missing expected after metrics');
            for (const field of ['sha256', 'rgbaSha256']) {
                if (typeof after[field] !== 'string' || !/^[a-f0-9]{64}$/.test(after[field])) throw new Error('Invalid expected ' + field);
            }
            for (const field of ['bytes', 'width', 'height', 'transparentPixels', 'partialAlphaPixels']) {
                if (!Number.isSafeInteger(after[field]) || after[field] < 0) throw new Error('Invalid expected ' + field);
            }
            for (const field of ['sha256', 'bytes', 'width', 'height', 'transparentPixels', 'partialAlphaPixels', 'rgbaSha256']) {
                if (after[field] !== actual[field]) throw new Error('Live PNG ' + field + ' differs from integration manifest');
            }
            // A tightly cropped object may touch a corner; count this without rejecting valid artwork.
            if (actual.cornerAlphas.some(alpha => alpha !== 0)) cornerTouchingItems++;
            checked++;
        } catch (error) {
            errors.push((record?.itemId || '(unknown item)') + ': ' + error.message);
        }
    }
    for (const id of catalogueIds) if (!recordIds.has(id)) errors.push('Catalogue item absent from manifest: ' + id);
    if (recordIds.size !== itemCount || targets.size !== itemCount) errors.push('Manifest must cover 104 unique item IDs and targets');
    return { errors, checked, cornerTouchingItems };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = auditItemAssets();
    if (result.errors.length) {
        console.error('Item-asset audit failed (' + result.errors.length + ' issue(s)):');
        result.errors.forEach(error => console.error('- ' + error));
        process.exitCode = 1;
    } else {
        console.log('Item-asset audit passed: ' + result.checked + ' immutable catalogue targets; PNG CRC, RGBA pixels and alpha counts match the manifest (' + result.cornerTouchingItems + ' item(s) touch a corner).');
    }
}
