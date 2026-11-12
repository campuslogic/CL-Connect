/**
 * pages/environment.js — the first wizard step: pick an environment, tick what to enable.
 *
 */

import { mountStep } from './shell.js';
import * as dom from '../core/dom.js';
import * as model from '../core/model.js';
import * as eventProperty from '../services/eventProperty.js';
import * as validation from '../services/validation.js';

/** The eight settings setDocumentSettings() switches off. */
const DEPENDENT_SETTINGS = [
    'campusLogicSection.documentSettings.documentsEnabled',
    'campusLogicSection.storedProceduresEnabled',
    'campusLogicSection.fileStoreSettings.fileStoreEnabled',
    'campusLogicSection.awardLetterPrintSettings.awardLetterPrintEnabled',
    'campusLogicSection.batchProcessingEnabled',
    'campusLogicSection.apiIntegrationsEnabled',
    'campusLogicSection.fileDefinitionsEnabled',
    'campusLogicSection.powerFaidsEnabled'
];

export function mount(view, locals) {
    return mountStep(view, locals, ({ config, form, refresh }) => {
        const select = view.querySelector('#environmentdropdown');
        const eventNotifications = view.querySelector('#eventNotifications');
        const subChecks = [...view.querySelectorAll('input[data-sub-check]')];

        // The fourth option: when auto-update is disabled the saved environment may be something
        // outside the three in the markup, and it has to stay selectable.
        if (config.appSettingsSection.disableAutoUpdate) {
            const environment = config.appSettingsSection.environment;
            const option = document.createElement('option');
            option.value = environment;
            option.textContent = environment;
            select.appendChild(option);
            // mountStep's model.load() ran before this page module, so the option did not exist to
            // be selected. Select it now.
            model.write(select, environment);
        }

        /**
         * Switching Event Notifications OFF switches off the eight settings that depend on it. The
         * path read here is the one the checkbox writes — see the header for the property that used
         * to be read instead, and for what that cost.
         */
        function setDocumentSettings() {
            if (!config.campusLogicSection.eventNotificationsEnabled) {
                for (const path of DEPENDENT_SETTINGS) {
                    model.put(config, path, false);
                }
                // Re-render the eight checkboxes from the configuration we just changed.
                model.load(view, config);
            }
        }

        /** The eight sub-checkboxes are disabled while Event Notifications is off. */
        function refreshSubChecks() {
            for (const cb of subChecks) {
                cb.disabled = !eventNotifications.checked;
            }
        }

        const offs = [
            dom.on(form, 'click', (event) => {
                const cb = event.target;
                if (!cb.matches || !cb.matches('input[type="checkbox"][data-page-valid]')) {
                    return;
                }
                // COMMIT BEFORE READING THE CONFIGURATION. `click` fires before `input`/`change`,
                // so core/model.js's track() has not stored this edit yet, and everything below
                // reads the configuration rather than the DOM: setDocumentSettings() ends with
                // model.load(), which rewrites every control from it, and refresh() decides which
                // step links are visible from the same paths. Without this line the Event
                // Notifications box could not be ticked at all — its own model.load() would write
                // the stale `false` straight back over the click — and the menu would repaint one
                // click behind. This is the only handler in the app bound to a config-bound control
                // rather than a button, which is why it is the only one that needs this.
                model.put(config, cb.name, model.read(cb));

                if (cb.checked) {
                    validation.addPageValidation(cb.dataset.pageValid);
                } else {
                    validation.removePageValidation(cb.dataset.pageValid);
                }
                if (cb === eventNotifications) {
                    setDocumentSettings();
                }
                refreshSubChecks();
                // Adding or removing a page validation changes the wizard menu's icons and the Save
                // button's state, so the shell has to repaint.
                refresh();
            }),
            dom.on(select, 'change', () => {
                // A <select> whose value matches no option reports '', which is the invalid case.
                validation.state.pageValidations.environmentValid = select.value !== '';
                refresh();
            })
        ];

        refreshSubChecks();

        // "update event properties each time the setup wizard loads (starts on environment page)".
        // Fire and forget: a failure leaves the property list exactly as it was.
        eventProperty.updateEventProperties().then(() => (
            eventProperty.getEventPropertyDisplayNames().then((data) => {
                config.campusLogicSection.eventPropertyValueAvailableProperties = data;
            })
        )).catch(() => { /* swallowed on purpose; see above */ });

        return () => {
            for (const off of offs) {
                off();
            }
        };
    });
}
