/**
 * pages/storedProcedure.js — the Stored Procedure step and its parameter dialog. The grid pattern is
 * pages/batchProcessing.js's; read that one first.
 *
 * WHAT IS SPECIFIC HERE IS THAT THE NAME BOX IS NOT A CONFIGURATION FIELD. It is a staging box: type
 * a name, press Add Stored Procedure, and a new entry appears with an empty parameter list. So two
 * pieces of page state are local variables:
 *
 *   storedProcedureName  starts null and becomes a string on the first keystroke, which is what the
 *                        Add button's disabled state tests — so Add is disabled until the box is
 *                        typed in, and stays enabled afterwards even if the box is cleared to ''.
 *   pageValid            the snapshot of pageValidations.storedProcedureValid taken at mount, which
 *                        the blur handler then forces to true. It drives the "At least one Stored
 *                        Procedure is required" message.
 *
 * PRESERVED, and surprising enough to spell out: BLURRING THE NAME BOX MARKS THE WHOLE STEP VALID.
 * The blur handler sets the shared pageValidations.storedProcedureValid to true, so leaving that
 * field clears this step's warning icon regardless of what is configured. The icon comes back the
 * next time a validator runs.
 */

import { mountStep } from './shell.js';
import { emptyRow } from './grid.js';
import * as dom from '../core/dom.js';
import * as model from '../core/model.js';
import * as util from '../core/util.js';
import * as validation from '../services/validation.js';
import { openModal } from '../core/modal.js';

const MODAL_TEMPLATE = 'setup/template?templateName=AddParameterModal';

/* ------------------------------------------------------------------ the dialog */

/**
 * @param {object[]} list     the stored procedure's parameterList, mutated in place on save
 * @param {number}   editing  position being edited, or -1 to add
 * @param {string[]} sources  eventPropertyValueAvailableProperties, or undefined when not fetched
 * @returns {Promise<boolean>} true when the dialog saved
 */
