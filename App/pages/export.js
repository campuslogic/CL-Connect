/**
 * pages/export.js — the Export Data page.
 *
 * SELECTION ORDER IS PRESERVED, which is why `tables` is an array maintained on every change rather
 * than a querySelectorAll(':checked') at submit time. The POSTed array is in CLICK order: clicking
 * Log then BatchProcessRecord sends ["Log","BatchProcessRecord"] where :checked reports the reverse.
 * Reading the DOM at submit would silently reorder it — the same failure class as the days picker.
 *
 * The two alert() calls are what this page has always used. It sits outside the wizard, so it has
 * neither the shell's #stepError element nor any other in-page message area.
 */

import * as dom from '../core/dom.js';
import * as exportService from '../services/export.js';

export function mount(view, locals) {
    const config = (locals && locals.config) || null;

    // Guarded rather than relying on the route resolve: a page module should not depend on one for
    // its own soundness.
    const enabled = !!(config
        && config.campusLogicSection
        && config.campusLogicSection.dataFileUploadSettings
        && config.campusLogicSection.dataFileUploadSettings.dataFileUploadEnabled);

    const form = view.querySelector('#exportForm');
    form.hidden = !enabled;
    view.querySelector('#exportDisabledNotice').hidden = enabled;

    /** In click order, not DOM order — see the header. */
    const tables = [];

    const offChange = dom.on(form, 'change', (event) => {
        const cb = event.target;
        if (cb.type !== 'checkbox') {
            return;
        }
        const i = tables.indexOf(cb.value);
        if (cb.checked && i === -1) {
            tables.push(cb.value);
        } else if (!cb.checked && i !== -1) {
            tables.splice(i, 1);
        }
    });

    const offSubmit = dom.on(form, 'submit', (event) => {
        // Every form in this app is actionless, so submitting would reload the whole SPA.
        event.preventDefault();

        const days = view.querySelector('#exportToDate').valueAsNumber;

        exportService.exportLogs(days, tables).then((response) => {
            console.log(response);
            alert('Logs exported successfully');
        }).catch((error) => {
            console.error(error);
            alert('Failed to export logs');
        });
    });

    return () => {
        offChange();
        offSubmit();
    };
}
