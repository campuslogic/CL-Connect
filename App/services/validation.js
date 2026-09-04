/**
 * services/validation.js — one shared `pageValidations` dictionary plus the ~30 validators that
 * read and write it. The wizard shell paints its warning icons, its result banners and the Save
 * button's state from that dictionary.
 *
 * ---------------------------------------------------------------------------------------------
 * THREE THINGS THAT LOOK LIKE BUGS AND ARE DELIBERATE
 *
 *  1. The requests are FIRE-AND-FORGET: `.then(ok, err)`, never `await`. testUploadPath reads a
 *     validity flag on the line after firing the request that sets it, so the archive-path check
 *     is gated on the PREVIOUS run's result. Awaiting would change which paths get tested.
 *  2. `.then(ok, err)` is the two-argument form, not `.then(ok).catch(err)`, so a throw inside a
 *     success handler is NOT routed to the error handler.
 *  3. Three defects are preserved rather than fixed, each marked DEFECT at its line:
 *     testFileDefinitions reuses `i` and clobbers its own outer loop; testBatchProcessingSettings
 *     has a misplaced paren so its dedup guard never fires, and it `return`s from inside an async
 *     callback expecting to break a loop. Fixing any of them changes which configurations save.
 *
 * SIDE EFFECT WARNING — api/FolderPicker/TestWritePermissions is a GET THAT MUTATES. It calls
 * Directory.CreateDirectory for a missing path and can send real SMTP mail on failure. This module
 * calls it from 12 places, and components/folderPicker.js fires it merely by loading a page with a
 * saved path. Never point it at a real directory in a test run.
 * ---------------------------------------------------------------------------------------------
 */

import * as http from '../core/http.js';
import * as model from '../core/model.js';
import * as util from '../core/util.js';
import * as setup from './setup.js';
import * as eventProperty from './eventProperty.js';

export const state = {
    /** `null` until load() fills it from api/Setup/GetInitialConfigurationValidationModel. */
    pageValidations: null,
    /**
     * Route -> the message from the last throw inside that step's validator. pages/shell.js paints
     * it into the step's own #stepError element. Deliberately NOT part of pageValidations: that
     * object is the server's ConfigurationValidationModel and is replaced wholesale on a 417 from
     * ValidateConfigurations, which would drop the messages.
     */
    stepErrors: {}
};

/**
 * `form` is whatever pages/shell.js passed — a <form> element or the view container — and may be
 * absent, which is what every `form ? … : …` below is testing for.
 *
 * The throw is deliberate. Two call sites (testEventNotifications, testSMTPSettings) dereference
 * `form` unguarded; both are provably unreachable, because the line above each forces the first
 * clause of its `||` to be true whenever form is falsy. Throwing means a future edit that makes one
 * reachable fails loudly instead of silently validating the entire document.
 */
const isValid = (form) => {
    if (!form) {
        throw new TypeError('[validation] a form is required to read validity');
    }
    return model.valid(form);
};

const cm = () => setup.state.configurationModel;
const pv = () => state.pageValidations;

/**
 * A step validator threw. Records the message against the step that raised it, so that step's own
 * view can render it, and marks the step invalid so _LeftMenuLayout's warning triangle lights up and
 * Save is blocked. Replaces the pop-up toasts, which reported the fault away from its cause, faded
 * after five seconds, and left the step looking valid.
 */
function fail(route, flag, message) {
    state.stepErrors[route] = message;
    pv()[flag] = false;
}

/** Clears a step's recorded error. Each of the four validators below calls this on entry. */
function clearError(route) {
    delete state.stepErrors[route];
}

const WRITE_PERMISSIONS_URL = 'api/FolderPicker/TestWritePermissions/';

/**
 * GET api/FolderPicker/TestWritePermissions — see the SIDE EFFECT WARNING above. Also called by
 * components/folderPicker.js, which is why this one is exported.
 */
export function testWritePermissions(directoryPath, ok, err) {
    return http.get(WRITE_PERMISSIONS_URL, { directoryPath: directoryPath }).then(ok, err);
}

/** GET api/Setup/GetInitialConfigurationValidationModel. Fetches once. */
export async function load() {
    if (!state.pageValidations) {
        state.pageValidations = await http.get('api/Setup/GetInitialConfigurationValidationModel');
    }
    return state.pageValidations;
}

/** GET api/eventNotifications/EventNotificationTypes — an <option> list for /eventnotifications. */
export function eventNotificationTypes() {
    return http.get('api/eventNotifications/EventNotificationTypes');
}

/** GET api/eventNotifications/EventNotifications — the other <option> list. */
export function eventNotifications() {
    return http.get('api/eventNotifications/EventNotifications');
}

// ---------------------------------------------------------------------------------------------
// Cross-page consistency checks
// ---------------------------------------------------------------------------------------------

function fileDefinitionExistsForName(name, fileDefinitions) {
    return fileDefinitions.some((definition) => definition.name === name);
}

/** The handle methods that write to a file store, and so carry a fileStoreName. */
const FILE_STORE_METHODS = ['FileStore', 'FileStoreAndDocumentRetrieval'];

/**
 * Checks for File Definitions that have been defined for a Batch or Document process
 * and ensures all processes have a defined and unique File Definition name.
 */