function openParameterDialog(list, editing, sources) {
    // The Add defaults.
    const row = editing === -1
        ? { source: null, dataType: 'int', name: null, length: null }
        : util.copy(list[editing]);

    return openModal({
        template: MODAL_TEMPLATE,
        windowClass: 'show',
        backdrop: 'static',
        setup(content, modal) {
            const host = { parameter: row };
            const form = content.querySelector('#parameterModalForm');
            const lengthRow = content.querySelector('#parameterLengthRow');
            const sourceSelect = content.querySelector('#inputPropertyFieldValue');
            const msg = (id) => content.querySelector('#' + id);

            content.querySelector('#parameterModalTitle').textContent =
                (editing === -1 ? 'Add' : 'Edit') + ' Parameter';

            // Built BEFORE model.load, so an existing parameter's stored source has an option to
            // select.
            for (const name of sources || []) {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                sourceSelect.appendChild(option);
            }

            model.load(content, host);
            const offTrack = model.track(content, host);

            // Read from the DOM so this cannot depend on whether model.track runs before it.
            function showLength() {
                lengthRow.hidden = form.elements['parameter.dataType'].value === 'int';
            }

            /** All five messages are set here, and they all appear together on Save. */
            function formIsValid() {
                let ok = true;
                msg('parameterSourceRequired').hidden = true;
                msg('parameterDataTypeRequired').hidden = true;
                msg('parameterNameRequired').hidden = true;
                msg('parameterNameDuplicate').hidden = true;
                msg('parameterLengthRequired').hidden = true;

                if (util.isNullOrWhitespace(row.name)) {
                    ok = false;
                    msg('parameterNameRequired').hidden = false;
                }
                if (util.isNullOrWhitespace(row.dataType)) {
                    ok = false;
                    msg('parameterDataTypeRequired').hidden = false;
                }
                if (util.isNullOrWhitespace(row.source)) {
                    ok = false;
                    msg('parameterSourceRequired').hidden = false;
                }
                // Length matters only for the non-int types. isNullOrWhitespace(0) is FALSE, so a
                // length of 0 passes, as it did before.
                if (row.dataType !== 'int' && util.isNullOrWhitespace(row.length)) {
                    ok = false;
                    msg('parameterLengthRequired').hidden = false;
                }
                // The old check excluded "itself" by index; the position does it directly.
                const matches = list.filter((p, i) => p.name === row.name && i !== editing);
                if (matches.length > 0) {
                    ok = false;
                    msg('parameterNameDuplicate').hidden = false;
                }
                return ok;
            }

            const offs = [
                offTrack,
                dom.on(content, 'change', showLength),
                dom.on(content, 'click', (event) => {
                    const button = event.target.closest('[data-action]');
                    if (!button) {
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

            showLength();

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
    return mountStep(view, locals, ({ config, refresh }) => {
        const list = config.campusLogicSection.storedProcedureList;

        // Page state that is not configuration. See the header.
        let storedProcedureName = null;
        let pageValid = validation.state.pageValidations.storedProcedureValid;

        const host = view.querySelector('#storedProcedureList');
        const procedureTemplate = view.querySelector('#storedProcedureTemplate');
        const rowTemplate = view.querySelector('#parameterRowTemplate');
        const nameInput = view.querySelector('#storedProcedureName');
        const addButton = view.querySelector('#addStoredProcedure');
        const duplicate = view.querySelector('#duplicateStoredProcedure');
        const noProcedures = view.querySelector('#noStoredProcedures');

        function renderRow(parameter) {
            const tr = rowTemplate.content.firstElementChild.cloneNode(true);
            const cells = tr.cells;
            cells[0].textContent = parameter.name ?? '';
            cells[1].textContent = parameter.dataType ?? '';
            cells[2].textContent = parameter.length ?? '';
            cells[3].textContent = parameter.source ?? '';
            return tr;
        }

        function render() {
            host.textContent = '';
            list.forEach((procedure, index) => {
                const block = procedureTemplate.content.firstElementChild.cloneNode(true);
                block.dataset.storedProcedureIndex = index;
                block.querySelector('.cl-stored-procedure-name').textContent = procedure.name ?? '';

                const tbody = block.querySelector('tbody');
                for (const parameter of procedure.parameterList) {
                    tbody.appendChild(renderRow(parameter));
                }
                if (procedure.parameterList.length === 0) {
                    tbody.appendChild(emptyRow(5));
                }
                host.appendChild(block);
            });
            noProcedures.hidden = !(list.length === 0 && !pageValid);
        }

        /** Adds a stored procedure, refusing a duplicate name. */
        function addStoredProcedure() {
            if (list.some((procedure) => procedure.name === storedProcedureName)) {
                duplicate.hidden = false;
                return;
            }
            duplicate.hidden = true;
            list.push({ name: storedProcedureName, parameterList: [] });
            render();
        }

        async function onGridClick(event) {
            const button = event.target.closest('[data-action]');
            if (!button) {
                return;
            }
            const block = button.closest('[data-stored-procedure-index]');
            const procedure = list[Number(block.dataset.storedProcedureIndex)];
            const action = button.dataset.action;

            if (action === 'delete-stored-procedure') {
                // Matched by name rather than position, as it always has been.
                const i = list.findIndex((p) => p.name === procedure.name);
                if (i !== -1) {
                    list.splice(i, 1);
                }
                render();
                return;
            }

            const sources = config.campusLogicSection.eventPropertyValueAvailableProperties;

            if (action === 'add-parameter') {
                if (await openParameterDialog(procedure.parameterList, -1, sources)) {
                    render();
                }
                return;
            }

            // The row's position in its <tbody> IS its position in the array.
            const position = button.closest('tr').sectionRowIndex;

            if (action === 'delete-parameter') {
                procedure.parameterList.splice(position, 1);
                render();
                return;
            }
            if (action === 'edit-parameter') {
                if (await openParameterDialog(procedure.parameterList, position, sources)) {
                    render();
                }
            }
        }

        const offs = [
            dom.on(nameInput, 'input', () => {
                storedProcedureName = nameInput.value;
                addButton.disabled = storedProcedureName === null;
            }),
            dom.on(nameInput, 'blur', () => {
                // See the header: this marks the whole step valid. refresh() repaints the menu.
                pageValid = true;
                validation.state.pageValidations.storedProcedureValid = true;
                render();
                refresh();
            }),
            dom.on(addButton, 'click', addStoredProcedure),
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
