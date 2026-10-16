// Bind the hand-authored home selection to verified current item identities.
// Only src values change: preserve source whitespace, attributes and legacy HTML.
import {JSDOM} from 'jsdom';

export const HOME_ITEM_PREVIEW_FALLBACK = '/assets/items/item-unavailable.svg';

export function bindHomeItemPreviews(html, {catalogue} = {}) {
    if (typeof html !== 'string') throw new Error('Home preview binding requires HTML text');
    if (!/\bdata-home-(?:record|item-source)\s*=/i.test(html)) return html;
    if (!catalogue || !Array.isArray(catalogue.items)) throw new Error('Home preview binding requires the verified item catalogue');
    const items = new Map();
    for (const item of catalogue.items) {
        for (const id of [item.id, item.officialId].filter(Boolean)) {
            if (items.has(id) && items.get(id) !== item) throw new Error('Ambiguous home item identity: ' + id);
            items.set(id, item);
        }
    }
    function resolve(id) {
        if (items.has(id)) return items.get(id);
        return Object.hasOwn(catalogue.aliases || {}, id) ? items.get(catalogue.aliases[id]) : null;
    }
    const dom = new JSDOM(html, {includeNodeLocations: true});
    const edits = new Map();
    try {
        for (const holder of dom.window.document.querySelectorAll('[data-home-record^="item:"], [data-home-item-source]')) {
            const recordId = holder.getAttribute('data-home-record')?.slice('item:'.length);
            const sourceId = holder.getAttribute('data-home-item-source');
            if (recordId && sourceId && recordId !== sourceId) throw new Error('Conflicting home item bindings');
            const item = resolve(sourceId || recordId);
            if (!item) continue; // An unverified or retired identity cannot select a replacement.
            const images = holder.matches('img') ? [holder] : holder.querySelectorAll('img');
            if (images.length !== 1) throw new Error('A bound home item requires exactly one preview image: ' + item.id);
            if (item.image !== null && (typeof item.image !== 'string' || !/^official\/(?:previews\/[a-f0-9]{64}\.svg|[a-f0-9]{32}\.png)$/.test(item.image))) throw new Error('Unsafe or unverified home item preview: ' + item.id);
            const image = images[0], next = item.image === null ? HOME_ITEM_PREVIEW_FALLBACK : '/assets/items/' + item.image;
            const location = dom.nodeLocation(image)?.attrs?.src;
            if (!location) throw new Error('A bound home item preview requires an authored src attribute: ' + item.id);
            const attribute = html.slice(location.startOffset, location.endOffset);
            const prefix = /^[^=]*=\s*/.exec(attribute);
            if (!prefix) throw new Error('Unrecognized home item preview src attribute');
            const quote = attribute[prefix[0].length];
            const quoted = quote === '"' || quote === "'";
            const start = location.startOffset + prefix[0].length + (quoted ? 1 : 0);
            const end = quoted ? location.endOffset - 1 : location.endOffset;
            const prior = edits.get(start);
            if (prior && prior.value !== next) throw new Error('One home preview cannot represent conflicting item identities');
            if (html.slice(start, end) !== next) edits.set(start, {start, end, value: next});
        }
    } finally { dom.window.close(); }
    for (const edit of [...edits.values()].sort((a, b) => b.start - a.start)) html = html.slice(0, edit.start) + edit.value + html.slice(edit.end);
    return html;
}
