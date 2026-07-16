#!/usr/bin/env node
/* DOM regression test for the compact persistent audio player. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const root = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/audio-controller.js'), 'utf8');

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://nameless-sao.fr/',
    runScripts: 'outside-only',
    pretendToBeVisual: true
});
const { window } = dom;
let language = 'fr';

class FakeAudio extends window.EventTarget {
    constructor() {
        super();
        this.currentTime = 0;
        this.duration = Number.NaN;
        this.loop = false;
        this.paused = true;
        this.preload = 'none';
        this.src = '';
        this.volume = 1;
    }

    play() {
        this.paused = false;
        return Promise.resolve();
    }

    pause() {
        this.paused = true;
    }
}

window.Audio = FakeAudio;
window.NamelessI18n = { getLanguage: () => language };
window.eval(source);
window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

const wait = () => new Promise((resolve) => setTimeout(resolve, 0));
const equal = (actual, expected, label) => {
    if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
};

const dock = window.document.querySelector('.nm-audio-dock');
if (!dock) throw new Error('Audio dock was not created.');

const toggle = dock.querySelector('.nm-audio-btn');
const previous = dock.querySelector('.nm-audio-prev');
const next = dock.querySelector('.nm-audio-next');
const label = dock.querySelector('.nm-audio-label');
const index = dock.querySelector('.nm-audio-track-index');
const audio = window.NamelessAudioPlayer.audio;

equal(label.textContent, 'Oath', 'Initial track title');
equal(index.textContent, '1 / 3', 'Initial track index');
equal(previous.getAttribute('aria-label'), 'Piste précédente : Echoes II', 'French previous-track label');
equal(next.getAttribute('aria-label'), 'Piste suivante : Echoes I', 'French next-track label');

next.click();
equal(label.textContent, 'Echoes I', 'Next track title');
equal(index.textContent, '2 / 3', 'Next track index');
equal(window.localStorage.getItem('namelessAudioTrack'), 'echoes-1', 'Persisted next track');

previous.click();
equal(label.textContent, 'Oath', 'Previous track title');
equal(index.textContent, '1 / 3', 'Previous track index');

toggle.click();
await wait();
if (!toggle.classList.contains('is-on') || audio.paused) throw new Error('Play toggle did not start playback.');

audio.duration = 240;
audio.currentTime = 60;
audio.dispatchEvent(new window.Event('timeupdate'));
equal(dock.querySelector('.nm-audio-current-time').textContent, '1:00', 'Elapsed time');
equal(dock.querySelector('.nm-audio-duration').textContent, '4:00', 'Track duration');
equal(dock.querySelector('.nm-audio-progress i').style.width, '25%', 'Progress bar');

audio.dispatchEvent(new window.Event('ended'));
await wait();
equal(label.textContent, 'Echoes I', 'Automatic next track');
if (audio.paused) throw new Error('Playback did not continue after automatic track change.');

language = 'en';
window.document.dispatchEvent(new window.CustomEvent('nameless:languagechange', { detail: { language: 'en' } }));
equal(previous.getAttribute('aria-label'), 'Previous track: Oath', 'English previous-track label');
equal(next.getAttribute('aria-label'), 'Next track: Echoes II', 'English next-track label');

console.log('Audio player DOM test passed: title, track count, progress, previous/next controls, auto-advance and bilingual labels.');