export function hasImproperFileDefinitions() {
    const campusLogicSection = cm().campusLogicSection;
    const fileDefinitions = campusLogicSection.fileDefinitionsList;

    const documentSettings = campusLogicSection.documentSettings;
    if (documentSettings.documentsEnabled) {
        if (documentSettings.indexFileEnabled) {
            if (!fileDefinitionExistsForName(documentSettings.fileDefinitionName, fileDefinitions)) {
                pv().fileDefinitionSettingsValid = false;
                return true;
            }
        }
    }

    if (campusLogicSection.batchProcessingEnabled) {
        const batchProcessingTypesList = campusLogicSection.batchProcessingTypesList;

        for (let i = 0; i < batchProcessingTypesList.length; i++) {
            const batchProcessingType = batchProcessingTypesList[i];
            if (batchProcessingType.typeName === 'awardLetterPrint') {
                const batchProcesses = batchProcessingType.batchProcesses;

                for (let j = 0; j < batchProcesses.length; j++) {
                    const batchProcess = batchProcesses[j];
                    if (batchProcess.indexFileEnabled) {
                        if (!fileDefinitionExistsForName(batchProcess.fileDefinitionName, fileDefinitions)) {
                            pv().fileDefinitionSettingsValid = false;
                            return true;
                        }
                    }
                }
            }
        }
    }

    return false;
}

/** Does an event notification name an API endpoint that API Integration does not define? */
export function hasMissingApiEndpointName() {
    const { eventNotificationsList, apiEndpointsList } = cm().campusLogicSection;

    const wanted = eventNotificationsList.map((n) => n.apiEndpointName).filter(Boolean);
    const defined = apiEndpointsList.map((endpoint) => endpoint.name).filter(Boolean);

    if (wanted.some((name) => defined.indexOf(name) === -1)) {
        pv().apiIntegrationsValid = false;
        return true;
    }
    return false;
}

/** Does an event notification name a batch that Batch Processing does not define? */
export function checkForMissingBatchName() {
    const { eventNotificationsList, batchProcessingTypesList } = cm().campusLogicSection;

    const wanted = eventNotificationsList.map((n) => n.batchName);
    const defined = batchProcessingTypesList
        .flatMap((type) => type.batchProcesses)
        .map((process) => process.batchName);

    // Note the guard is "is NON-empty", so a blank batchName is ignored here; checkForInvalidBatchName
    // is what reports those.
    if (wanted.some((name) => !isEmptyString(name) && defined.indexOf(name) === -1)) {
        pv().batchProcessingSettingsValid = false;
        return true;
    }
    return false;
}

/**
 * The first file store name an event notification uses that the File Store step does not define, or
 * null when every name resolves.
 *
 * A blank name is ignored: it resolves to the first store server-side, which is what every event
 * carries in a configuration written before file stores were named.
 *
 * Compared case-insensitively, because FileStoresCollection keys on the lowered name — a name that
 * differs only in case IS the same file store in the Web.config
 */
function firstMissingFileStoreName() {
    const { eventNotificationsList, fileStoreSettings } = cm().campusLogicSection;

    const defined = (fileStoreSettings.fileStores || [])
        .map((store) => store.name).filter(Boolean).map((name) => name.toLowerCase());

    const wanted = eventNotificationsList
        .filter((n) => FILE_STORE_METHODS.indexOf(n.handleMethod) !== -1)
        .map((n) => n.fileStoreName)
        .filter((name) => !isEmptyString(name));

    return wanted.find((name) => defined.indexOf(name.toLowerCase()) === -1) ?? null;
}

/**
 * `missingFileStore` arrives on the ConfigurationValidationModel, so the
 * alert cannot appear until ValidateConfigurations has actually failed on it — a store an event
 * names may simply not have been added yet, and nagging about that mid-setup is what this replaced.
 * Once reported, the same check runs client-side on every keystroke in the store-name box, so the
 * alert clears as soon as the name resolves instead of waiting for another round trip.
 */
export function hasMissingFileStore() {
    return !!pv().missingFileStore && firstMissingFileStoreName() !== null;
}

export function checkForInvalidBatchName() {
    const eventNotificationsList = cm().campusLogicSection.eventNotificationsList;

    // Check for blank batch name
    for (let i = 0; i < eventNotificationsList.length; i++) {
        if (eventNotificationsList[i].handleMethod == 'BatchProcessingAwardLetterPrint'
            && (!eventNotificationsList[i].batchName || !eventNotificationsList[i].batchName.length)) {
            return true;
        }
    }

    // Check for duplicate batch name within a type
    if (eventNotificationsList.length > 1) {
        for (let i = 0; i < eventNotificationsList.length; i++) {
            if (eventNotificationsList[i].handleMethod == 'BatchProcessingAwardLetterPrint') {
                if (i < eventNotificationsList.length - 1) {
                    for (let j = i + 1; j < eventNotificationsList.length; j++) {
                        if (eventNotificationsList[j].handleMethod == 'BatchProcessingAwardLetterPrint'
                            && eventNotificationsList[j].batchName == eventNotificationsList[i].batchName) {
                            return true;
                        }
                    }
                }
            }
        }
    }

    return false;
}

export function hasInvalidApiEndpointName() {
    const eventNotificationsList = cm().campusLogicSection.eventNotificationsList;

    // Check for blank API Endpoint Name
    for (let i = 0; i < eventNotificationsList.length; i++) {
        if (eventNotificationsList[i].handleMethod == 'ApiIntegration'
            && (!eventNotificationsList[i].apiEndpointName || !eventNotificationsList[i].apiEndpointName.length)) {
            return true;
        }
    }

    return false;
}

export function checkForDuplicateEvent() {
    let sorted;
    let i;
    let duplicate;
    if (cm().campusLogicSection.eventNotificationsList.length > 1) {

        sorted = cm().campusLogicSection.eventNotificationsList.concat().sort(function (a, b) {
            if (a.eventNotificationId > b.eventNotificationId) { return 1; }
            if (a.eventNotificationId < b.eventNotificationId) { return -1; }
            return 0;
        });

        for (i = 0; i < cm().campusLogicSection.eventNotificationsList.length; i++) {

            duplicate = ((sorted[i - 1] && sorted[i - 1].eventNotificationId == sorted[i].eventNotificationId)
                || (sorted[i + 1] && sorted[i + 1].eventNotificationId == sorted[i].eventNotificationId));
            if (duplicate) {
                return true;
            }
        }
        return false;
    }
    return false;
}

