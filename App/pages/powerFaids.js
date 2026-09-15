/**
 * pages/powerFaids.js — replaces powerFaidsController.js
 */

import { mountStep } from './shell.js';
import { emptyRow } from './grid.js';
import * as dom from '../core/dom.js';
import * as model from '../core/model.js';
import * as util from '../core/util.js';
import * as validation from '../services/validation.js';
import { openModal } from '../core/modal.js';

const MODAL_TEMPLATE = 'setup/template?templateName=AddPowerFaidsModal';

/* Keys are the codes stored in Web.config. Do not prettify them. */
const OUTCOME = { documents: 'Documents', verification: 'Verification', both: 'Both' };
const REQUIRED_FOR = { D: 'Disbursement', P: 'Packaging' };
const LOCK = { Y: 'Locked', N: 'Unlocked' };
const STATUS = {
    1: 'Received',
    2: 'Not Reviewed',
    3: 'Approved',
    4: 'Incomplete',
    5: 'Not Received',
    6: 'Not Signed',
    7: 'Waived'
};
const VERIFICATION_OUTCOME = {
    N: 'Not Performed',
    S: 'Selected; Not Verified',
    V: 'Verified',
    W: 'Without Documentation'
};

/** An unrecognised code renders "N/A", as it always has. */
function label(labels, code) {
    return Object.prototype.hasOwnProperty.call(labels, code) ? labels[code] : 'N/A';
}

/* ------------------------------------------------------------------ the dialog */

/**
 * @param {object[]} list     powerFaidsList, mutated in place on save
 * @param {number}   editing  position being edited, or -1 to add
 * @returns {Promise<void>}   resolves when the dialog has closed, either way
 */
function openPowerFaidsDialog(list, editing) {
    // The Add defaults. shortName is genuinely absent; the dialog creates it on first edit.
    const row = editing === -1
        ? {
            event: null,
            transactionCategory: null,
            outcome: null,
            requiredFor: null,
            status: null,
            documentLock: null,
            verificationOutcome: null,
            verificationOutcomeLock: null
        }
        : util.copy(list[editing]);

    return openModal({
        template: MODAL_TEMPLATE,
        windowClass: 'show',
        backdrop: 'static',
        setup(content, modal) {
            const form = content.querySelector('#powerFaidsModalForm');
            const documentFields = content.querySelector('#powerFaidsDocumentFields');
            const verificationFields = content.querySelector('#powerFaidsVerificationFields');

            content.querySelector('#powerFaidsModalTitle').textContent =
                (editing === -1 ? 'Add' : 'Edit') + ' PowerFAIDS Record';

            model.load(content, { powerFaids: row });
            const offTrack = model.track(content, { powerFaids: row });

            // Read from the DOM so this cannot depend on listener order.
            function showSections() {
                const outcome = form.elements['powerFaids.outcome'].value;
                documentFields.hidden = !(outcome === 'documents' || outcome === 'both');
                verificationFields.hidden = !(outcome === 'verification' || outcome === 'both');
            }

            const offs = [
                offTrack,
                dom.on(content, 'change', showSections),
                dom.on(content, 'click', (event) => {
                    const button = event.target.closest('[data-action]');
                    if (!button) {
                        return;
                    }
                    if (button.dataset.action === 'cancel') {
                        // close(), not dismiss() — see the header.
                        modal.close();
                        return;
                    }
                    // Reveal the messages, then check validity. model.valid() skips controls under
                    // a [hidden] ancestor, so the two collapsed sections cannot block Save.
                    model.showErrors(content, true);
                    if (!model.valid(form)) {
                        return;
                    }
                    const saved = util.copy(row);
                    if (editing === -1) {
                        list.push(saved);
                    } else {
                        list[editing] = saved;
                    }
                    modal.close();
                })
            ];

            showSections();

            return () => {
                for (const off of offs) {
                    off();
                }
            };
        }
    });
}

/* ------------------------------------------------------------------ the page */

export function mount(view, locals) {
    return mountStep(view, locals, ({ config, form }) => {
        const list = config.campusLogicSection.powerFaidsList;
        const pageValid = validation.state.pageValidations.powerFaidsSettingsValid;

        const tbody = view.querySelector('#powerFaidsGrid tbody');
        const rowTemplate = view.querySelector('#powerFaidsRowTemplate');
        const batchMinutes = view.querySelector('#powerFaidsBatchMinutes');
        const noRecords = view.querySelector('#powerFaidsNoRecords');
        const pairings = view.querySelector('#powerFaidsPairings');

        function renderRow(record) {
            const tr = rowTemplate.content.firstElementChild.cloneNode(true);
            const cells = tr.cells;
            cells[0].textContent = record.event ?? '';
            cells[1].textContent = record.transactionCategory ?? '';
            cells[2].textContent = label(OUTCOME, record.outcome);
            // Short Name shows only for the two outcomes that have one.
            cells[3].textContent = record.outcome === 'documents' || record.outcome === 'both'
                ? (record.shortName ?? '')
                : 'N/A';
            cells[4].textContent = label(REQUIRED_FOR, record.requiredFor);
            cells[5].textContent = label(STATUS, record.status);
            cells[6].textContent = label(LOCK, record.documentLock);
            cells[7].textContent = label(VERIFICATION_OUTCOME, record.verificationOutcome);
            cells[8].textContent = label(LOCK, record.verificationOutcomeLock);
            return tr;
        }

        function render() {
            tbody.textContent = '';
            for (const record of list) {
                tbody.appendChild(renderRow(record));
            }
            if (list.length === 0) {
                tbody.appendChild(emptyRow(10));
            }
            noRecords.hidden = !(!pageValid && list.length === 0);
            pairings.hidden = !(!pageValid && list.length > 0);
        }

        /** Batch Execution Minutes follows the isBatch radio pair. */
        function showBatchMinutes() {
            batchMinutes.hidden = form.elements['campusLogicSection.powerFaidsSettings.isBatch'].value !== 'true';
        }

        async function onClick(event) {
            // Listener is on the <tbody>, so the folder picker's own [data-action] buttons — which
            // live above the grid — never reach here.
            const button = event.target.closest('[data-action]');
            if (!button) {
                return;
            }
            const position = button.closest('tr').sectionRowIndex;
            if (button.dataset.action === 'delete') {
                list.splice(position, 1);
                render();
                return;
            }
            await openPowerFaidsDialog(list, position);
            render();
        }

        const offs = [
            dom.on(form, 'change', showBatchMinutes),
            dom.on(tbody, 'click', onClick),
            dom.on(view.querySelector('#addPowerFaidsRecord'), 'click', async () => {
                await openPowerFaidsDialog(list, -1);
                render();
            })
        ];

        showBatchMinutes();
        render();

        return () => {
            for (const off of offs) {
                off();
            }
        };
    });
}
