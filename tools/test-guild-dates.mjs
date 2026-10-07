import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const scope = { window: {} };
vm.createContext(scope);
vm.runInContext(fs.readFileSync(new URL('../js/guild-date-utils.js', import.meta.url), 'utf8'), scope);
const dates = scope.window.NamelessGuildDates;
assert.equal(dates.dateKey('2026-10-06T22:30:00Z'), '2026-10-07');
assert.equal(dates.dateKey('2026-01-06T23:30:00Z'), '2026-01-07');
assert.equal(JSON.stringify(dates.isoWeek('2027-01-01T12:00:00Z')), '{"year":2026,"week":53}');
assert.equal(JSON.stringify(dates.isoWeek('2024-12-30T12:00:00Z')), '{"year":2025,"week":1}');
assert.equal(dates.dateInputToISOString('2026-10-07T20:30'), '2026-10-07T18:30:00.000Z');
assert.equal(dates.dateInputToISOString('2026-01-07T20:30'), '2026-01-07T19:30:00.000Z');
assert.equal(dates.dateInputToISOString('2026-10-25T02:30'), '2026-10-25T00:30:00.000Z');
assert.throws(() => dates.dateInputToISOString('2026-03-29T02:30'));
assert.throws(() => dates.dateInputToISOString('2026-02-30T12:00'));
assert.throws(() => dates.dateInputToISOString('2026-10-07T24:00'));
console.log('PASS: Paris calendar, ISO week/year, event timezone and daylight-saving validation (10 checks).');