// ---------------------------------------------------------------------------------------------
// folderPathUnique
// ---------------------------------------------------------------------------------------------

export function folderPathUnique(uploadpath) {
    const s = cm().campusLogicSection;
    const filePathValues = [];

    if (s.isirUploadSettings.isirUploadEnabled) {
        filePathValues.push(s.isirUploadSettings.isirUploadFilePath);
        filePathValues.push(s.isirUploadSettings.isirArchiveFilePath);
    }

    if (s.awardLetterUploadSettings.awardLetterUploadEnabled) {
        filePathValues.push(s.awardLetterUploadSettings.awardLetterArchiveFilePath);
        filePathValues.push(s.awardLetterUploadSettings.awardLetterUploadFilePath);
    }

    if (s.fileMappingUploadSettings.fileMappingUploadEnabled) {
        filePathValues.push(s.fileMappingUploadSettings.fileMappingArchiveFilePath);
        filePathValues.push(s.fileMappingUploadSettings.fileMappingUploadFilePath);
    }

    if (s.dataFileUploadSettings.dataFileUploadEnabled) {
        filePathValues.push(s.dataFileUploadSettings.dataFileArchiveFilePath);
        filePathValues.push(s.dataFileUploadSettings.dataFileUploadFilePath);
    }

    if (s.isirCorrectionsSettings.correctionsEnabled) {
        filePathValues.push(s.isirCorrectionsSettings.correctionsFilePath);

        if (s.isirCorrectionsSettings.tdClientEnabled) {
            filePathValues.push(s.isirCorrectionsSettings.tdClientArchiveFilePath);
        }
    }

    if (s.documentSettings.documentsEnabled) {
        filePathValues.push(s.documentSettings.documentStorageFilePath);
    }

    if (s.fileStoreSettings.fileStoreEnabled) {
        for (const store of s.fileStoreSettings.fileStores || []) {
            filePathValues.push(store.fileStorePath);
        }
    }

    if (s.awardLetterPrintSettings.awardLetterPrintEnabled) {
        filePathValues.push(s.awardLetterPrintSettings.awardLetterPrintFilePath);
    }

    if (s.documentImportSettings.enabled) {
        filePathValues.push(s.documentImportSettings.fileDirectory);
        filePathValues.push(s.documentImportSettings.archiveDirectory);
    }

    if (s.batchProcessingEnabled) {
        const batchProcessingTypesList = s.batchProcessingTypesList;
        const batchFilePaths = [];

        for (let i = 0; i < batchProcessingTypesList.length; i++) {
            const batchProcessingType = batchProcessingTypesList[i];
            for (let j = 0; j < batchProcessingType.batchProcesses.length; j++) {
                const batchProcess = batchProcessingType.batchProcesses[j];
                if (batchFilePaths.indexOf(batchProcess.filePath) == -1) {
                    batchFilePaths.push(batchProcess.filePath);
                }
            }
        }

        for (let i = 0; i < batchFilePaths.length; i++) {
            filePathValues.push(batchFilePaths[i]);
        }
    }

    if (s.powerFaidsSettings.powerFaidsEnabled) {
        filePathValues.push(s.powerFaidsSettings.filePath);
    }

    if (uploadpath) {
        const matches = filePathValues.filter(function (filePath) {
            return filePath && uploadpath.toUpperCase() === filePath.toUpperCase();
        });
        if (matches.length > 1) {
            return false;
        }
    }
    return true;
}

// ---------------------------------------------------------------------------------------------
// pageValidations dictionary manipulation
// ---------------------------------------------------------------------------------------------

/**
 * Keys of pageValidations that are status or result flags rather than pages, so a `false` on one of
 * them must not block the Save button. 'invalidApiEndpointName' is not actually a
 * ConfigurationValidationModel property — a dead guard, kept.
 */
const NON_PAGE_KEYS = new Set([
    'issmtpTested',
    'apiCredentialsTested',
    'eventNotificationsConnectionTested',
    'duplicatePath',
    'duplicateEvent',
    'invalidBatchName',
    'missingBatchName',
    'invalidApiEndpointName',
    'missingApiEndpointName',
    'improperFileDefinitions',
    'missingFileStore'
]);

/**
 * Pages whose flag is strictly === false. The shell calls this on every repaint, so it must stay
 * cheap and side-effect free. It is.
 */
export function invalidPages() {
    return Object.keys(pv())
        .filter((page) => pv()[page] === false && !NON_PAGE_KEYS.has(page));
}

export function removePageValidation(pageValid) {
    if (pageValid === 'eventNotificationsValid') {
        delete pv()[pageValid];
        delete pv().documentSettingsValid;
        delete pv().fileStoreSettingsValid;
        delete pv().awardLetterPrintSettingsValid;
        delete pv().storedProcedureValid;
        delete pv().connectionStringValid;
    } else {
        delete pv()[pageValid];
    }
}

export function addPageValidation(pageValid) {
    pv()[pageValid] = true;

    if (pageValid === 'eventNotificationsValid') {
        pv().connectionStringValid = true;
    }
}

// ---------------------------------------------------------------------------------------------
// Orchestration
//
// TWO TABLES, AND THEY DELIBERATELY DISAGREE. Clicking a step link validates that one step, with
// its form; pressing Save validates every ENABLED step, with no form. Three differences between
// them are long-standing behaviour, not oversights, and the tables state them where the two
// switches used to bury them:
//
//   - Only STEP_VALIDATORS passes `form`. The seven validators that branch on `form ? … : …`
//     therefore take their second branch during a Save. Load-bearing.
//   - '/awardLetterFileMappingUpload' is in NEITHER, so nothing on the client ever sets
//     fileMappingUploadValid even though the shell renders a warning icon for it. Only the server
//     does.
//   - '/saveConfigurations' is in neither either, so clicking the Save nav link validates nothing.
//     pages/shell.js also short-circuits '/dataFileUpload' before reaching validateStep, so that
//     step is validated by Save but not by its own link.
// ---------------------------------------------------------------------------------------------

