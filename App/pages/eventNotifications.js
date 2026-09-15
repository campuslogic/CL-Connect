/**
 * pages/eventNotifications.js — the most interconnected step in the wizard.
 *
 * ---------------------------------------------------------------------------------------------
 * THE ROWS BIND THROUGH `name`, LIKE EVERYTHING ELSE, using the row's INDEX:
 *
 *     name="campusLogicSection.eventNotifications.3.handleMethod"
 *
 * core/model.js walks a dotted path one key at a time and an array index is just another key, so
 * this needs no new machinery: renderRows() stamps the names in and calls model.load() once, and
 * model.track()'s delegated listeners at the view root pick up every edit, including in rows created
 * after mount. No repeat directive, no per-row listeners.
 *
 * `campusLogicSection.eventNotifications` IS AN ARRAY on the client, and services/setup.js aliases
 * `eventNotificationsList` to the very same array — which is the name the save payload uses. So
 * pushing a row here is what Save writes.
 *
 * ---------------------------------------------------------------------------------------------
 * WHAT EACH ROW SHOWS DEPENDS ON ITS HANDLE METHOD, looked up in the resolved eventNotificationTypes
 * list. Each dependent control is hidden AND disabled together, and `disabled` is what keeps a
 * hidden control out of core/model.js valid().
 *
 * PRESERVED: an unrecognised handle method finds no type, and the control is then hidden rather than
 * shown — which is what returning false does here.
 *
 */

import { mountStep } from './shell.js';
import * as dom from '../core/dom.js';
import * as model from '../core/model.js';
import * as validation from '../services/validation.js';

/** Handle methods that clear dbCommandFieldValue (handleMethodChange, line 108). */
const NO_DB_COMMAND = ['DocumentRetrieval', 'FileStore', 'FileStoreAndDocumentRetrieval', 'Print',
    'BatchProcessingAwardLetterPrint', 'ApiIntegration', 'PowerFAIDS'];

/** Handle methods that use a file store type (handleMethodChange, lines 111-116). */
const FILE_STORE_METHODS = ['FileStore', 'FileStoreAndDocumentRetrieval'];

/**
 * Handle methods that do NOT need a database connection. The 'None' branch asks whether any row
 * uses a method outside this list; if so the connection is still required.
 *
 * NOTE 'AwardLetterPrint' appears here and 'Print' does not, which is the REVERSE of NO_DB_COMMAND
 * above. Both lists are as they have always been; the asymmetry is not a transcription error.
 */
const NO_DATABASE_METHODS = ['DocumentRetrieval', 'FileStore', 'FileStoreAndDocumentRetrieval',
    'AwardLetterPrint', 'BatchProcessingAwardLetterPrint', 'ApiIntegration', 'PowerFAIDS'];

/**
 * The controls whose visibility follows the row's handle method, and the eventNotificationTypes
 * property each one reads. The database command box is handled separately in refreshRow(): it is
 * never hidden, only disabled and conditionally required.
 */
const DEPENDENT_CONTROLS = [
    { selector: '.cl-file-store-type', flag: 'isFileStoreTypeRequired' },
    { selector: '.cl-file-store-name', flag: 'isFileStoreTypeRequired' },
    { selector: '.cl-batch-name', flag: 'isBatchProcessingRequired' },
    { selector: '.cl-api-endpoint-name', flag: 'isApiIntegrationRequired' }
];

