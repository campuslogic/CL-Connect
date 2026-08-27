/**
 * pages/isirCorrections.js — replaces the isirCorrectionsController.js
 */

import { mountStep } from './shell.js';
import * as dom from '../core/dom.js';

export function mount(view, locals) {
    return mountStep(view, locals, ({ form }) => {
        const tdClient = form.elements['campusLogicSection.isirCorrectionsSettings.tdClientEnabled'];
        const section = view.querySelector('#tdClientSection');

        const timeToRun = view.querySelector('#timeToRun');
        const timeRequired = view.querySelector('#timeToRunRequired');
        const timeFormat = view.querySelector('#timeToRunFormat');

        function showSection() {
            // A RadioNodeList: .value is the checked radio's value, '' when neither is checked.
            section.hidden = tdClient.value !== 'true';
        }

        function showTimeErrors() {
            timeRequired.hidden = !timeToRun.validity.valueMissing;
            timeFormat.hidden = !timeToRun.validity.patternMismatch;
        }

        const offs = [
            dom.on(form, 'change', showSection),
            dom.on(timeToRun, 'input', showTimeErrors)
        ];

        showSection();

        return () => {
            for (const off of offs) {
                off();
            }
        };
    });
}