/** Route -> the validator for that one step, called with the step's <form>. */
const STEP_VALIDATORS = {
    '/appSettings': testAppSettings,
    '/credentials': testCredentials,
    '/environment': testEnvironment,
    '/eventnotifications': testEventNotifications,
    '/smtp': testSMTPSettings,
    '/isirUpload': testIsirUploadPath,
    '/awardLetterUpload': testAwardLetterUploadPath,
    '/dataFileUpload': testDataFileUploadPath,
    '/isircorrections': testIsirCorrections,
    '/storedprocedure': testStoredProcedure,
    '/document': testDocumentSettings,
    '/documentImports': testDocumentImports,
    '/filestore': testFileStoreSettings,
    '/awardLetterPrint': testAwardLetterPrintSettings,
    '/batchprocessing': testBatchProcessingSettings,
    '/apiintegration': testApiIntegrations,
    '/bulkAction': testBulkActionSettings,
    '/filedefinitions': testFileDefinitions,
    '/powerfaids': testPowerFaids
};

export function validateStep(currentStep, form) {
    const validate = STEP_VALIDATORS[currentStep];
    if (typeof validate === 'function') {
        validate(form);
    }
}

/**
 * What Save runs, in this order: [validator, is-this-step-enabled]. A null test means the step is
 * always validated.
 *
 * The tests dereference the configuration directly rather than going through model.get, so a
 * missing section still throws here exactly as it always has, instead of being read as "disabled"
 * and silently skipped.
 */
const ALL_STEPS = [
    [testEnvironment, null],
    [testCredentials, null],
    [testAppSettings, null],
    [testIsirUploadPath, (s) => s.isirUploadSettings.isirUploadEnabled],
    [testAwardLetterUploadPath, (s) => s.awardLetterUploadSettings.awardLetterUploadEnabled],
    [testDataFileUploadPath, (s) => s.dataFileUploadSettings.dataFileUploadEnabled],
    [testSMTPSettings, (s) => s.smtpSettings.notificationsEnabled],
    [testBulkActionSettings, (s) => s.bulkActionSettings.bulkActionEnabled],
    [testEventNotifications, (s) => s.eventNotificationsEnabled],
    [testIsirCorrections, (s) => s.isirCorrectionsSettings.correctionsEnabled],
    [testStoredProcedure, (s) => s.storedProceduresEnabled],
    [testDocumentSettings, (s) => s.documentSettings.documentsEnabled],
    [testDocumentImports, (s) => s.documentImportSettings.enabled],
    [testFileStoreSettings, (s) => s.fileStoreSettings.fileStoreEnabled],
    [testAwardLetterPrintSettings, (s) => s.awardLetterPrintSettings.awardLetterPrintEnabled],
    [testBatchProcessingSettings, (s) => s.batchProcessingEnabled],
    [testApiIntegrations, (s) => s.apiIntegrationsEnabled],
    [testFileDefinitions, (s) => s.fileDefinitionsEnabled],
    [testPowerFaids, (s) => s.powerFaidsEnabled]
];

/**
 * Cross-page checks that must not nag mid-setup, armed by reaching the Save step. An event may name
 * a file store that has not been added yet, and a store may name a file definition that has not been
 * added yet; both are normal orders to work in, so neither is reported until the wizard has been
 * walked to the end. Once armed it stays armed for the rest of the session, so the report re-renders
 * every time the File Store step revalidates and clears itself as soon as the names resolve.
 */
let crossPageChecksArmed = false;

export function validateAllSteps() {
    crossPageChecksArmed = true;
    const section = cm().campusLogicSection;
    for (const [validate, isEnabled] of ALL_STEPS) {
        if (!isEnabled || isEnabled(section)) {
            validate();
        }
    }
}

// ---------------------------------------------------------------------------------------------
// Folder-path validators
// ---------------------------------------------------------------------------------------------

function testStoredProcedure() {
    if (cm().campusLogicSection.storedProcedureList.length === 0) {
        pv().storedProcedureValid = false;
    } else {
        pv().storedProcedureValid = true;
    }
}

function testAppSettings(form) {
    pv().applicationSettingsValid = form ? isValid(form) : manuallyTestAppSettings();
}

function testFolderPath(folderPath) {
    if (folderPath !== '' && folderPath && folderPathUnique(folderPath)) {
        return true;
    }
    return false;
}

/**
 * The three scheduled-upload steps validate identically: a day must be selected, both paths must be
 * non-blank and unique across every section, and both must be writable.
 *
 * THE SECOND PROBE READS A STALE FLAG, on purpose. testWritePermissions is fire-and-forget, so the
 * `if (pv()[flag])` below sees the result of the PREVIOUS run of this validator, not the request
 * fired two lines up. Awaiting it would change which archive paths get probed at all — and probing
 * is a mutating call (see the SIDE EFFECT WARNING at the top of this file).
 *
 * @param {object} settings   the settings section for this step
 * @param {string} daysKey    property holding the days-to-run array
 * @param {string} pathKey    property holding the upload path
 * @param {string} archiveKey property holding the archive path
 * @param {string} flag       the pageValidations key this step reports through
 */
function testUploadPath(settings, daysKey, pathKey, archiveKey, flag) {
    const setFlag = (value) => () => { pv()[flag] = value; };

    if (settings[daysKey].length > 0
        && testFolderPath(settings[pathKey])
        && testFolderPath(settings[archiveKey])) {

        testWritePermissions(settings[pathKey], setFlag(true), setFlag(false));

        if (pv()[flag]) {   // stale by one run — see above
            testWritePermissions(settings[archiveKey], setFlag(true), setFlag(false));
        }
    } else {
        pv()[flag] = false;
    }
}

