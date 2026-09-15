/**
 * core/router.js — hash routing.
 *
 * The hash shape is fixed: '#/environment', no hashbang. Support documentation and bookmarks
 * reference these paths, so they must not change. Everything after '?' in the hash is ignored, and
 * location.search is never written — writing it triggers a full page reload.
 */

import * as dom from './dom.js';
import * as http from './http.js';

const routes = new Map();
let otherwisePath = '';
let view = null;
let navigation = 0;
let currentTeardown = null;

/**
 * route('/environment', { template, resolve, page })
 *   template  relative URL of the Razor partial, resolved against <base href>
 *   resolve   { name: () => value|Promise } — all awaited before mount
 *   page      () => import('../pages/environment.js'); its mount(view, locals) may return a
 *             teardown function, which is called before the next navigation
 *
 * A route registered with no definition clears #view and mounts nothing.
 */
export function route(path, def) {
    routes.set(path, def || {});
}

/** Where an unknown hash goes. */
export function otherwise(path = '') {
    otherwisePath = path;
}

function parse() {
    return location.hash.replace(/^#/, '').split('?')[0] || '/';
}

/** Navigates. Never emits a query, and never touches location.search. */
export function go(path) {
    const next = '#' + path;
    if (location.hash === next) {
        onChange();
    } else {
        location.hash = next;
    }
}

function teardown() {
    if (!currentTeardown) {
        return;
    }
    try {
        currentTeardown();
    } catch (e) {
        // One throwing page must not wedge the router.
        console.error('[router] teardown failed', e);
    }
    currentTeardown = null;
}

async function onChange() {
    const path = parse();
    const def = routes.get(path);

    if (!def) {
        const fallback = otherwisePath || '/';
        if (path === fallback) {
            console.error('[router] no route for ' + path + ' and otherwise() points at it');
            return;
        }
        go(fallback);
        return;
    }

    // Stale-navigation guard. Clicking a second step link while the first template fetch is still
    // in flight would otherwise let the older response overwrite the newer page.
    const token = ++navigation;
    const keys = Object.keys(def.resolve || {});

    try {
        const [html, module, ...values] = await Promise.all([
            def.template ? http.text(def.template) : '',
            def.page ? def.page() : null,
            ...keys.map((key) => def.resolve[key]())
        ]);
        if (token !== navigation) {
            return;
        }

        // Everything is awaited first, so nothing is torn down for a navigation that then fails.
        teardown();

        // innerHTML, deliberately, not DOMParser: a wizard step's Razor response is a whole
        // <!DOCTYPE html> document, because each Setup view sets Layout = _LeftMenuLayout and is
        // served through PartialView, which still honours it. innerHTML drops the html/head/body
        // tags and hoists their contents, which is what the existing markup was written against.
        view.innerHTML = html;

        const locals = {};
        keys.forEach((key, i) => {
            locals[key] = values[i];
        });
        currentTeardown = module && typeof module.mount === 'function' ? module.mount(view, locals) : null;
    } catch (e) {
        if (token !== navigation) {
            return;
        }
        // The view is NOT swapped and the previous page stays mounted. Blanking it would turn a
        // transient API failure into a dead screen.
        console.error('[router] navigation to', path, 'failed', e);
    }
}

/**
 * Mounts the router on a container and performs the first navigation. Called once.
 *
 * The data-link listener is on `document` rather than on the view because the wizard shell is
 * re-fetched on every step, and its 21 step links must keep working without being re-wired.
 */
export function start(viewSelector) {
    if (view) {
        // A second call would add a duplicate hashchange listener and a duplicate data-link
        // delegate, so every navigation would run twice.
        throw new Error('[router] start() called twice');
    }
    view = document.querySelector(viewSelector);
    if (!view) {
        throw new Error('[router] view container not found: ' + viewSelector);
    }
    window.addEventListener('hashchange', onChange);
    dom.delegate(document, 'click', '[data-link]', (event, el) => {
        event.preventDefault();
        go(el.getAttribute('data-link'));
    });
    onChange();
}
