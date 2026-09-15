/**
 * main.js — the entry point, and the only script the application loads. Views/Home/Index.cshtml
 * points one <script type="module"> at it, with a RELATIVE src so a wrong <base href> fails loudly
 * at load rather than half-working until the first fetch.
 *
 * What follows is the route table and three lines of startup.
 */

import * as router from './core/router.js';
import * as overlay from './core/overlay.js';
import * as setup from './services/setup.js';
import * as validation from './services/validation.js';
import * as folderPicker from './components/folderPicker.js';

// Every template URL is relative, resolved against <base href>, so the app works when it is hosted
// in an IIS virtual directory. None of them may start with '/'.
router.route('/', {
    template: 'home/menu',
    page: () => import('./pages/menu.js')
});

router.route('/export', {
    template: 'home/export',
    resolve: { config: () => setup.load() },
    page: () => import('./pages/export.js')
});

/**
 * A wizard step. Its Razor view sets Layout = _LeftMenuLayout.cshtml and SetupController returns
 * PartialView(), which still honours an explicit view-level Layout — so `template` fetches the shell
 * and the step body as one document, and pages/shell.js wires both.
 *
 * ALL THREE RESOLVES RUN ON EVERY STEP, and that is what makes deep-linking a step work: the
 * configuration and the validation model have to exist before any page mounts, and the folder
 * picker's Razor partial has to be cached before mount, because pages/shell.js mounts the pickers
 * and core/model.js reads their inputs in the same tick. All three short-circuit once loaded, so
 * this is one extra fetch per session, including on the steps that have no picker.
 *
 * `page` is optional: a step with no wiring of its own gets pages/formStep.js.
 */
function stepRoute(path, template, page = () => import('./pages/formStep.js'), extraResolves) {
    router.route(path, {
        template,
        resolve: Object.assign({
            config: () => setup.load(),
            validations: () => validation.load(),
            picker: () => folderPicker.preload()
        }, extraResolves),
        page
    });
}

// In wizard order. A third argument means the step has wiring beyond its markup.
stepRoute('/saveConfigurations', 'setup/saveConfigurations');
stepRoute('/credentials', 'setup/credentials', () => import('./pages/credentials.js'));
stepRoute('/appSettings', 'setup/applicationsettings');

stepRoute('/smtp', 'setup/smtp', () => import('./pages/smtp.js'));
stepRoute('/isirUpload', 'setup/isirupload');
stepRoute('/awardLetterUpload', 'setup/awardletterupload');
stepRoute('/awardLetterFileMappingUpload', 'setup/awardletterfilemappingupload');
stepRoute('/dataFileUpload', 'setup/datafileupload');
stepRoute('/documentImports', 'setup/documentimports');
stepRoute('/isircorrections', 'setup/isircorrection', () => import('./pages/isirCorrections.js'));
stepRoute('/bulkAction', 'setup/bulkaction');

stepRoute('/batchprocessing', 'setup/batchprocessing', () => import('./pages/batchProcessing.js'));
stepRoute('/powerfaids', 'setup/powerfaids', () => import('./pages/powerFaids.js'));
stepRoute('/storedprocedure', 'setup/storedprocedure', () => import('./pages/storedProcedure.js'));
stepRoute('/filedefinitions', 'setup/filedefinitions', () => import('./pages/fileDefinitions.js'));
stepRoute('/document', 'setup/document', () => import('./pages/document.js'));
stepRoute('/filestore', 'setup/filestore', () => import('./pages/fileStore.js'));
stepRoute('/awardLetterPrint', 'setup/awardLetterPrint');
stepRoute('/environment', 'setup/environment', () => import('./pages/environment.js'));

/** The only step with resolves of its own; both feed <option> lists the Razor view cannot hold. */
stepRoute('/eventnotifications', 'setup/eventNotifications', () => import('./pages/eventNotifications.js'), {
    eventNotificationTypes: () => validation.eventNotificationTypes(),
    eventNotificationDefinitions: () => validation.eventNotifications()
});

stepRoute('/apiintegration', 'setup/apiintegration', () => import('./pages/apiIntegration.js'));

// An unknown hash goes to the menu.
router.otherwise('/');

// The only busy indicator in the application.
overlay.start();

router.start('#view');