function testIsirUploadPath() {
    testUploadPath(cm().campusLogicSection.isirUploadSettings,
        'isirUploadDaysToRun', 'isirUploadFilePath', 'isirArchiveFilePath', 'isirUploadValid');
}

function testAwardLetterUploadPath() {
    testUploadPath(cm().campusLogicSection.awardLetterUploadSettings,
        'awardLetterUploadDaysToRun', 'awardLetterUploadFilePath', 'awardLetterArchiveFilePath',
        'awardLetterUploadValid');
}

function testDataFileUploadPath() {
    testUploadPath(cm().campusLogicSection.dataFileUploadSettings,
        'dataFileUploadDaysToRun', 'dataFileUploadFilePath', 'dataFileArchiveFilePath',
        'dataFileUploadValid');
}

function testIsirCorrections() {
    const s = cm().campusLogicSection.isirCorrectionsSettings;
    pv().isirCorrectionsValid = true;

    if (util.isNullOrWhitespace(s.correctionsFilePath) === false
        && util.isNullOrWhitespace(s.timeToRun) === false
        && s.daysToRun.length > 0) {
        testWritePermissions(s.correctionsFilePath, function () {
            // Success deliberately does nothing.
        }, function () {
            pv().isirCorrectionsValid = false;
        });
    } else {
        pv().isirCorrectionsValid = false;
    }

    if (s.tdClientEnabled === true) {
        if (util.isNullOrWhitespace(s.tdClientExecutablePath) === false
            && util.isNullOrWhitespace(s.tdClientArchiveFilePath) === false
            && util.isNullOrWhitespace(s.tdClientSecfileFolderPath) === false
            && util.isNullOrWhitespace(s.tdClientFtpUserId) === false
            && util.isNullOrWhitespace(s.tdClientFtpUsername) === false
            && s.tdClientArchiveFilePath !== s.correctionsFilePath) {
            testWritePermissions(s.tdClientExecutablePath, function () {
                testWritePermissions(s.tdClientArchiveFilePath, function () {
                }, function () { pv().isirCorrectionsValid = false; });
            }, function () { pv().isirCorrectionsValid = false; });
        } else {
            pv().isirCorrectionsValid = false;
        }
    }
}

function manuallyTestAppSettings() {
    const a = cm().appSettingsSection;
    return (a.backgroundWorkerCount !== ''
        && a.backgroundWorkerRetryAttempts !== ''
        && a.purgeReceivedEventsAfterDays !== ''
        && a.purgeLogRecordsAfterDays !== ''
        && a.purgeNotificationLogRecordsAfterDays !== ''
        && a.incomingApiUsername !== ''
        && a.incomingApiPassword !== '');
}

// ---------------------------------------------------------------------------------------------
// API / environment / credentials
// ---------------------------------------------------------------------------------------------

/**
 * @returns {Promise} settles once connectionStringValid / eventNotificationsConnectionTested are
 * final, so the caller can repaint. It cannot rely on http's busy event for that — see the ordering
 * note in core/http.js, and guide §7.43. Always a promise, including on the paths
 * that make no request.
 */
export function testEventNotifications(form) {
    pv().eventNotificationsConnectionTested = false;
    if (!checkForDuplicateEvent() && !checkForInvalidBatchName() && !hasInvalidApiEndpointName()) {
        pv().eventNotificationsValid = form ? isValid(form) : pv().eventNotificationsValid;
        pv().connectionStringValid = true;
        // Preserved: the second clause dereferences `form` unguarded. It is only safe because
        // the line above forced eventNotificationsConnectionTested to false, which makes the
        // first clause true whenever form is falsy.
        if ((!form && !pv().eventNotificationsConnectionTested) || isValid(form)) {
            pv().eventNotificationsConnectionTested = false;
            const conn = cm().campusLogicSection.clientDatabaseConnection.connectionString;
            if (conn && conn.length > 0) {
                return http.get('api/EventNotifications/TestConnectionString', { connectionString: conn }).then(
                    function () {
                        pv().connectionStringValid = true;
                        pv().eventNotificationsConnectionTested = true;
                    },
                    function () {
                        pv().eventNotificationsConnectionTested = true;
                        pv().connectionStringValid = false;
                    });
            }
        }
    } else {
        pv().eventNotificationsValid = false;
    }
    return Promise.resolve();
}

/**
 * @returns {Promise} settles once apiCredentialsValid / apiCredentialsTested are final. See
 * testEventNotifications above for why the caller needs this. It deliberately does NOT wait for the
 * UpdateEventProperties / GetEventPropertyDisplayNames chain the success path starts: the banner
 * describes the credentials test, and the two PlatformManager calls that follow are housekeeping.
 */
export function testCredentials(form) {
    try {
        clearError('/credentials');
        pv().apiCredentialsValid = form ? isValid(form) : true;
        if (!form || isValid(form)) {
            pv().apiCredentialsTested = false;
            const a = cm().appSettingsSection;
            return http.get('api/Credentials/TestAPICredentials/', {
                username: a.apiUsername,
                password: a.apiPassword,
                environment: a.environment,
                awardLetterUploadEnabled: cm().campusLogicSection
                    .awardLetterUploadSettings.awardLetterUploadEnabled
            }).then(
                function () {
                    pv().apiCredentialsTested = true;
                    pv().apiCredentialsValid = true;
                    // if credentials are valid, update EventProperties from PM
                    eventProperty.updateEventPropertiesWithCredentials(
                        a.apiUsername, a.apiPassword, a.environment
                    ).then(function () {
                        eventProperty.getEventPropertyDisplayNames().then(function (data) {
                            cm().campusLogicSection.eventPropertyValueAvailableProperties = data;
                        });
                    });
                },
                function () {
                    pv().apiCredentialsTested = true;
                    pv().apiCredentialsValid = false;
                });
        }
    } catch (exception) {
        fail('/credentials', 'apiCredentialsValid',
            'An error occured while attempting to connect to the API.');
    }
    return Promise.resolve();
}

