// One public projection for legacy game data. Archives never enter the build.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const HISTORICAL_QUEST_STATUS = 'historical-unverified';
export const ARCHIVE_DIRECTORY = 'data/archive/hybrid-2026-10-08';
export const COMBAT_FIELDS = new Set(['hp', 'health', 'damage', 'damages', 'defense', 'defence', 'attack', 'speed', 'level', 'niveau', 'pv']);
const creatureFields = ['id', 'name', 'category', 'type', 'palier', 'location', 'description', 'image', 'drops'];

export function projectCreature(creature) {
    return Object.fromEntries(creatureFields.filter(key => Object.hasOwn(creature, key)).map(key => [key, creature[key]]));
}

export function isPublishedQuest(quest) {
    return (quest.type ?? quest.category) === 'secondaire';
}

export function projectMapSource(source) {
    return {...source, questData: source.questData.filter(isPublishedQuest), questDataFloor2: source.questDataFloor2.filter(isPublishedQuest)};
}

export function assertNoCombatFields(value, location = 'public data') {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
        if (COMBAT_FIELDS.has(key.toLowerCase())) throw new Error('Unverified combat field at ' + location + '.' + key);
        assertNoCombatFields(child, location + '.' + key);
    }
}

// Explicit one-time operation, never run by a build. Existing snapshots cannot be replaced.
export function archiveLegacyContent(root) {
    const directory = path.join(root, ARCHIVE_DIRECTORY);
    if (fs.existsSync(directory)) throw new Error('Historical archive already exists; it is immutable');
    fs.mkdirSync(directory, {recursive: true});
    const files = ['js/bestiaire.js', 'pages/quetes.html', 'data/map-source.json',
        'js/i18n-en.js', 'js/i18n-en-reviewed.js', 'js/i18n-quests-en-reviewed.js', 'js/i18n-game-en-reviewed.js'];
    const records = files.map(file => {
        const bytes = fs.readFileSync(path.join(root, file));
        const target = path.join(directory, file);
        fs.mkdirSync(path.dirname(target), {recursive: true});
        fs.writeFileSync(target, bytes, {flag: 'wx'});
        return {source: file, archive: file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')};
    });
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({version: 1, date: '2026-10-08',
        reason: 'Unverified creature combat values and superseded main quests retained outside the public artifact.', files: records}, null, 2) + '\n', {flag: 'wx'});
    return records;
}

export function verifyHistoricalArchive(root) {
    const directory = path.join(root, ARCHIVE_DIRECTORY);
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
    for (const file of manifest.files) {
        const bytes = fs.readFileSync(path.join(directory, file.archive));
        if (bytes.length !== file.bytes || createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error('Historical archive changed: ' + file.archive);
    }
    return manifest;
}

if (process.argv[1] === import.meta.filename && process.argv.includes('--archive')) {
    const root = path.resolve(import.meta.dirname, '..');
    console.log('Archived ' + archiveLegacyContent(root).length + ' historical source files.');
}
