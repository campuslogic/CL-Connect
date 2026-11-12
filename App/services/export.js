/**
 * services/export.js — POST api/Export/ExportLogs.
 *
 * THE PAYLOAD IS PascalCase and must stay that way: it binds to an ExportRequest declared inline in
 * ExportController.
 *
 * THE RESPONSE IS NOT JSON. Both branches return text/plain — 200 "Logs exported successfully" or
 * 500 "Error exporting logs" — so http.js's JSON.parse fails and hands back the raw string. This
 * therefore resolves to a string, and rejects with err.data holding one.
 *
 * Three server-side caveats make a 200 weaker than it looks:
 *   - the per-table loop has its own catch that logs and returns normally, so a wholly failed
 *     export still answers 200 "Logs exported successfully";
 *   - `days` is not validated server-side at all; the 1-30 bound is browser-only;
 *   - an absent body NREs into a bare catch and is reported as the same generic 500.
 */

import * as http from '../core/http.js';

/**
 * @param {number} days   day count to export (the UI constrains 1-30, the server does not)
 * @param {string[]} tables  table names; an empty list is a server-side 500
 * @returns {Promise<string>}
 */
export function exportLogs(days, tables) {
    return http.post('api/Export/ExportLogs', { Days: days, Tables: tables });
}