function testEnvironment(form) {
    pv().environmentValid = form && model.dirty(form) ? isValid(form) : manuallyTestEnvironment();
}

function manuallyTestEnvironment() {
    const a = cm().appSettingsSection;
    if (a.disableAutoUpdate) {
        return true;
    }
    return (a.environment === 'sandbox'
        || a.environment === 'production'
        || a.environment === 'production-ca');
}

// ---------------------------------------------------------------------------------------------
// SMTP / bulk action
// ---------------------------------------------------------------------------------------------

/**
 * @returns {Promise} settles once smtpValid / issmtpTested are final. See testEventNotifications
 * above for why the caller needs this.
 */
export function testSMTPSettings(form) {
    try {
        clearError('/smtp');
        pv().issmtpTested = false;
        pv().smtpValid = form ? isValid(form) : pv().smtpValid;
        // Preserved: same unguarded shape as testEventNotifications above.
        if ((!form && !pv().issmtpTested) || isValid(form)) {
            const smtp = cm().smtpSection;
            return http.post('api/SMTP/TestSMTP/', {
                smtpSection: {
                    deliveryMethod: smtp.deliveryMethod,
                    from: smtp.from,
                    network: {
                        defaultCredentials: smtp.network.defaultCredentials,
                        clientDomain: smtp.network.clientDomain,
                        enableSsl: smtp.network.enableSsl,
                        host: smtp.network.host,
                        password: smtp.network.password,
                        port: smtp.network.port,
                        targetName: smtp.network.targetName,
                        userName: smtp.network.userName
                    },
                    specifiedPickupDirectory: {
                        pickupDirectoryLocation: smtp.specifiedPickupDirectory.pickupDirectoryLocation
                    }
                },

                sendTo: cm().campusLogicSection.smtpSettings.sendTo
            }).then(
                function () {
                    pv().issmtpTested = true;
                    pv().smtpValid = true;
                },
                function () {
                    pv().issmtpTested = true;
                    pv().smtpValid = false;
                });
        }
    } catch (exception) {
        fail('/smtp', 'smtpValid', 'An error occured while attempting to connect to SMTP.');
    }
    return Promise.resolve();
}

function testBulkActionSettings() {
    pv().bulkActionSettingsValid = true;
    const settings = cm().campusLogicSection.bulkActionSettings;
    pv().bulkActionSettingsValid = settings && settings.bulkActionEnabled
        && !!(settings.bulkActionArchivePath && settings.bulkActionUploadPath
            && settings.frequency && settings.notificationEmail);
}

// ---------------------------------------------------------------------------------------------
// Per-page settings validators
// ---------------------------------------------------------------------------------------------

function testDocumentSettings(form) {
    try {
        clearError('/document');
        pv().documentSettingsValid = form ? isValid(form) : pv().documentSettingsValid;
        if (!form || isValid(form)) {

            pv().documentSettingsValid = true;
            const settings = cm().campusLogicSection.documentSettings;
            if (settings.documentsEnabled === null) {
                pv().documentSettingsValid = false;
            } else if (settings.indexFileEnabled === undefined || settings.indexFileEnabled === null
                || settings.indexFileEnabled === '') {
                pv().documentSettingsValid = false;
            } else if (settings.indexFileEnabled === true) {
                if (settings.documentStorageFilePath === undefined
                    || settings.documentStorageFilePath === null
                    || settings.documentStorageFilePath === '') {
                    pv().documentSettingsValid = false;
                }
                if (settings.fileDefinitionName === undefined || settings.fileDefinitionName === null
                    || settings.fileDefinitionName === '') {
                    pv().documentSettingsValid = false;
                }
                if (testFolderPath(settings.documentStorageFilePath)) {

                    testWritePermissions(settings.documentStorageFilePath, function () { }, function () {
                        pv().documentSettingsValid = false;
                    });
                } else {
                    pv().documentSettingsValid = false;
                }
            }
        }
    } catch (exception) {
        fail('/document', 'documentSettingsValid',
            'An error occured while attempting to validate the Document Settings.');
    }
}

/**
 * Takes no `form`: the step is a grid, and each file store's own fields are checked in the dialog that
 * edits it. Every file store is validated here, and one bad file store fails the step.
 */
function testFileStoreSettings() {
    try {
        clearError('/filestore');
        pv().fileStoreSettingsValid = true;

        const settings = cm().campusLogicSection.fileStoreSettings;
        if (settings.fileStoreEnabled === null) {
            pv().fileStoreSettingsValid = false;
        }

        const stores = settings.fileStores || [];
        if (stores.length === 0) {
            pv().fileStoreSettingsValid = false;
        }

        // The two cross-page relationships this screen owns: every file store an event notification names
        // has to be defined here, and every definition name a file store carries has to exist on the File
        // Definitions step. Both are reported here because this is the screen that defines them —
        // deleting or renaming a store is what orphans an event — and both wait for
        // crossPageChecksArmed, so neither interrupts a setup that is still being filled in.
        if (crossPageChecksArmed) {
            const problems = [];

            const orphan = firstMissingFileStoreName();
            if (orphan !== null) {
                problems.push(`An event notification uses the file store "${orphan}", which is not defined below.`);
            }

            const definitions = cm().campusLogicSection.fileDefinitionsList || [];
            for (const store of stores) {
                if (!util.isNullOrWhitespace(store.fileDefinitionName)
                    && !fileDefinitionExistsForName(store.fileDefinitionName, definitions)) {
                    problems.push(`The file store "${store.name}" uses the file definition `
                        + `"${store.fileDefinitionName}", which does not exist.`);
                }
            }

            if (problems.length > 0) {
                fail('/filestore', 'fileStoreSettingsValid', problems.join(' '));
            }
        }

        const names = [];
        for (const store of stores) {
            if (util.isNullOrWhitespace(store.name.trim())) {
                pv().fileStoreSettingsValid = false;
            } else if (names.indexOf(store.name.trim().toLowerCase()) !== -1) {
                pv().fileStoreSettingsValid = false;
            } else {
                names.push(store.name.trim().toLowerCase());
            }

            if (util.isNullOrWhitespace(store.fileStorePath)) {
                pv().fileStoreSettingsValid = false;
            } else if (store.fileStoreMinutes === undefined || store.fileStoreMinutes === null
                || store.fileStoreMinutes === '') {
                pv().fileStoreSettingsValid = false;
            } else if (util.isNullOrWhitespace(store.fileDefinitionName)) {
                pv().fileStoreSettingsValid = false;
            }

            if (testFolderPath(store.fileStorePath)) {
                testWritePermissions(store.fileStorePath, function () { }, function () {
                    pv().fileStoreSettingsValid = false;
                });
            } else {
                pv().fileStoreSettingsValid = false;
            }
        }
    } catch (exception) {
        fail('/filestore', 'fileStoreSettingsValid',
            'An error occured while attempting to validate the File Store Settings.');
    }
}

