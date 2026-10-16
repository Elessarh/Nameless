import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {bindHomeItemPreviews,HOME_ITEM_PREVIEW_FALLBACK} from './home-item-previews.mjs';
import {readOfficialItemCatalogue} from './items-catalogue.mjs';

let checks = 0;
const check = (condition, message) => {assert.ok(condition, message); checks++;};
const preview = 'official/previews/' + 'a'.repeat(64) + '.svg';
const catalogue = {items: [{id: 'current', officialId: 'official_current', name: 'Do not resolve by display name', image: preview}, {id: 'neutral', officialId: 'official_neutral', image: null}], aliases: {legacy: 'current'}};
const original = '\uFEFF<!doctype html>\r\n<!-- Keep exact authoring: é &amp; <> -->\r\n<div data-home-record="item:current"><img ALT="é &amp; œ" SRC = \'/stale.svg\' width="256"></div>\r\n<span data-home-item-source="legacy"><img src=/another-stale.svg decoding="async"></span>\r\n<a data-home-record="item:neutral" href="/items?item=neutral"><img src="/old-neutral.png"></a>\r\n<div data-home-record="item:unknown"><img src="/preserve-unknown.svg"></div>\r\n<div data-home-record="boss:53"><img src="/preserve-boss.svg"></div>';
const expected = original.replace('/stale.svg', '/assets/items/' + preview).replace('/another-stale.svg', '/assets/items/' + preview).replace('/old-neutral.png', HOME_ITEM_PREVIEW_FALLBACK);
const bound = bindHomeItemPreviews(original, {catalogue});
check(bound === expected, 'Only bound src values change; BOM, CRLF, quotes, whitespace, text, attributes and unrelated records remain exact');
check(bindHomeItemPreviews(bound, {catalogue}) === bound, 'Current home preview bindings are idempotent');
check(bindHomeItemPreviews('<main>No home item binding</main>') === '<main>No home item binding</main>', 'Unmarked routes pass through without a catalogue or HTML reserialization');
const named = '<a data-home-record="item:Do not resolve by display name"><img src="/do-not-guess.svg"></a>';
check(bindHomeItemPreviews(named, {catalogue}) === named, 'An unverified display name never becomes an item identity');
const official = '<img data-home-item-source="official_current" src="/old.svg">';
check(bindHomeItemPreviews(official, {catalogue}) === official.replace('/old.svg', '/assets/items/' + preview), 'The exact official identity resolves as well as a reviewed legacy alias');
assert.throws(() => bindHomeItemPreviews('<span data-home-item-source="current"><img src="/x.svg"><img src="/y.svg"></span>', {catalogue}), /exactly one preview/);checks++;
assert.throws(() => bindHomeItemPreviews('<span data-home-item-source="current"><img></span>', {catalogue}), /authored src/);checks++;
assert.throws(() => bindHomeItemPreviews('<span data-home-item-source="current" data-home-record="item:neutral"><img src="/x.svg"></span>', {catalogue}), /Conflicting home item/);checks++;
assert.throws(() => bindHomeItemPreviews('<span data-home-item-source="current"><img src="/x.svg"></span>', {catalogue: {items: [{id: 'current', image: '../private.png'}]}}), /Unsafe or unverified/);checks++;
const current = readOfficialItemCatalogue();
const home = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
check(bindHomeItemPreviews(home, {catalogue: current}) === home, 'The authored home source already uses all current verified previews');
const dom = new JSDOM(home);
try {
    const staff = dom.window.document.querySelector('[data-home-record="item:official_staff_shaman_cdd7df5be782dd4d"] img');
    check(Boolean(staff), 'The featured staff has an explicit verified identity binding');
    const path = staff.getAttribute('src');
    const stale = home.replace(path, '/assets/items/official/previews/' + 'f'.repeat(64) + '.svg');
    check(bindHomeItemPreviews(stale, {catalogue: current}) === home, 'A future preview regeneration updates the featured staff by identity, without preserving its obsolete SVG hash');
} finally {dom.window.close();}
console.log('Home item previews: ' + checks + ' checks passed; current identities, neutral previews, exact HTML preservation and regeneration safety.');
