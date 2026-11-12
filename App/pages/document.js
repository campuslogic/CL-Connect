/**
 * pages/document.js — the Documents step.
 *
 * It does one thing, and it is the only instance of it in the app: THE FOLDER PICKER IS REQUIRED
 * ONLY WHEN INDEX FILES ARE ENABLED. Every other picker is unconditionally required or
 * unconditionally not, which is why components/folderPicker.js reads a plain `required` attribute
 * once at mount and this page sets the property directly afterwards. Nothing else is needed: CSS
 * decides the message from the live validity, and core/model.js valid() skips the hidden section's
 * own required input.
 */

import { mountStep } from './shell.js';
import * as dom from '../core/dom.js';

export function mount(view, locals) {
    return mountStep(view, locals, ({ view: root, form }) => {
        const indexFile = form.elements['campusLogicSection.documentSettings.indexFileEnabled'];
        const section = root.querySelector('#documentIndexFileFields');
        // The picker's input, created by components/folderPicker.js during mountStep.
        const path = root.querySelector('cl-folder-picker input');

        function refresh() {
            // A RadioNodeList: .value is the checked radio's value, '' when neither is checked.
            const enabled = indexFile.value === 'true';
            section.hidden = !enabled;
            path.required = enabled;
        }

        const off = dom.on(form, 'change', refresh);
        refresh();

        return off;
    });
}