/**
 * Takes no `form`, although validateStep passes one — and pages/shell.js hands this step the FILE
 * STORE form rather than its own. Both quirks are preserved; see guide §7.1.
 */
function testAwardLetterPrintSettings() {
    pv().awardLetterPrintSettingsValid = true;
    const settings = cm().campusLogicSection.awardLetterPrintSettings;
    if (settings.awardLetterPrintEnabled === null) {
        pv().awardLetterPrintSettingsValid = false;
    }
    if (settings.awardLetterPrintFilePath === undefined || settings.awardLetterPrintFilePath === null
        || settings.awardLetterPrintFilePath === '') {
        pv().awardLetterPrintSettingsValid = false;
    }
}

function testDocumentImports() {
    const s = cm().campusLogicSection.documentImportSettings;

    // Check truthiness of all values.
    pv().documentImportsValid = !!(s.enabled && s.frequency && s.fileDirectory
        && s.archiveDirectory && s.fileExtension);
}

// ---------------------------------------------------------------------------------------------
// Batch processing / API integrations
// ---------------------------------------------------------------------------------------------

/** `form` is declared and never used. */
function testBatchProcessingSettings(form) {   // eslint-disable-line no-unused-vars
    const batchProcessingTypesList = cm().campusLogicSection.batchProcessingTypesList;

    if (batchProcessingTypesList.length === 0) {
        pv().batchProcessingSettingsValid = false;
    } else {
        pv().batchProcessingSettingsValid = true;

        const filePaths = [];

        for (let i = 0; i < batchProcessingTypesList.length; i++) {
            const batchProcesses = batchProcessingTypesList[i].batchProcesses;

            if (batchProcesses.length > 0) {
                const filePathsForBatchType = [];

                for (let j = 0; j < batchProcesses.length; j++) {
                    if (isEmptyString(batchProcesses[j].filePath)) {
                        pv().batchProcessingSettingsValid = false;
                        return;
                    }
                    // FIXED. The paren used to be misplaced — `indexOf(filePath == -1)` is
                    // indexOf(<boolean>), always -1 and therefore truthy — so this guard never
                    // deduped anything, and the collect loop below sat INSIDE this one, re-pushing
                    // the whole accumulated list on every iteration. Two batch processes sharing a
                    // path meant three write probes of it instead of one, and every probe runs
                    // Directory.CreateDirectory on the server. Guide §7.46.
                    if (filePathsForBatchType.indexOf(batchProcesses[j].filePath) === -1) {
                        filePathsForBatchType.push(batchProcesses[j].filePath);
                    }
                }

                // Add this type's unique paths to the list of all batch file paths. Paths shared
                // BETWEEN types are still probed once per type, as they always were.
                for (let k = 0; k < filePathsForBatchType.length; k++) {
                    filePaths.push(filePathsForBatchType[k]);
                }
            } else {
                pv().batchProcessingSettingsValid = false;
                return;
            }
        }

        // Test if paths are unique across batch types and other integrations
        for (let i = 0; i < filePaths.length; i++) {
            if (testFolderPath(filePaths[i])) {
                testWritePermissions(filePaths[i], function () {
                }, function () {
                    pv().batchProcessingSettingsValid = false;
                    // DEFECT, preserved: this `return` leaves the async callback, not the
                    // enclosing loop, which has long since finished.
                });
            } else {
                pv().batchProcessingSettingsValid = false;
                return;
            }
        }
    }
}

function getEndpointsForApi(id, endpoints) {
    return endpoints.filter(function (endpoint) {
        return endpoint.apiId === id;
    });
}

