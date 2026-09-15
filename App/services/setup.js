/**
 * services/setup.js — the shared configuration singleton the whole wizard mutates and finally POSTs.
 *
 * `configurationModel` starts null and every route's resolve fills it before a page mounts (see
 * main.js's stepRoute), which is what makes deep-linking a wizard step work. load() fetches only
 * when the singleton is empty, so navigating between steps does not re-fetch.
 */

import * as http from '../core/http.js';

/**
 * The singleton — a plain object. Nothing observes it: pages read it at mount and write it on change
 * (core/model.js), so there is no reason for change notification to exist.
 */
export const state = { configurationModel: null };

/**
 * Each of the five days-to-run settings persists as a comma-joined string and is rendered as an
 * array. The isArray guard makes a second call a no-op.
 *
 * NOTE ''.split(',') IS [''] — length 1, not 0 — so an unset daysToRun reads as "one day selected"
 * to the length checks in validation.js and to the days picker's Required message. Preserved
 * deliberately; changing it would light up that message on five pages nobody edited.
 */
function splitDaysToRun(model) {
    const s = model && model.campusLogicSection;
    if (!s) {
        return;
    }
    const targets = [
        [s.isirUploadSettings, 'isirUploadDaysToRun'],
        [s.awardLetterUploadSettings, 'awardLetterUploadDaysToRun'],
        [s.fileMappingUploadSettings, 'fileMappingUploadDaysToRun'],
        [s.dataFileUploadSettings, 'dataFileUploadDaysToRun'],
        [s.isirCorrectionsSettings, 'daysToRun']
    ];
    for (const [section, key] of targets) {
        if (section && !Array.isArray(section[key])) {
            section[key] = String(section[key] === undefined || section[key] === null ? '' : section[key]).split(',');
        }
    }
}

/** The handle methods that write to a file store, and so carry a fileStoreName. */
const FILE_STORE_METHODS = ['FileStore', 'FileStoreAndDocumentRetrieval'];

/**
 * The server serialises these three collections under one name and the views read another. Runs on
 * first load only.
 */
function applyDeserializationWorkaround(model) {
    const s = model && model.campusLogicSection;
    if (!s) {
        return;
    }
    s.eventNotificationsList = s.eventNotifications;
    if (s.fileStoreSettings) {
        s.fileStoreSettings.fileStoreMappingCollection = s.fileStoreSettings.fileStoreMappingCollectionConfig;
    }
    if (s.documentSettings) {
        s.documentSettings.fieldMappingCollection = s.documentSettings.fieldMappingCollectionConfig;
    }
    backfillFileStoreNames(s);
}

/**
 * Points every file store event at the first file store name when it does not have one defined
 */
function backfillFileStoreNames(s) {
    const stores = s.fileStoreSettings && s.fileStoreSettings.fileStores;
    if (!Array.isArray(stores) || stores.length === 0) {
        return;
    }
    for (const notification of s.eventNotifications || []) {
        if (FILE_STORE_METHODS.indexOf(notification.handleMethod) !== -1
            && !notification.fileStoreName) {
            notification.fileStoreName = stores[0].name;
        }
    }
}

/**
 * Resolves the shared config, fetching at most once.
 * @returns {Promise<object>} the live shared model, not a copy
 */
export async function load() {
    if (!state.configurationModel) {
        state.configurationModel = await http.get('api/Setup/Configurations');
        applyDeserializationWorkaround(state.configurationModel);
    }
    // Runs on every call, not just after a fetch: it is idempotent, and it is the one place that
    // guarantees a cached configuration is in array form before a page mounts.
    splitDaysToRun(state.configurationModel);
    return state.configurationModel;
}

/**
 * A plain-object deep copy, which is what keeps `state` itself out of the request body. The replacer
 * drops $$-prefixed keys; nothing stamps those any more, and it costs one expression on the single
 * code path that writes Web.config.
 */
export function toPayload(model) {
    return JSON.parse(JSON.stringify(model, (key, value) => (
        typeof key === 'string' && key.slice(0, 2) === '$$' ? undefined : value
    )));
}

/**
 * POST api/Setup/ValidateConfigurations. On failure the server answers 417 WITH a full
 * ConfigurationValidationModel, which http.js exposes as err.data — the save chain in
 * pages/shell.js writes it straight back into validation.state.pageValidations.
 */
export function validateAll(model) {
    return http.post('api/Setup/ValidateConfigurations', toPayload(model || state.configurationModel));
}

/** POST api/Setup/ArchiveWebConfig. Takes no body, so http.js sends no Content-Type. */
export function archive() {
    return http.post('api/Setup/ArchiveWebConfig');
}

/** POST api/Setup/Configurations — writes Web.config and restarts the site. */
export function save(model) {
    return http.post('api/Setup/Configurations', toPayload(model || state.configurationModel));
}
