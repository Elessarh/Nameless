/* Guild dates use the same Europe/Paris calendar for every member. */
(function (global) {
    'use strict';
    var timeZone = 'Europe/Paris';
    var calendar = new Intl.DateTimeFormat('en-CA', {
        timeZone: timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    });
    function parts(date) {
        var value = date instanceof Date ? date : new Date(date == null ? Date.now() : date);
        if (!Number.isFinite(value.getTime())) throw new RangeError('Invalid date');
        var result = {};
        calendar.formatToParts(value).forEach(function (part) {
            if (part.type !== 'literal') result[part.type] = part.value;
        });
        return result;
    }
    function dateKey(date) {
        var p = parts(date);
        return p.year + '-' + p.month + '-' + p.day;
    }
    function isoWeek(date) {
        var p = parts(date);
        var thursday = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)));
        thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
        var year = thursday.getUTCFullYear();
        var yearStart = new Date(Date.UTC(year, 0, 1));
        return { year: year, week: Math.ceil(((thursday - yearStart) / 86400000 + 1) / 7) };
    }
    function dateInputToISOString(value) {
        var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value || ''));
        if (!match) throw new RangeError('Invalid event date');
        var wanted = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
        if (new Date(wanted).toISOString().slice(0, 16) !== value) throw new RangeError('Invalid event date');
        var offsets = new Set();
        [-86400000, 0, 86400000].forEach(function (delta) {
            var instant = wanted + delta;
            var p = parts(new Date(instant));
            offsets.add(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second)) - instant);
        });
        var candidates = [];
        offsets.forEach(function (offset) {
            var instant = new Date(wanted - offset);
            var p = parts(instant);
            if (p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute === value) candidates.push(instant);
        });
        // Reject the missing hour at the spring daylight-saving transition.
        if (!candidates.length) throw new RangeError('This time does not exist in Europe/Paris');
        candidates.sort(function (a, b) { return a - b; });
        return candidates[0].toISOString();
    }
    global.NamelessGuildDates = Object.freeze({
        timeZone: timeZone, dateKey: dateKey, isoWeek: isoWeek,
        dateInputToISOString: dateInputToISOString
    });
})(window);