/** `form` is declared and never used. */
function testApiIntegrations(form) {   // eslint-disable-line no-unused-vars
    const apiIntegrationsList = cm().campusLogicSection.apiIntegrationsList;
    const apiEndpointsList = cm().campusLogicSection.apiEndpointsList;

    // Ensure there is at least one API Integration
    if (apiIntegrationsList.length === 0) {
        pv().apiIntegrationsValid = false;
    } else {
        pv().apiIntegrationsValid = true;

        // Ensure each API Integration has at least one endpoint
        for (let i = 0; i < apiIntegrationsList.length; i++) {
            const endpoints = getEndpointsForApi(apiIntegrationsList[i].apiId, apiEndpointsList);
            if (endpoints.length === 0) {
                pv().apiIntegrationsValid = false;
            }

            // Ensure parameter mappings are defined for each endpoint
            for (let j = 0; j < endpoints.length; j++) {
                if (endpoints[j].parameterMappings === null || endpoints[j].parameterMappings === undefined) {
                    pv().apiIntegrationsValid = false;
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------------------------
// File definitions / PowerFAIDS
// ---------------------------------------------------------------------------------------------

/** `form` is declared and never used. */
function testFileDefinitions(form) {   // eslint-disable-line no-unused-vars
    const fileDefinitionsList = cm().campusLogicSection.fileDefinitionsList;

    if (fileDefinitionsList.length === 0) {
        pv().fileDefinitionSettingsValid = false;
    } else {
        // Need to set to true to re-enable save button if improperFileDefinition was toggled
        pv().fileDefinitionSettingsValid = true;

        // Ensure each File Definition is valid, along with their mapping.
        // FIXED. The inner field-mapping loop used to reuse `i` — `var` made the two loops share
        // one binding — so after the first definition's mappings ran, `i` was left at that
        // collection's length and the outer loop exited early: with more than one file definition,
        // the second and later ones were never checked. The inner loop has its own `j` now, and
        // both are block-scoped. Guide §7.46.
        for (let i = 0; i < fileDefinitionsList.length; i++) {
            const fileDefinition = fileDefinitionsList[i];

            if (isEmptyString(fileDefinition.name)) {
                pv().fileDefinitionSettingsValid = false;
            } else if (isEmptyString(fileDefinition.fileNameFormat)) {
                pv().fileDefinitionSettingsValid = false;
            } else if (fileDefinition.includeHeaderRecord == null) {
                pv().fileDefinitionSettingsValid = false;
            } else if (isEmptyString(fileDefinition.fileExtension)) {
                pv().fileDefinitionSettingsValid = false;
            } else if (isEmptyString(fileDefinition.fileFormat)) {
                pv().fileDefinitionSettingsValid = false;
            } else if (fileDefinition.fieldMappingCollection.length == 0) {
                pv().fileDefinitionSettingsValid = false;
            }

            //loop through each field mapping
            for (let j = 0; j < fileDefinition.fieldMappingCollection.length; j++) {
                const fieldMapping = fileDefinition.fieldMappingCollection[j];
                if (util.isNullOrWhitespace(fieldMapping.fieldSize)) {
                    pv().fileDefinitionSettingsValid = false;
                }
                if (util.isNullOrWhitespace(fieldMapping.dataType)) {
                    pv().fileDefinitionSettingsValid = false;
                }
                if (util.isNullOrWhitespace(fieldMapping.fileFieldName)) {
                    pv().fileDefinitionSettingsValid = false;
                }
                if (fileDefinition.fileFormat == 'xml' && fieldMapping.fileFieldName.indexOf(' ') >= 0) {
                    pv().fileDefinitionSettingsValid = false;
                }
                if (fileDefinition.indexFileEnabled
                    && (fileDefinition.fileFormat == 'csv' || fileDefinition.fileFormat == 'csvnoquotes')
                    && fieldMapping.fileFieldName.indexOf(',') >= 0) {
                    pv().fileDefinitionSettingsValid = false;
                }
            }
        }
    }
}

/** `form` is declared and never used. */
function testPowerFaids(form) {   // eslint-disable-line no-unused-vars
    pv().powerFaidsSettingsValid = true;
    const settings = cm().campusLogicSection.powerFaidsSettings;

    if (settings) {
        if (!settings.filePath) {
            pv().powerFaidsSettingsValid = false;
        }

        if (settings.isBatch == null) {
            pv().powerFaidsSettingsValid = false;
        } else if (settings.isBatch && !settings.batchExecutionMinutes) {
            pv().powerFaidsSettingsValid = false;
        }

        const powerFaidsList = cm().campusLogicSection.powerFaidsList;

        if (powerFaidsList && powerFaidsList.length > 0) {
            for (let i = 0; i < powerFaidsList.length; i++) {
                // Check for uniqueness of event/transaction category combinations
                for (let j = 0; j < powerFaidsList.length; j++) {
                    if (j !== i && powerFaidsList[j].event === powerFaidsList[i].event
                        && powerFaidsList[j].transactionCategory === powerFaidsList[i].transactionCategory) {
                        pv().powerFaidsSettingsValid = false;
                    }
                }

                // Ensure the event is mapped. Loose equality is load-bearing: eventNotificationId
                // arrives from the API as a number while powerFaidsList[i].event comes out of
                // Web.config as a string, so === would mark every mapped event invalid.
                if (!cm().campusLogicSection.eventNotifications.find(function (event) {
                    return event.eventNotificationId == powerFaidsList[i].event;
                })) {
                    pv().powerFaidsSettingsValid = false;
                }

                if (powerFaidsList[i].outcome) {
                    if (powerFaidsList[i].outcome === 'documents'
                        && (!powerFaidsList[i].shortName || !powerFaidsList[i].requiredFor
                            || !powerFaidsList[i].status || !powerFaidsList[i].documentLock)) {
                        pv().powerFaidsSettingsValid = false;
                    } else if (powerFaidsList[i].outcome === 'verification'
                        && (!powerFaidsList[i].verificationOutcome || !powerFaidsList[i].verificationOutcomeLock)) {
                        pv().powerFaidsSettingsValid = false;
                    } else if (powerFaidsList[i].outcome === 'both'
                        && (!powerFaidsList[i].shortName || !powerFaidsList[i].requiredFor
                            || !powerFaidsList[i].status || !powerFaidsList[i].documentLock
                            || !powerFaidsList[i].verificationOutcome
                            || !powerFaidsList[i].verificationOutcomeLock)) {
                        pv().powerFaidsSettingsValid = false;
                    }
                } else {
                    pv().powerFaidsSettingsValid = false;
                }
            }
        } else {
            pv().powerFaidsSettingsValid = false;
        }
    } else {
        pv().powerFaidsSettingsValid = false;
    }
}

/** Absent, null or ''. Note this is NOT a whitespace test — util.isNullOrWhitespace is. */
function isEmptyString(value) {
    return value === undefined || value === null || value === '';
}
