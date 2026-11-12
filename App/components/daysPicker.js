/**
 * components/daysPicker.js — the "which days does this job run" control, used by five scheduled
 * jobs (ISIR upload, communication upload, communication file mapping upload, data file upload,
 * ISIR corrections).
 *
 * TWO FACTS DECIDE THE DESIGN, and both are silent-corruption risks.
 *
 * 1. THURSDAY IS 'THUR', NOT 'THU'. A three-letter guess breaks Thursday scheduling with no
 *    visible error anywhere.
 *
 * 2. SELECTION ORDER IS PRESERVED, NOT CANONICALISED. The stored string round-trips verbatim
 *    through a load/save, so a <select multiple> is not usable here: it reports selectedOptions in
 *    DOM order, which would silently rewrite an existing "MON,SUN" to "SUN,MON" on the next save
 *    of a page nobody edited. A checkbox group lets this file control the order — push on check,
 *    splice on uncheck.
 *
 * The bound array is MUTATED IN PLACE, never replaced: pages/shell.js's concatenateDaysToRun()
 * joins that same reference at save time.
 */

import * as model from '../core/model.js';

/** The exact values written into Web.config. Do not abbreviate THUR. */
const DAYS = [
    { text: 'Sunday', value: 'SUN' },
    { text: 'Monday', value: 'MON' },
    { text: 'Tuesday', value: 'TUE' },
    { text: 'Wednesday', value: 'WED' },
    { text: 'Thursday', value: 'THUR' },
    { text: 'Friday', value: 'FRI' },
    { text: 'Saturday', value: 'SAT' }
];

let uid = 0;

/**
 * Mounts every <cl-days-picker data-path="..."> under `root`.
 *
 * @returns {Function} teardown for all of them
 */
export function mountAll(root, config) {
    const teardowns = [...root.querySelectorAll('cl-days-picker[data-path]')]
        .map((el) => mount(el, config));
    return () => teardowns.forEach((off) => off());
}

function mount(el, config) {
    const path = el.dataset.path;
    const value = model.get(config, path) || [];
    const name = el.getAttribute('name') || ('cl-days-' + (++uid));
    const message = el.nextElementSibling;

    const fieldset = document.createElement('fieldset');
    fieldset.className = 'cl-days';

    for (const day of DAYS) {
        const id = name + '-' + day.value;
        const label = document.createElement('label');
        label.className = 'cl-days-item';
        label.htmlFor = id;

        const box = document.createElement('input');
        box.type = 'checkbox';
        box.className = 'cl-check';
        box.id = id;
        box.name = name;
        box.value = day.value;
        box.checked = value.indexOf(day.value) !== -1;

        label.append(box, document.createTextNode(day.text));
        fieldset.appendChild(label);
    }
    el.appendChild(fieldset);

    /**
     * THE "Required" MESSAGE CANNOT BE A CSS RULE. services/setup.js's day-splitting preserves the
     * quirk that ''.split(',') is [''] — length 1, not 0 — so an UNSET daysToRun shows no message.
     * A :has(input:checked) rule would count checkboxes and light it up on exactly that case.
     */
    function mark() {
        fieldset.dataset.empty = value.length === 0 ? 'true' : 'false';
        if (message && message.classList.contains('cl-days-required')) {
            message.hidden = value.length > 0;
        }
    }

    /**
     * 'click', NOT 'change'. A checkbox click dispatches click -> input -> change, so committing
     * here keeps this array authoritative before core/model.js's page-root listeners see the edit.
     * Keyboard activation (Space) also dispatches click, so nothing is lost.
     */
    function onClick(event) {
        const box = event.target;
        if (box.type !== 'checkbox') {
            return;
        }
        const i = value.indexOf(box.value);
        if (box.checked && i === -1) {
            value.push(box.value);   // selection order — see the header
        } else if (!box.checked && i !== -1) {
            value.splice(i, 1);
        }
        // A no-op reassignment when the path already held this array, and the real write when it
        // did not exist. Either way the configuration ends up holding it.
        model.put(config, path, value);
        mark();
    }

    fieldset.addEventListener('click', onClick);
    mark();

    return () => {
        fieldset.removeEventListener('click', onClick);
        fieldset.remove();
    };
}
