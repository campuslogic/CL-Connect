/**
 * services/eventProperty.js — the three EventProperty endpoints. No local state.
 *
 * updateEventPropertiesWithCredentials SENDS ITS THREE VALUES IN THE QUERY STRING, and must. The
 * action takes three simple types, which Web API binds from the URI only — and with none of them
 * present in the URI the action is not selectable at all, so a body-only POST 404s on a controller
 * that plainly has the method. The body is sent as well, because that is what has shipped for years
 * and something server-side may yet read it.
 */

import * as http from '../core/http.js';

/** POST api/EventProperty/UpdateEventProperties — fired once per wizard load, by /environment. */
export function updateEventProperties() {
    return http.post('api/EventProperty/UpdateEventProperties', {});
}

/** POST api/EventProperty/updateEventPropertiesWithCredentials — after credentials verify. */
export function updateEventPropertiesWithCredentials(username, password, environment) {
    const credentials = {
        username: username,
        password: password,
        environment: environment
    };
    // Query string AND body. The third argument is what makes the action selectable; without it
    // this is a 404. See the header.
    return http.post('api/EventProperty/updateEventPropertiesWithCredentials',
        credentials, credentials);
}

/** GET api/EventProperty/GetEventPropertyDisplayNames — fills eventPropertyValueAvailableProperties. */
export function getEventPropertyDisplayNames() {
    return http.get('api/EventProperty/GetEventPropertyDisplayNames');
}
