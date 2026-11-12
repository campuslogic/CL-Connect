/**
 * pages/batchProcessing.js — the Batch Processing step and its dialog. This is the shape every grid
 * page in the wizard follows, so it is the one to read first. Three things keep it small:
 *
 *  1. THE GRID IS A <table>, RENDERED BY A LOOP. Two <template> elements in the view hold the
 *     markup; render() clones them and sets textContent, at mount and after any add, edit or
 *     delete. There is no grid component and no repeat directive.
 *
 *  2. A ROW'S POSITION IN ITS <tbody> IS ITS POSITION IN THE ARRAY, read straight off the DOM. That
 *     is what removes a whole family of defects: an `index` property stamped onto each row and never
 *     renumbered on delete used to make an edit overwrite the wrong record. Guide §7.33.
 *
 *  3. THE DIALOG EDITS A PLAIN OBJECT THROUGH core/model.js. Its controls are named
 *     `batchProcess.<field>` and the row is handed over as { batchProcess: row }, so load(), track()
 *     and the type-coercion table are the same code the wizard pages use.
 *
 * PRESERVED, deliberately:
 *   - `pageValid` is read ONCE at mount, so "At least one batch process is required" reflects
 *     validity as of page entry. Reading it live would make the message flicker as each folder-path
 *     permission check settles.
 *   - Cancel discards edits: the dialog works on a copy and copies again on save.
 */

import { mountStep } from './shell.js';
import { emptyRow } from './grid.js';
import * as dom from '../core/dom.js';
import * as model from '../core/model.js';
import * as util from '../core/util.js';
import * as folderPicker from '../components/folderPicker.js';
import * as validation from '../services/validation.js';
import { openModal } from '../core/modal.js';

const MODAL_TEMPLATE = 'setup/template?templateName=AddBatchProcessModal';

/**
 * awardLetterPrint is the only type with a friendly name; anything else falls back to its own
 * typeName so a heading never renders as " - Batch Processes".
 */
function displayName(typeName) {
    switch (typeName) {
        case 'awardLetterPrint':
            return 'Communication Print';
        default:
            return typeName ?? '';
    }
}

/* ------------------------------------------------------------------ the dialog */

/**
 * Opens the Add/Edit dialog for one batch process.
 *
 * @param {object[]} list      the type's batchProcesses array, mutated in place on save
 * @param {number}   editing   position being edited, or -1 to add
 * @param {string}   typeName  decides which fieldset the dialog shows
 * @param {boolean}  pageValid the mount-time snapshot; drives .show-errors, see below
 * @returns {Promise<boolean>} true when the dialog saved
 */
function openBatchProcessDialog(list, editing, typeName, pageValid) {
    // The Add defaults. filePath is genuinely absent: the folder picker creates it on first edit.
    const row = editing === -1
        ? {
            batchName: null,
            maxBatchSize: 0,
            fileNameFormat: '',
            batchExecutionMinutes: 0,
            indexFileEnabled: false,
            fileDefinitionName: null
        }
        : util.copy(list[editing]);

    return openModal({
        template: MODAL_TEMPLATE,
        windowClass: 'show modal-medium',
        backdrop: 'static',
        setup(content, modal) {
            const host = { batchProcess: row };
            const fields = content.querySelector('#awardLetterPrintFields');
            const fileDefinitionRow = content.querySelector('#fileDefinitionNameRow');
            const msg = (id) => content.querySelector('#' + id);

            content.querySelector('#batchProcessModalTitle').textContent =
                [editing === -1 ? 'Add' : 'Edit', displayName(typeName), 'Batch Process']
                    .filter(Boolean)
                    .join(' ');
            // An unknown type gets an empty dialog.
            fields.hidden = typeName !== 'awardLetterPrint';

            model.load(content, host);
            const offTrack = model.track(content, host);
            // After load(), because the picker names its own input and then seeds it.
            const offPicker = folderPicker.mountAll(content, host);
            // The picker's Required span is CSS-driven (app.css §11), and .show-errors is its
            // "page is known invalid" half — so the dialog opts in with the page's own snapshot.
            model.showErrors(content, !pageValid);

            // Reads the DOM rather than row.indexFileEnabled so it cannot depend on whether
            // model.track's listener happens to run before this one. A RadioNodeList's .value is
            // the checked radio's value, and '' when neither is checked.
            function showFileDefinition() {
                fileDefinitionRow.hidden = fields.elements['batchProcess.indexFileEnabled'].value !== 'true';
            }

            /** Every message is hidden first, so a fixed problem stops reporting itself. */
            function formIsValid() {
                let ok = true;
                msg('batchNameRequired').hidden = true;
                msg('batchNameDuplicate').hidden = true;
                msg('batchNameLength').hidden = true;
                msg('maxBatchSizeRequired').hidden = true;
                msg('batchExecutionMinutesRequired').hidden = true;
                msg('fileDefinitionNameRequired').hidden = true;
                msg('batchSizeWithIndex').hidden = true;

                if (util.isNullOrWhitespace(row.batchName)) {
                    ok = false;
                    msg('batchNameRequired').hidden = false;
                }
                if (row.batchName && row.batchName.length > 25) {
                    ok = false;
                    msg('batchNameLength').hidden = false;
                }
                // isNullOrWhitespace(0) is FALSE, which is why the Add default of 0 does not report
                // "Required" here. core/util.js documents it.
                if (util.isNullOrWhitespace(row.maxBatchSize)) {
                    ok = false;
                    msg('maxBatchSizeRequired').hidden = false;
                }
                if (util.isNullOrWhitespace(row.batchExecutionMinutes)) {
                    ok = false;
                    msg('batchExecutionMinutesRequired').hidden = false;
                }
                // The old check excluded "itself" by index; the position does it directly.
                const duplicates = list.filter((p, i) => p.batchName === row.batchName && i !== editing);
                if (duplicates.length > 0) {
                    ok = false;
                    msg('batchNameDuplicate').hidden = false;
                }
                if (row.indexFileEnabled == true && util.isNullOrWhitespace(row.fileDefinitionName)) {   // eslint-disable-line eqeqeq
                    ok = false;
                    msg('fileDefinitionNameRequired').hidden = false;
                }
                if (row.indexFileEnabled == true && row.maxBatchSize != 1) {   // eslint-disable-line eqeqeq
                    ok = false;
                    msg('batchSizeWithIndex').hidden = false;
                }
                return ok;
            }

            const offs = [
                offTrack,
                offPicker,
                dom.on(content, 'change', showFileDefinition),
                dom.on(content, 'click', (event) => {
                    const button = event.target.closest('[data-action]');
                    // The folder picker's own Select/Test buttons carry data-action too, and it
                    // stops their clicks reaching here by handling them on its own element — but
                    // click bubbles, so they must be ignored explicitly.
                    if (!button || button.closest('cl-folder-picker')) {
                        return;
                    }
                    if (button.dataset.action === 'cancel') {
                        modal.dismiss();
                        return;
                    }
                    if (!formIsValid()) {
                        return;
                    }
                    const saved = util.copy(row);
                    if (editing === -1) {
                        list.push(saved);
                    } else {
                        list[editing] = saved;
                    }
                    modal.close(true);
                })
            ];

            showFileDefinition();

            return () => {
                for (const off of offs) {
                    off();
                }
            };
        }
        // Resolves true on save and undefined on Cancel or Esc — core/modal.js never rejects, so
        // the caller must test the value rather than just chaining off it.
    });
}

