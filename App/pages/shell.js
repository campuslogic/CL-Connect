/**
 * pages/shell.js — the wizard shell: 21 step links and their warning icons, the environment
 * banner, Continue/Save, the 11 result messages, and the active step's own #stepError message.
 *
 * Every Setup step view sets `Layout = _LeftMenuLayout.cshtml` and SetupController returns
 * PartialView(), which still honours an explicit view-level Layout. So the template the router
 * fetches for a step is shell + body in ONE document, and mountStep() is the seam: a page module
 * supplies only its own wiring and never thinks about the shell.
 *
 * ---------------------------------------------------------------------------------------------
 * WHAT REPAINTS, AND WHEN. refreshShell() writes about thirty DOM properties, and it runs
 *
 *   1. once at mount,
 *   2. on every http.BUSY_EVENT — a validation flag can ONLY change as a request settles, because
 *      every validator in services/validation.js is fire-and-forget over HTTP,
 *   3. after a synchronous validator (validateStep), and after each stage of the save chain.
 *
 * That is the whole reactivity story. Nothing observes the configuration, and the step body is
 * never touched — core/model.js has already put its values in the DOM and reads them back on
 * change.
 *
 * concatenateDaysToRun() serialises a CLONE, and that matters: joining the shared model in place
 * would leave five settings as CSV strings after a FAILED save, where every page expects arrays,
 * and the next Save attempt would throw on ''.join of a string.
 * ---------------------------------------------------------------------------------------------
 */

import * as dom from '../core/dom.js';
import * as http from '../core/http.js';
import * as model from '../core/model.js';
import * as router from '../core/router.js';
import * as daysPicker from '../components/daysPicker.js';
import * as folderPicker from '../components/folderPicker.js';
import * as setup from '../services/setup.js';
import * as validation from '../services/validation.js';

