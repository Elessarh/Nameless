import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const archive = 'data/archive/hybrid-2026-10-08';
const manifest = JSON.parse(fs.readFileSync(path.join(root, archive, 'manifest.json'), 'utf8'));
const attributes = fs.readFileSync(path.join(root, '.gitattributes'), 'utf8');
assert.match(attributes, /^data\/archive\/\*\*\s+-text\s*$/m, 'Archive snapshots bypass text normalization');
for (const row of manifest.files) {
    const relative = `${archive}/${row.archive}`;
    const bytes = fs.readFileSync(path.join(root, relative));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256, 'Historical bytes stay unchanged');
    // Compare the object Git would create using attributes with the literal
    // file. No -w or index update: this check never stages or stores anything.
    const filtered = execFileSync('git', ['hash-object', `--path=${relative}`, relative], {cwd:root, encoding:'utf8'}).trim();
    const literal = execFileSync('git', ['hash-object', '--no-filters', relative], {cwd:root, encoding:'utf8'}).trim();
    assert.equal(filtered, literal, 'Git preserves the archive bytes for a future checkout: ' + relative);
}
console.log('Archive portability passed: 7 original hashes and Git clean filters preserve immutable snapshots.');