/* ------------------------------------------------------------------ the page */

export function mount(view, locals) {
    return mountStep(view, locals, ({ config }) => {
        const list = config.campusLogicSection.batchProcessingTypesList;
        const pageValid = validation.state.pageValidations.batchProcessingSettingsValid;

        const host = view.querySelector('#batchProcessingTypeList');
        const typeTemplate = view.querySelector('#batchProcessingTypeTemplate');
        const rowTemplate = view.querySelector('#batchProcessRowTemplate');
        const typeSelect = view.querySelector('#batchProcessingType');
        const duplicateType = view.querySelector('#duplicateType');

        function renderRow(process) {
            const tr = rowTemplate.content.firstElementChild.cloneNode(true);
            const cells = tr.cells;
            cells[0].textContent = process.batchName ?? '';
            cells[1].textContent = process.maxBatchSize ?? '';
            cells[2].textContent = process.filePath ?? '';
            cells[3].textContent = process.fileNameFormat ?? '';
            cells[4].textContent = process.batchExecutionMinutes ?? '';
            cells[5].textContent = process.fileDefinitionName ?? '';
            return tr;
        }

        function render() {
            host.textContent = '';
            list.forEach((type, index) => {
                const block = typeTemplate.content.firstElementChild.cloneNode(true);
                block.dataset.typeIndex = index;
                block.querySelector('.cl-type-display-name').textContent = displayName(type.typeName);

                const tbody = block.querySelector('tbody');
                for (const process of type.batchProcesses) {
                    tbody.appendChild(renderRow(process));
                }
                if (type.batchProcesses.length === 0) {
                    tbody.appendChild(emptyRow(7));
                }
                block.querySelector('.cl-no-processes').hidden =
                    !(type.batchProcesses.length === 0 && !pageValid);

                host.appendChild(block);
            });
        }

        /** Adds a batch processing type, refusing a duplicate. */
        function addType() {
            const typeName = typeSelect.value;
            if (list.some((type) => type.typeName === typeName)) {
                duplicateType.hidden = false;
                return;
            }
            duplicateType.hidden = true;
            list.push({ typeName, batchProcesses: [] });
            render();
        }

        async function onGridClick(event) {
            const button = event.target.closest('[data-action]');
            if (!button) {
                return;
            }
            const block = button.closest('[data-type-index]');
            const type = list[Number(block.dataset.typeIndex)];
            const action = button.dataset.action;

            if (action === 'delete-type') {
                // Matched by typeName rather than position, as it always has been.
                const i = list.findIndex((t) => t.typeName === type.typeName);
                if (i !== -1) {
                    list.splice(i, 1);
                }
                render();
                return;
            }

            if (action === 'add-process') {
                const saved = await openBatchProcessDialog(type.batchProcesses, -1, type.typeName, pageValid);
                if (saved) {
                    render();
                }
                return;
            }

            // The row's position in its <tbody> IS its position in the array — see the header.
            // sectionRowIndex counts within the tbody, so no allowance for <thead> is needed.
            const position = button.closest('tr').sectionRowIndex;

            if (action === 'delete-process') {
                type.batchProcesses.splice(position, 1);
                render();
                return;
            }
            if (action === 'edit-process') {
                const saved = await openBatchProcessDialog(type.batchProcesses, position, type.typeName, pageValid);
                if (saved) {
                    render();
                }
            }
        }

        const offs = [
            dom.on(view.querySelector('#addBatchProcessingType'), 'click', addType),
            dom.on(host, 'click', onGridClick)
        ];

        render();

        return () => {
            for (const off of offs) {
                off();
            }
        };
    });
}
