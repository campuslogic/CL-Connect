/**
 * core/overlay.js — the "busy" blocker, driven by the live request count.
 *
 * A fully transparent blocker (it blocks input, it darkens nothing) with a wait cursor, plus a
 * centred box holding a spinner and "Loading". All of the visual detail is Content/app.css §2;
 * this file is behaviour only.
 */

import * as http from './http.js';

const FADE_OUT = 400;
const SHOW_DELAY = 120;    // see the note in show()

let overlayEl = null;
let boxEl = null;
let depth = 0;
let showTimer = 0;
let hideTimer = 0;

function build() {
    if (overlayEl) {
        return;
    }
    overlayEl = document.createElement('div');
    overlayEl.className = 'cl-busy';
    overlayEl.hidden = true;

    boxEl = document.createElement('div');
    boxEl.className = 'cl-busy-box';
    boxEl.hidden = true;
    boxEl.innerHTML = '<div class="cl-busy-msg">'
        + '<div class="cl-spinner" role="progressbar" aria-label="Loading"></div>'
        + '<h2>Loading</h2>'
        + '</div>';

    document.body.append(overlayEl, boxEl);
}

function reveal() {
    build();
    clearTimeout(hideTimer);
    overlayEl.hidden = false;
    boxEl.hidden = false;
    // A transition does not run from a just-unhidden element in the same frame.
    requestAnimationFrame(() => {
        if (depth > 0) {
            overlayEl.classList.add('is-in');
            boxEl.classList.add('is-in');
        }
    });
}

function conceal() {
    if (!overlayEl) {
        return;
    }
    clearTimeout(showTimer);
    showTimer = 0;
    overlayEl.classList.remove('is-in');
    boxEl.classList.remove('is-in');
    // Hide only after the fade, so the box is not display:none mid-transition and is not
    // left hit-testable afterwards.
    hideTimer = setTimeout(() => {
        if (depth === 0) {
            overlayEl.hidden = true;
            boxEl.hidden = true;
        }
    }, FADE_OUT);
}

/**
 * Reference-counted, so two concurrent requests cannot clear the overlay early.
 *
 * The SHOW_DELAY matters: localhost round trips are often under 30ms, and without it the box
 * strobes on every keystroke-triggered validation call.
 */
function show() {
    depth++;
    if (depth === 1 && !showTimer) {
        showTimer = setTimeout(() => {
            showTimer = 0;
            if (depth > 0) {
                reveal();
            }
        }, SHOW_DELAY);
    }
}

function hide() {
    depth = Math.max(0, depth - 1);
    if (depth === 0) {
        conceal();
    }
}

/** Binds the overlay to the live request count. Called once, from main.js. */
export function start() {
    let last = 0;
    document.addEventListener(http.BUSY_EVENT, (event) => {
        const requests = event.detail;
        if (requests > 0 && last === 0) {
            show();
        } else if (requests === 0 && last > 0) {
            hide();
        }
        last = requests;
    });
}
