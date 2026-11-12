/**
 * services/version.js — GET api/Setup/Version.
 *
 * The server returns a System.Version with no converter registered, so it arrives as an OBJECT
 * rather than a string: { major, minor, build, revision, ... }. AssemblyVersion is 3-part, so
 * revision is -1 and only major.minor.build are meaningful — which is what the footer shows.
 *
 * On any server-side exception this answers 417 with an empty body. pages/menu.js swallows that,
 * leaving the footer reading a bare "Version ".
 */

import * as http from '../core/http.js';

/** @returns {Promise<{major:number, minor:number, build:number}>} */
export function get() {
    return http.get('api/Setup/Version');
}

/** The 3-part string the footer displays. Tolerates a missing or partial response. */
export function format(v) {
    if (!v) {
        return '';
    }
    return v.major + '.' + v.minor + '.' + v.build;
}