export function mount(view, locals) {
    return mountStep(view, locals, ({ config, form, refresh }) => {
        const notifications = config.campusLogicSection.eventNotifications;
        const connection = config.campusLogicSection.clientDatabaseConnection;
        const fileStores = config.campusLogicSection.fileStoreSettings.fileStores || [];
        const types = locals.eventNotificationTypes || [];
        const definitions = locals.eventNotificationDefinitions || [];

        const host = view.querySelector('#eventNotificationRows');
        const rowTemplate = view.querySelector('#eventNotificationRowTemplate');
        const typeSelect = view.querySelector('#connectionStringType');
        const dsn = {
            name: view.querySelector('#dsnName'),
            user: view.querySelector('#dsnUser'),
            password: view.querySelector('#dsnPassword')
        };

        // vm.usingDatabase. Set by onConnectionStringTypeChange and read by the last alert only.
        let usingDatabase = connection.connectionString !== '';

        /* --------------------------------------------------------- rows */

        /** Returns false for an unrecognised handle method, which hides the control. */
        function typeFlag(handleMethod, property) {
            if (!handleMethod) {
                return false;
            }
            const type = types.filter((t) => t.eventNotificationTypeId == handleMethod)[0];   // eslint-disable-line eqeqeq
            return !!(type && type[property]);
        }

        /** Applies one row's handle method to its four dependent controls. */
        function refreshRow(row) {
            const handleMethod = row.querySelector('.cl-handle-method').value;
            for (const control of DEPENDENT_CONTROLS) {
                const el = row.querySelector(control.selector);
                const on = typeFlag(handleMethod, control.flag);
                el.hidden = !on;
                el.disabled = !on;
            }
            // The command box is never hidden, only disabled and conditionally required.
            const command = row.querySelector('.cl-db-command');
            const commandEnabled = typeFlag(handleMethod, 'isCommandAttributeRequired');
            command.disabled = !commandEnabled;
            command.required = commandEnabled;
        }

        function refreshRows() {
            for (const row of [...host.children]) {
                refreshRow(row);
            }
        }

        function renderRows() {
            host.textContent = '';
            notifications.forEach((notification, index) => {
                const row = rowTemplate.content.firstElementChild.cloneNode(true);
                row.dataset.eventIndex = index;
                const path = 'campusLogicSection.eventNotifications.' + index + '.';

                const eventId = row.querySelector('.cl-event-id');
                eventId.name = path + 'eventNotificationId';
                // The placeholder. Its value is 0, the same sentinel a new row gets; the displayed
                // text is unchanged. Guide §7.38.
                eventId.appendChild(option('0', 'All - 0'));
                for (const definition of definitions) {
                    eventId.appendChild(option(
                        definition.eventNotificationId,
                        definition.eventNotificationId + ' - ' + definition.eventNotificationName
                    ));
                }

                const handleMethod = row.querySelector('.cl-handle-method');
                handleMethod.name = path + 'handleMethod';
                for (const type of types) {
                    handleMethod.appendChild(option(type.eventNotificationTypeId, type.label));
                }

                row.querySelector('.cl-file-store-type').name = path + 'fileStoreType';
                row.querySelector('.cl-file-store-name').name = path + 'fileStoreName';
                row.querySelector('.cl-batch-name').name = path + 'batchName';
                row.querySelector('.cl-api-endpoint-name').name = path + 'apiEndpointName';
                row.querySelector('.cl-db-command').name = path + 'dbCommandFieldValue';
                // The last remaining row cannot be removed.
                row.querySelector('.cl-remove-event').hidden = notifications.length === 1;

                host.appendChild(row);
            });
            // Fills every control just created, including the rows' seven each.
            model.load(view, config);
            refreshRows();
        }

        function option(value, text) {
            const el = document.createElement('option');
            el.value = value;
            el.textContent = text;
            return el;
        }

        /* --------------------------------------------------------- the four cross-page alerts */

        /**
         * The four cross-page alerts, each one `hidden` toggle.
         *
         * The last one differs from the other three: it stays hidden until ValidateConfigurations
         * has reported missingFileStore, because a store an event names may not have been added
         * yet. See validation.hasMissingFileStore.
         */
        function refreshAlerts() {
            view.querySelector('#duplicateEvent').hidden = !validation.checkForDuplicateEvent();
            view.querySelector('#invalidBatchName').hidden = !validation.checkForInvalidBatchName();
            view.querySelector('#invalidApiEndpointName').hidden = !validation.hasInvalidApiEndpointName();
            view.querySelector('#missingFileStore').hidden = !validation.hasMissingFileStore();
        }

        /* --------------------------------------------------------- the connection block */

        /** Composes the three DSN boxes into the single stored connection string. */
        function composeDsn() {
            connection.connectionString = 'DSN=' + dsn.name.value + ';UID=' + dsn.user.value
                + ';PWD=' + dsn.password.value;
        }

        /** Switching connection type rewrites, or clears, the stored connection string. */
        function onConnectionStringTypeChange() {
            switch (typeSelect.value) {
                case 'c':
                    usingDatabase = true;
                    if (connection.connectionString.indexOf('DSN') >= 0) {
                        connection.connectionString = '';
                    }
                    break;
                case 'n':
                    connection.connectionString = '';
                    if (notifications.some((n) => NO_DATABASE_METHODS.indexOf(n.handleMethod) === -1)) {
                        usingDatabase = true;
                        validation.state.pageValidations.connectionStringValid = false;
                    } else {
                        usingDatabase = false;
                    }
                    break;
                case 'd':
                    usingDatabase = true;
                    composeDsn();
                    break;
                default:
                    break;
            }
            // Re-render the connection-string input from what we just wrote.
            model.write(form.elements['campusLogicSection.clientDatabaseConnection.connectionString'],
                connection.connectionString);
            refreshConnectionBlock();
        }

        /** Which connection fields show, and the three result alerts. */
        function refreshConnectionBlock() {
            const type = typeSelect.value;
            const pv = validation.state.pageValidations || {};

            view.querySelector('#connectionStringFields').hidden = type !== 'c';
            view.querySelector('#dsnFields').hidden = type !== 'd';
            view.querySelector('#testConnectionRow').hidden = type === 'n';

            view.querySelector('#connectionTestPassed').hidden =
                !(pv.connectionStringValid && pv.eventNotificationsConnectionTested);
            view.querySelector('#connectionTestFailed').hidden =
                !(!pv.connectionStringValid && pv.eventNotificationsConnectionTested);

            view.querySelector('#connectionRequired').hidden = !(
                (usingDatabase && !connection.connectionString && (type === 'c' || type === 'n'))
                || (usingDatabase && type === 'd' && !dsn.name.value)
            );
        }

        /**
         * The stored string is the only source of truth; these three boxes are derived from it.
         */
        function parseConnectionString() {
            if (connection.connectionString.indexOf('DSN') >= 0) {
                typeSelect.value = 'd';
                for (const pair of connection.connectionString.split(';')) {
                    const [key, value] = pair.split('=');
                    switch (key.toUpperCase()) {
                        case 'DSN':
                            dsn.name.value = value;
                            break;
                        case 'PWD':
                            dsn.password.value = value;
                            break;
                        case 'UID':
                            dsn.user.value = value;
                            break;
                        default:
                            break;
                    }
                }
            } else if (connection.connectionString !== '') {
                typeSelect.value = 'c';
            } else {
                typeSelect.value = 'n';
            }
        }

        /* --------------------------------------------------------- wiring */

        const offs = [
            // Delegated, so rows created later are covered. core/model.js's own listeners are
            // registered first — mountStep calls track() before the page's init — so the
            // configuration already holds the new value when these run.
            dom.on(host, 'change', (event) => {
                const row = event.target.closest('[data-event-index]');
                if (!row) {
                    return;
                }
                const index = Number(row.dataset.eventIndex);
                if (event.target.classList.contains('cl-handle-method')) {
                    // NOTE there is no alert recompute here: handleMethodChange force-hides the two
                    // it can affect, and they stay hidden until something else recomputes them.
                    onConnectionStringTypeChange();
                    handleMethodChange(notifications[index]);
                    model.load(view, config);
                    refreshRow(row);
                } else if (event.target.classList.contains('cl-event-id')) {
                    // core/model.js reads a <select> as a string, but eventNotificationId is an
                    // `int` server-side, and checkForDuplicateEvent SORTS on this field — a list
                    // holding both 9 and "10" compares inconsistently. Hence the coercion.
                    notifications[index].eventNotificationId = Number(event.target.value);
                    refreshAlerts();
                }
                refresh();
            }),
            // The three typed name boxes, and only those three. Each one has a cross-page alert that
            // has to keep up with what is being typed.
            dom.on(host, 'input', (event) => {
                if (event.target.classList.contains('cl-batch-name')
                    || event.target.classList.contains('cl-api-endpoint-name')
                    || event.target.classList.contains('cl-file-store-name')) {
                    refreshAlerts();
                }
            }),
            dom.on(host, 'click', (event) => {
                const button = event.target.closest('[data-action="remove-event"]');
                if (!button) {
                    return;
                }
                notifications.splice(Number(button.closest('[data-event-index]').dataset.eventIndex), 1);
                renderRows();
                refreshAlerts();
                refresh();
            }),
            dom.on(view.querySelector('#addEventNotification'), 'click', (event) => {
                // href="" would reload the page.
                event.preventDefault();
                // The default handle method is the FIRST type, so this throws if the endpoint
                // returned nothing. Preserved.
                notifications.push({
                    eventNotificationId: 0,
                    handleMethod: types[0].eventNotificationTypeId,
                    dbCommandFieldValue: ''
                });
                renderRows();
                refreshAlerts();
                refresh();
            }),
            dom.on(typeSelect, 'change', () => {
                onConnectionStringTypeChange();
                refresh();
            }),
            dom.on(view.querySelector('#dsnFields'), 'input', () => {
                composeDsn();
                model.write(form.elements['campusLogicSection.clientDatabaseConnection.connectionString'],
                    connection.connectionString);
                refreshConnectionBlock();
            }),
            dom.on(view.querySelector('#testConnectionString'), 'click', () => {
                if (typeSelect.value === 'd') {
                    composeDsn();
                }
                // .then(refresh) for the same reason as pages/credentials.js: the shell's busy-event
                // repaint runs BEFORE the handlers that set eventNotificationsConnectionTested, so
                // the two alerts would show the previous result. Guide §7.43.
                validation.testEventNotifications(form).then(refresh);
            })
        ];

        /**
         * Clears the fields the new handle method does not use, and hides the two alerts that go
         * with them. Writes to the row object; the caller re-loads the DOM from it.
         */
        function handleMethodChange(notification) {
            if (NO_DB_COMMAND.indexOf(notification.handleMethod) !== -1) {
                notification.dbCommandFieldValue = '';
            }
            if (FILE_STORE_METHODS.indexOf(notification.handleMethod) === -1) {
                notification.fileStoreType = '';
                notification.fileStoreName = '';
            } else {
                notification.fileStoreType = 'Shared';
                // Seeded with the first store rather than left blank, so the common single-store
                // case needs no typing and the name is one that exists. Blank still resolves to the
                // first store server-side, so clearing it is not an error.
                notification.fileStoreName = fileStores.length > 0 ? fileStores[0].name : '';
            }
            if (notification.handleMethod !== 'BatchProcessingAwardLetterPrint') {
                notification.batchName = '';
                view.querySelector('#invalidBatchName').hidden = true;
            }
            if (notification.handleMethod !== 'ApiIntegration') {
                notification.apiEndpointName = '';
                view.querySelector('#invalidApiEndpointName').hidden = true;
            }
        }

        // --- mount, in this order.
        renderRows();
        refreshAlerts();
        parseConnectionString();
        onConnectionStringTypeChange();

        return {
            // The two test-result alerts come from an async validator. See pages/shell.js.
            refresh: refreshConnectionBlock,
            destroy() {
                for (const off of offs) {
                    off();
                }
            }
        };
    });
}