/** The step being mounted. Read from the hash, which is the only thing current during mount. */
function currentPath() {
    return location.hash.replace(/^#/, '').split('?')[0] || '/';
}

const ENVIRONMENTS = {
    sandbox: 'Sandbox',
    production: 'Production',
    'production-ca': 'Production (Canada)'
};

/** The 11 result banners, in _LeftMenuLayout.cshtml's order. */
const BANNERS = [
    'msgInvalidPages',
    'msgDuplicatePath',
    'msgDuplicateEvent',
    'msgInvalidBatchName',
    'msgMissingBatchName',
    'msgInvalidApiEndpointName',
    'msgMissingApiEndpointName',
    'msgImproperFileDefinitions',
    'msgErrorCopying',
    'msgSuccess',
    'msgFail'
];

const warnedOnce = new Set();

/** refreshShell runs on every settled request, so a recurring fault must not spam the console. */
function warnOnce(message, error) {
    if (!warnedOnce.has(message)) {
        warnedOnce.add(message);
        console.warn(message, error);
    }
}

/**
 * Which named <form> each step hands to its validator.
 *
 * THREE DEFECTS USED TO BE VISIBLE HERE, which is the point of using a table. Two are fixed:
 *   '/awardLetterPrint' named the FILE STORE form instead of its own. Inert either way —
 *   testAwardLetterPrintSettings takes no arguments — but the table now says what it means.
 *   '/document' and '/filestore' named forms whose markup spelt them "vm.documentForm" and
 *   "vm.fileStoreForm", an AngularJS leftover, so the lookups found nothing and their validators
 *   ran with no form and skipped the native required-field check. Both views dropped the "vm."
 *   prefix; those two steps now honour required fields the way every other step does. Guide §7.46.
 *
 * STILL PRESERVED: '/dataFileUpload' is in NOT_VALIDATED, so clicking its step link validates
 * nothing — Save validates it. And '/batchprocessing' names a form BatchProcessing.cshtml does not
 * have; also inert, because testBatchProcessingSettings ignores its argument too. Guide §7.1.
 *
 * A step absent from this table is validated with no form. A step absent from validation.js's own
 * STEP_VALIDATORS is not validated at all — '/saveConfigurations' and
 * '/awardLetterFileMappingUpload' are the two, and both are preserved.
 */
const STEP_FORMS = {
    '/appSettings': 'formAppSettings',
    '/credentials': 'credentialsForm',
    '/environment': 'environmentForm',
    '/eventnotifications': 'formEventNotifications',
    '/smtp': 'smtpForm',
    '/document': 'documentForm',
    '/filestore': 'fileStoreForm',
    '/awardLetterPrint': 'awardLetterPrintForm',
    '/awardLetterFileMappingUpload': 'awardLetterFileMappingUploadForm',
    '/batchprocessing': 'batchProcessingForm',
    '/apiintegration': 'apiIntegrationForm',
    '/filedefinitions': 'fileDefinitionsForm',
    '/powerfaids': 'powerFaidsForm'
};

/**
 * Steps for which validation.validateStep is never even called. PRESERVED: '/dataFileUpload' IS in
 * validation.js's table, so Save validates it — only its own step link does not.
 *
 * '/awardLetterFileMappingUpload' is deliberately NOT here: it does reach validateStep, which has no
 * entry for it, so the call is a no-op one level down.
 */
const NOT_VALIDATED = ['/saveConfigurations', '/dataFileUpload'];

/**
 * Joins the five days-to-run arrays into the comma-separated strings Web.config stores. Takes the
 * model to mutate rather than reaching for the shared one; callers pass a clone. See the header.
 * @returns {object} the same model, for chaining
 */
export function concatenateDaysToRun(config) {
    const s = config.campusLogicSection;
    s.isirUploadSettings.isirUploadDaysToRun = s.isirUploadSettings.isirUploadDaysToRun.join(',');
    s.awardLetterUploadSettings.awardLetterUploadDaysToRun = s.awardLetterUploadSettings.awardLetterUploadDaysToRun.join(',');
    s.fileMappingUploadSettings.fileMappingUploadDaysToRun = s.fileMappingUploadSettings.fileMappingUploadDaysToRun.join(',');
    s.dataFileUploadSettings.dataFileUploadDaysToRun = s.dataFileUploadSettings.dataFileUploadDaysToRun.join(',');
    s.isirCorrectionsSettings.daysToRun = s.isirCorrectionsSettings.daysToRun.join(',');
    return config;
}

/* ------------------------------------------------------------------ the shell */

/**
 * Repaints the shell. `flags` holds the save chain's result state; see mountStep.
 *
 * The step-link loop drives visibility, the active highlight and the warning icons from three
 * data-* attributes in _LeftMenuLayout.cshtml.
 */
function refreshShell(view, activeStep, flags) {
    const config = setup.state.configurationModel;
    const pv = validation.state.pageValidations || {};
    const onSaveStep = activeStep === '/saveConfigurations';

    // --- current-environment banner
    const env = model.get(config, 'appSettingsSection.environment');
    const banner = view.querySelector('#currentEnvironment');
    if (banner) {
        banner.hidden = !env || env === 'initial';
        view.querySelector('#currentEnvironmentName').textContent = ENVIRONMENTS[env] || '';
    }

    // --- the 21 step links
    for (const a of [...view.querySelectorAll('#stepList a[data-link]')]) {
        const enabled = a.dataset.enabled;
        a.hidden = enabled ? !model.get(config, enabled) : false;
        a.classList.toggle('active', a.dataset.link === activeStep);

        const icon = a.querySelector('i');
        if (icon) {
            const keys = (a.dataset.valid || '').split(' ').filter(Boolean);
            // data-valid-strict is Documents only: `== false`, so an unset flag shows nothing.
            icon.hidden = a.hasAttribute('data-valid-strict')
                ? !keys.some((k) => pv[k] === false)
                : !keys.some((k) => !pv[k]);
        }
    }

    // --- the 11 result banners and the Save button's state.
    //
    // THE ONE PLACE THIS FILE TOLERATES A THROW. invalidPages() and the five cross-page checks
    // walk list state that can be null on a partially configured install: invalidPages() does
    // Object.keys(pageValidations) and checkForInvalidBatchName() iterates eventNotificationsList.
    // The menu above must repaint regardless, so the failure is contained here and logged once.
    let messages;
    let anyInvalidPage = false;
    try {
        anyInvalidPage = validation.invalidPages().length > 0;
        messages = {
            msgInvalidPages: anyInvalidPage,
            msgDuplicatePath: flags.duplicatePath,
            msgDuplicateEvent: flags.duplicateEvent,
            msgInvalidBatchName: flags.invalidBatchName || validation.checkForInvalidBatchName(),
            msgMissingBatchName: flags.missingBatchName || validation.checkForMissingBatchName(),
            msgInvalidApiEndpointName: flags.invalidApiEndpointName || validation.hasInvalidApiEndpointName(),
            msgMissingApiEndpointName: flags.missingApiEndpointName || validation.hasMissingApiEndpointName(),
            msgImproperFileDefinitions: flags.improperFileDefinitions || validation.hasImproperFileDefinitions(),
            msgErrorCopying: flags.errorCopying,
            msgSuccess: flags.success,
            msgFail: flags.fail
        };
    } catch (e) {
        warnOnce('[shell] a cross-page validation check failed; its banner is hidden', e);
        messages = {
            msgErrorCopying: flags.errorCopying,
            msgSuccess: flags.success,
            msgFail: flags.fail
        };
    }
    for (const id of BANNERS) {
        view.querySelector('#' + id).hidden = !(messages[id] && onSaveStep);
    }

    // --- Continue / Save
    view.querySelector('#continueBlock').hidden = onSaveStep;
    view.querySelector('#saveBlock').hidden = !onSaveStep;
    view.querySelector('#saveButton').classList.toggle('disabled', anyInvalidPage || flags.disableSave);

    // --- reveal errors on fields the user has not touched, when this page is known invalid.
    // This is the second half of every old "Required" expression:
    //   !validationService.pageValidations.xValid && (field is empty)
    // See Content/app.css §11.
    const link = view.querySelector('#stepList a[data-link="' + activeStep + '"]');
    const stepKeys = link ? (link.dataset.valid || '').split(' ').filter(Boolean) : [];
    model.showErrors(view, stepKeys.some((k) => !pv[k]));

    // --- the step's own error message, if its validator threw. Replaces components/toast.js: the
    // message now stays on the page that raised it instead of fading from the corner. Only the four
    // steps whose validators have a catch carry a #stepError element, hence the guard.
    const stepError = view.querySelector('#stepError');
    if (stepError) {
        // textContent, never innerHTML — these messages can carry server text.
        const message = validation.state.stepErrors[activeStep] || '';
        stepError.textContent = message;
        stepError.hidden = !message;
    }
}

/* ------------------------------------------------------------------ actions */

/** Runs the active step's validator, with whichever form STEP_FORMS names for it. */
function validateStep(view, activeStep) {
    if (NOT_VALIDATED.indexOf(activeStep) !== -1) {
        return;
    }
    const name = STEP_FORMS[activeStep];
    const form = name ? view.querySelector('form[name="' + name + '"]') : null;
    validation.validateStep(activeStep, form);
}

/**
 * Continue goes to the next ENABLED step. Reading the rendered list rather than a hand-written
 * array is what keeps "skip the disabled steps" correct without a second copy of the step order.
 */
function goNext(view, activeStep, flags, refresh) {
    const links = [...view.querySelectorAll('#stepList a[data-link]:not([hidden])')]
        .map((a) => a.getAttribute('data-link'));

    const i = links.indexOf(currentPath());
    // Not found stays '' — $location.path('') navigated to the menu. Past the end is undefined,
    // Past the end is undefined, and go(undefined) is never called, so the last step is a no-op.
    const next = i === -1 ? '' : links[i + 1];

    if (next === '/saveConfigurations') {
        flags.disableSave = true;
        validation.validateAllSteps();
        refresh();
    }
    if (next !== undefined) {
        router.go(next);
    }
}

function saveConfigurations(view, flags, refresh) {
    // §7.12, FIXED. This read `validation.invalidPages.length` — the zero-arity FUNCTION, not a
    // call — so .length was Function.prototype.length === 0 and the guard was always true: Save
    // never blocked on an invalid page, while refresh() above used the correct `invalidPages()`
    // to grey the button out. The button looked disabled and fired anyway. Now an invalid page
    // genuinely stops the Save, which is what the greyed-out button has always claimed.
    if (!(validation.invalidPages().length === 0 || flags.disableSave)) {
        return;
    }
    flags.disableSave = true;
    flags.errorCopying = false;
    flags.success = false;
    flags.fail = false;
    refresh();

    // Convert from array to concatenated string — on a clone, see header note 2.
    const payload = concatenateDaysToRun(setup.toPayload(setup.state.configurationModel));

    // validate -> archive -> save, with a distinct failure flag per stage. Order and flags are
    // load-bearing; the shell renders a different banner for each.
    setup.validateAll(payload).then(function () {
        setup.archive().then(function () {
            setup.save(payload).then(function () {
                flags.success = true;
                flags.disableSave = false;
                refresh();
                router.go('/');
            }, function () {
                flags.fail = true;
                flags.disableSave = false;
                refresh();
            });
        }, function () {
            flags.errorCopying = true;
            flags.disableSave = false;
            refresh();
        });
    }, function (error) {
        // A 417 from ValidateConfigurations carries a whole ConfigurationValidationModel;
        // http.js exposes it as err.data (SetupController.cs:671).
        //
        validation.state.pageValidations = error.data;
        flags.duplicatePath = error.data.duplicatePath;
        flags.duplicateEvent = error.data.duplicateEvent;
        flags.invalidBatchName = error.data.invalidBatchName;
        flags.missingBatchName = error.data.missingBatchName;
        flags.missingApiEndpointName = error.data.missingApiEndpointName;
        flags.improperFileDefinitions = error.data.improperFileDefinitions;
        flags.disableSave = false;
        refresh();
    }).catch(function (e) {
        console.error('[shell] save chain threw', e);
        flags.disableSave = false;
        refresh();
    });
}

/* ------------------------------------------------------------------ mount */

/**
 * Mounts a wizard step.
 *
 * @param {Element}  view    the router's container; holds shell and step body together
 * @param {object}   locals  resolved route locals ({ config, validations })
 * @param {Function} [init]  (ctx) => undefined | teardown | { refresh?, destroy? }
 *
 * `init` is the page's own wiring. ctx carries { view, config, form, activeStep, refresh }, and it
 * is called AFTER the form has been filled from the configuration, so a page can read current
 * values; components it mounts seed their own controls.
 *
 * Returning a `refresh` opts the page into the shell's repaint schedule — the two pages that need
 * it (SMTP and Credentials) show banners driven by async validation flags, and this is how they
 * get repainted when a request settles without each of them subscribing separately.
 *
 * @returns {Function} teardown, returned to the router
 */
export function mountStep(view, locals, init) {
    const config = setup.state.configurationModel;
    const activeStep = currentPath();
    const offs = [];
    let pageRefresh = null;

    // Save-chain result state. The shell is the only reader.
    const flags = {
        disableSave: false,
        errorCopying: false,
        success: false,
        fail: false,
        duplicatePath: false,
        duplicateEvent: false,
        invalidBatchName: false,
        missingBatchName: false,
        invalidApiEndpointName: false,
        missingApiEndpointName: false,
        improperFileDefinitions: false
    };

    const refresh = () => {
        refreshShell(view, activeStep, flags);
        if (pageRefresh) {
            pageRefresh();
        }
    };

    // --- the step body. Configuration in, edits out. Both are delegated at the view, so a
    // control created later (a folder picker's input) is covered.
    model.load(view, config);
    offs.push(model.track(view, config));

    // The two custom elements the wizard's vocabulary includes. Mounted here rather than by each
    // page because most steps would otherwise repeat these two lines, and each mountAll is a no-op
    // on a page that has none. They run AFTER model.load, because each seeds its own controls and
    // those do not exist until now.
    offs.push(folderPicker.mountAll(view, config));
    offs.push(daysPicker.mountAll(view, config));

    // --- the page's own wiring
    let teardown;
    const page = init ? init({
        view,
        config,
        activeStep,
        refresh,
        form: view.querySelector('form'),
        locals
    }) : null;
    if (typeof page === 'function') {
        teardown = page;
    } else if (page) {
        pageRefresh = typeof page.refresh === 'function' ? page.refresh : null;
        teardown = page.destroy;
    }

    // --- the shell
    refresh();
    // A validation flag can only change as a request settles. See the header.
    offs.push(dom.on(document, http.BUSY_EVENT, refresh));

    offs.push(dom.delegate(view, 'click', '#stepList a[data-link]', () => {
        // Each step link carried data-click="validateStep();" alongside its data-link. This
        // listener is on the view, so it runs before core/router.js's document-level navigation
        // handler, so validation runs before the navigation.
        validateStep(view, activeStep);
        refresh();
    }));

    offs.push(dom.on(view.querySelector('#continueButton'), 'click', () => {
        validateStep(view, activeStep);
        goNext(view, activeStep, flags, refresh);
        refresh();
    }));

    offs.push(dom.on(view.querySelector('#saveButton'), 'click', () => {
        saveConfigurations(view, flags, refresh);
    }));

    return () => {
        if (typeof teardown === 'function') {
            teardown();
        }
        for (const off of offs) {
            off();
        }
    };
}
