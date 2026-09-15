/**
 * pages/menu.js — the home page's database size line and footer version.
 *
 * BOTH ENDPOINTS FAIL IN ORDINARY CONDITIONS: GetInfo answers 500 when the CampusLogicConnection
 * connection string is missing, and Version answers 417 with an empty body on any exception. Both
 * failures are swallowed on purpose, which leaves the <p> hidden and the footer reading a bare
 * "Version " — the behaviour this page has always had. Letting either reject would be a change.
 *
 * The two step links are handled by core/router.js's document-level data-link listener, so there is
 * nothing to wire and no teardown to return.
 */

import * as db from '../services/db.js';
import * as version from '../services/version.js';

export function mount(view) {
    const line = view.querySelector('#dbSizeLine');
    const size = view.querySelector('#dbSize');
    const appVersion = view.querySelector('#appVersion');

    db.getInfo().then((info) => {
        size.textContent = info.size;
        line.hidden = !info.isLocal;
    }).catch(() => { /* swallowed on purpose: the <p> stays hidden. See the header. */ });

    version.get().then((v) => {
        appVersion.textContent = version.format(v);
    }).catch(() => { /* swallowed on purpose: the footer reads "Version ". See the header. */ });
}
