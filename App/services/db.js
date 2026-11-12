/**
 * services/db.js — GET api/Database/GetInfo.
 *
 * Two things the caller has to live with:
 *   - `isLocal` means only "the connection string contains LocalDb". When it is false the server
 *     does not compute a size, and `size` comes back null.
 *   - The server dereferences the CampusLogicConnection connection string unguarded, so calling
 *     this on a machine that has not been configured yet is normal, and answers 500.
 */

import * as http from '../core/http.js';

/** @returns {Promise<{isLocal:boolean, size:string|null}>} */
export function getInfo() {
    return http.get('api/Database/GetInfo');
}
