/**
 * core/dom.js — listeners that know how to remove themselves, plus the one way markup gets injected.
 *
 * Teardown is not decoration here: core/router.js replaces #view's contents on every navigation but
 * #view itself persists, so a listener attached to it would stack up once per step. Everything else
 * is a plain querySelector / addEventListener at the call site.
 */

/** Adds a listener and returns off(), so teardown is a list of calls rather than a bookkeeping table. */
export function on(el, type, handler, options) {
    el.addEventListener(type, handler, options);
    return () => el.removeEventListener(type, handler, options);
}

/**
 * Delegated listener: handler(event, matchedElement). Returns off().
 *
 * `root.contains(match)` is the part worth having in one place: `closest()` walks past `root` and
 * can match an ancestor outside it, so without the check a handler bound to a subtree — pages/shell.js
 * binds one to #view — also fires for a matching element in an open dialog. For a `document` root it
 * costs nothing and rules out targets already detached from the page.
 */
export function delegate(root, type, selector, handler, options) {
    const listener = (event) => {
        const match = event.target && event.target.closest ? event.target.closest(selector) : null;
        if (match && root.contains(match)) {
            handler(event, match);
        }
    };
    root.addEventListener(type, listener, options);
    return () => root.removeEventListener(type, listener, options);
}

/**
 * Replaces el's children with a Razor FRAGMENT (a modal body, the folder-picker markup) 
 *
 * Use this and not `innerHTML` for any markup that arrived over the wire. That is also what keeps a DOMXSS
 * scanner quiet: `innerHTML` is a potential vulnerability, this is not.
 *
 * FRAGMENTS ONLY. text/html parsing hoists a full document's <head>/<body> contents the way
 * innerHTML does, but it does NOT keep <head> content in document order relative to the body — so a
 * wizard step, which is a whole document (Layout = _LeftMenuLayout through PartialView), still goes
 * in through innerHTML in core/router.js. Table rows have the same caveat as innerHTML: a bare <tr>
 * at the top level is dropped by the parser either way.
 */
export function setFragment(el, html) {
    const doc = new DOMParser().parseFromString(html == null ? '' : String(html), 'text/html');
    // Spread first: replaceChildren moves the nodes, which would mutate the live childNodes list.
    el.replaceChildren(...document.adoptNode(doc.body).childNodes);
}
