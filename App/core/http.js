/**
 * core/http.js — every request the app makes.
 *
 * Four quirks of this Web API shape the code below, and none of them are optional:
 *   - Failures usually answer 417 with an EMPTY body, and bodiless 200s exist too
 *     (TestWritePermissions). res.json() throws SyntaxError on both, so the body is always read
 *     as text first.
 *   - ValidateConfigurations is the exception: it answers 417 WITH a full
 *     ConfigurationValidationModel, which the save chain reads back off err.data.
 *   - A [LocalRequestOnly] rejection is 401 with {"Message":"..."} — capital M, because Web API's
 *     HttpError bypasses the camel-case resolver. Everything else on the wire is camelCase.
 *   - URLs must never start with '/'. See resolveUrl.
 */

/**
 * Fired on `document` whenever the live request count changes; event.detail is the new count.
 * core/overlay.js drives the busy overlay from it and pages/shell.js repaints the wizard menu.
 *
 * ORDERING, so this can be a trap if used incorrectly:
 *  this is dispatched from request()'s `finally`, which runs BEFORE any
 * `.then` handler the caller attached — the returned promise cannot resolve until the async
 * function has already returned. So a listener that repaints from state a response handler is
 * about to write sees the PREVIOUS values, every time. Anything painting from an async result must
 * be told by that result instead: the validators in services/validation.js return their promise for
 * exactly this reason, and pages/credentials.js, pages/smtp.js and pages/eventNotifications.js
 * repaint from it. Therefore DO NOT USE cl:busy as a signal that response-derived data is already applied.
 */
export const BUSY_EVENT = 'cl:busy';

let requests = 0;

function publishBusy() {
    document.dispatchEvent(new CustomEvent(BUSY_EVENT, { detail: requests }));
}

/**
 * Resolves a relative URL against <base href> (emitted by _Layout.cshtml) and appends
 * params as a query string. Never use a leading '/': the app can be hosted in an IIS
 * virtual directory, where '/api/...' would miss the application path entirely.
 */
function resolveUrl(url, params) {
    const u = new URL(url, document.baseURI);
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null) {
                u.searchParams.set(k, v);
            }
        }
    }
    return u.toString();
}

function toError(res, body) {
    const err = new Error();
    err.status = res.status;
    if (body) {
        try {
            err.data = JSON.parse(body);
        } catch (e) {
            err.data = body;
        }
    }
    const d = err.data;
    err.message = (d && typeof d === 'object' && (d.Message || d.message))
        || (typeof d === 'string' && d.slice(0, 300))
        || res.statusText
        || ('HTTP ' + res.status);
    return err;
}

async function request(url, options, params, as) {
    requests++;
    publishBusy();
    try {
        let res;
        try {
            res = await fetch(resolveUrl(url, params), {
                cache: 'no-store',
                credentials: 'same-origin',
                ...options
            });
        } catch (e) {
            const netErr = new Error('Network error');
            netErr.status = 0;
            netErr.cause = e;
            throw netErr;
        }

        // ALWAYS text first. A bodiless 417 and a bodiless 200 both hand back '', and
        // res.json() would throw SyntaxError on either.
        const body = await res.text();
        if (!res.ok) {
            throw toError(res, body);
        }
        if (as === 'text') {
            return body;
        }
        if (!body) {
            return null;
        }
        try {
            return JSON.parse(body);
        } catch (e) {
            // A Razor/IIS HTML error page. Hand it back rather than throwing an opaque
            // SyntaxError, so the caller sees what actually arrived.
            return body;
        }
    } finally {
        requests = Math.max(0, requests - 1);
        publishBusy();
    }
}

/** GET returning parsed JSON (or null for an empty body). */
export function get(url, params) {
    return request(url, { method: 'GET' }, params, 'json');
}

/** GET returning raw text — route templates and modal templates. Counted, so the overlay covers navigation. */
export function text(url, params) {
    return request(url, { method: 'GET' }, params, 'text');
}

/** POST with an optional JSON body. Omitting the body sends no Content-Type (ArchiveWebConfig takes none). */
export function post(url, body, params) {
    const options = { method: 'POST' };
    if (body !== undefined) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(body);
    }
    return request(url, options, params, 'json');
}
