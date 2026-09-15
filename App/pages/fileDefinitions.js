/**
 * pages/fileDefinitions.js — THE DEEPEST DIALOG STACK IN THE APP: page -> file definition dialog ->
 * field mapping dialog. All three levels live here because each has exactly one caller.
 *
 * ORDER IS PERSISTED HERE, WHICH NO OTHER GRID DOES. Every field mapping carries a 1-based
 * `fieldPosition` that is written to Web.config, and the two arrow buttons reorder the list. The
 * invariant is `fieldPosition === index + 1`, and renumber() states it in one place — so move,
 * delete and add are ordinary array operations followed by one pass, instead of position arithmetic
 * spread across three call sites.
 *
 */

import { mountStep } from './shell.js';
import { emptyRow } from './grid.js';
import * as dom from '../core/dom.js';
import * as model from '../core/model.js';
import * as util from '../core/util.js';
import { openModal } from '../core/modal.js';

const DEFINITION_TEMPLATE = 'setup/template?templateName=AddFileDefinitionModal';
const MAPPING_TEMPLATE = 'setup/template?templateName=AddFieldMappingModal';

/** The four fields the value-type chooser switches between. */
const VALUE_FIELDS = ['propertyFieldValue', 'constantFieldValue', 'dbCommandFieldValue', 'dynamicFieldValue'];

/** The invariant: fieldPosition is the 1-based array position. See the header. */
function renumber(mappings) {
    mappings.forEach((mapping, i) => {
        mapping.fieldPosition = i + 1;
    });
}

/* ------------------------------------------------------------------ level 3: one field mapping */

/**
 * @param {object[]} list     the fieldMappingCollection, mutated in place on save
 * @param {number}   editing  position being edited, or -1 to add
 * @param {string[]} sources  eventPropertyValueAvailableProperties, or undefined when not fetched
 * @returns {Promise<boolean>} true when the dialog saved
 */
function openFieldMappingDialog(list, editing, sources) {
    const original = editing === -1 ? null : list[editing];
    // The Add defaults. fieldPosition is the caller's `fieldMappingCollection.length + 1`.
    const row = original === null
        ? {
            fieldPosition: list.length + 1,
            fieldSize: null,
            dataType: 'String',
            fileFieldName: null,
            propertyFieldValue: null,
            constantFieldValue: null,
            dbCommandFieldValue: null,
            dynamicFieldValue: null
        }
        : util.copy(original);

    /** Whichever value field is set decides what the chooser shows on open. */
    function initialValueType() {
        if (original === null) {
            return 'Basic Property Value';
        }
        if (original.propertyFieldValue) {
            return 'Basic Property Value';
        }
        if (original.constantFieldValue) {
            return 'Constant Value';
        }
        if (original.dbCommandFieldValue) {
            return 'Database Command';
        }
        if (original.dynamicFieldValue) {
            return 'Dynamic Field Value';
        }
        return '';
    }

    return openModal({
        template: MAPPING_TEMPLATE,
        windowClass: 'show',
        backdrop: 'static',
        setup(content, modal) {
            const host = { fieldMapping: row };
            const form = content.querySelector('#fieldMappingModalForm');
            const valueType = content.querySelector('#inputValueType');
            const msg = (id) => content.querySelector('#' + id);
            const rows = {
                'Basic Property Value': content.querySelector('#basicPropertyValueRow'),
                'Constant Value': content.querySelector('#constantValueRow'),
                'Database Command': content.querySelector('#dbCommandValueRow'),
                'Dynamic Field Value': content.querySelector('#dynamicValueRow')
            };

            content.querySelector('#fieldMappingModalTitle').textContent =
                (editing === -1 ? 'Add' : 'Edit') + ' Field Mapping Item';

            // A COPY is sorted. Sorting the shared configuration array would reorder it in place
            // for everything else that reads it.
            const datalist = content.querySelector('#eventPropertyValues');
            for (const name of [...(sources || [])].sort()) {
                const option = document.createElement('option');
                option.value = name;
                datalist.appendChild(option);
            }

            model.load(content, host);
            const offTrack = model.track(content, host);
            valueType.value = initialValueType();

            function showRows() {
                for (const [type, el] of Object.entries(rows)) {
                    el.hidden = valueType.value !== type;
                }
            }

            /**
             * Every case clears the OTHER three value fields and keeps its own. "Dynamic Field
             * Value" used to have no case, so it fell through to `default:` and nulled the value the
             * user had just chosen; `default:` now runs only for a cleared dropdown. Guide §7.46.
             */
            function onValueTypeChange() {
                switch (valueType.value) {
                    case 'Basic Property Value':
                        row.constantFieldValue = null;
                        row.dbCommandFieldValue = null;
                        row.dynamicFieldValue = null;
                        break;
                    case 'Constant Value':
                        row.propertyFieldValue = null;
                        row.dbCommandFieldValue = null;
                        row.dynamicFieldValue = null;
                        break;
                    case 'Database Command':
                        row.constantFieldValue = null;
                        row.propertyFieldValue = null;
                        row.dynamicFieldValue = null;
                        break;
                    case 'Dynamic Field Value':
                        row.propertyFieldValue = null;
                        row.constantFieldValue = null;
                        row.dbCommandFieldValue = null;
                        break;
                    default:
                        row.propertyFieldValue = null;
                        row.constantFieldValue = null;
                        row.dbCommandFieldValue = null;
                        row.dynamicFieldValue = null;
                        break;
                }
                // Re-render the four value inputs from the fields we just nulled.
                for (const field of VALUE_FIELDS) {
                    model.write(form.elements['fieldMapping.' + field], row[field]);
                }
                showRows();
            }

            /** All three messages are set here, and they all appear together on Save. */
            function formIsValid() {
                let ok = true;
                msg('fieldSizeRequired').hidden = true;
                msg('fieldDataTypeRequired').hidden = true;
                msg('fieldNameRequired').hidden = true;

                if (util.isNullOrWhitespace(row.fieldSize)) {
                    ok = false;
                    msg('fieldSizeRequired').hidden = false;
                }
                if (util.isNullOrWhitespace(row.dataType)) {
                    ok = false;
                    msg('fieldDataTypeRequired').hidden = false;
                }
                if (util.isNullOrWhitespace(row.fileFieldName)) {
                    ok = false;
                    msg('fieldNameRequired').hidden = false;
                }
                return ok;
            }

            const offs = [
                offTrack,
                dom.on(valueType, 'change', onValueTypeChange),
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
                    renumber(list);
                    modal.close(true);
                })
            ];

            showRows();

            return () => {
                for (const off of offs) {
                    off();
                }
            };
        }
    });
}

/* ------------------------------------------------------------------ level 2: one file definition */

/**
 * @param {object[]} list     fileDefinitionsList, mutated in place on save
 * @param {number}   editing  position being edited, or -1 to add
 * @param {string[]} sources  eventPropertyValueAvailableProperties
 * @returns {Promise<boolean>} true when the dialog saved
 */
function openFileDefinitionDialog(list, editing, sources) {
    // The Add defaults.
    const row = editing === -1
        ? {
            name: null,
            fileNameFormat: null,
            includeHeaderRecord: null,
            fileExtension: null,
            fileFormat: null,
            fieldMappingCollection: []
        }
        : util.copy(list[editing]);
    const mappings = row.fieldMappingCollection;

    return openModal({
        template: DEFINITION_TEMPLATE,
        windowClass: 'modal-wide show',
        backdrop: 'static',
        setup(content, modal) {
            const host = { fileDefinition: row };
            const fileFormat = content.querySelector('#fileFormat');
            const tbody = content.querySelector('#fieldMappingsGrid tbody');
            const rowTemplate = content.querySelector('#fieldMappingRowTemplate');
            const msg = (id) => content.querySelector('#' + id);

            content.querySelector('#fileDefinitionModalTitle').textContent =
                (editing === -1 ? 'Add' : 'Edit') + ' File Definition';

            model.load(content, host);
            const offTrack = model.track(content, host);

            function renderMappings() {
                tbody.textContent = '';
                for (const mapping of mappings) {
                    const tr = rowTemplate.content.firstElementChild.cloneNode(true);
                    const cells = tr.cells;
                    cells[0].textContent = mapping.fieldPosition ?? '';
                    cells[1].textContent = mapping.fieldSize ?? '';
                    cells[2].textContent = mapping.dataType ?? '';
                    cells[3].textContent = mapping.fileFieldName ?? '';
                    cells[4].textContent = mapping.propertyFieldValue ?? '';
                    cells[5].textContent = mapping.constantFieldValue ?? '';
                    cells[6].textContent = mapping.dbCommandFieldValue ?? '';
                    cells[7].textContent = mapping.dynamicFieldValue ?? '';
                    tbody.appendChild(tr);
                }
                if (mappings.length === 0) {
                    tbody.appendChild(emptyRow(9));
                }
            }

            /**
             * Clears each format-specific message when the format it belongs to is no longer
             * selected. The xml comparison was spelt "XML" while the <option> value is "xml", so the
             * branch was always taken and the message was cleared even when switching TO xml. Both
             * messages come back on the next Save either way. Guide §7.46.
             */
            function updateFileFormat() {
                if (fileFormat.value !== 'xml') {
                    msg('fieldMappingXmlNames').hidden = true;
                }
                if (fileFormat.value !== 'csv' && fileFormat.value !== 'csvnoquotes') {
                    msg('fieldMappingCsvNames').hidden = true;
                }
            }

            /** All seven messages are set here, and they all appear together on Save. */
            function formIsValid() {
                let ok = true;
                msg('fileDefinitionNameRequired').hidden = true;
                msg('fileDefinitionNameDuplicate').hidden = true;
                msg('fileDefinitionFormatRequired').hidden = true;
                msg('fileDefinitionHeaderRequired').hidden = true;
                msg('fileDefinitionExtensionRequired').hidden = true;
                msg('fieldMappingLengthRequired').hidden = true;
                msg('fieldMappingXmlNames').hidden = true;
                msg('fieldMappingCsvNames').hidden = true;

                if (util.isNullOrWhitespace(row.name)) {
                    ok = false;
                    msg('fileDefinitionNameRequired').hidden = false;
                }
                // The old check excluded "itself" by index; the position does it directly.
                const nameMatches = list.filter((d, i) => d.name === row.name && i !== editing);
                if (nameMatches.length > 0) {
                    ok = false;
                    msg('fileDefinitionNameDuplicate').hidden = false;
                }
                if (util.isNullOrWhitespace(row.fileNameFormat)) {
                    ok = false;
                    msg('fileDefinitionFormatRequired').hidden = false;
                }
                // `== null` in the original, which catches undefined too. False is a valid answer.
                if (row.includeHeaderRecord === null || row.includeHeaderRecord === undefined) {
                    ok = false;
                    msg('fileDefinitionHeaderRequired').hidden = false;
                }
                if (util.isNullOrWhitespace(row.fileExtension)) {
                    ok = false;
                    msg('fileDefinitionExtensionRequired').hidden = false;
                }
                if (mappings.length === 0) {
                    ok = false;
                    msg('fieldMappingLengthRequired').hidden = false;
                }
                if (row.fileFormat === 'xml') {
                    for (const mapping of mappings) {
                        if (mapping.fileFieldName.indexOf(' ') >= 0) {
                            ok = false;
                            msg('fieldMappingXmlNames').hidden = false;
                        }
                    }
                }
                // DEFECT PRESERVED. The condition was written as
                //   includeHeaderRecord == true && fileFormat == "csv" || fileFormat == "csvnoquotes"
                // and && binds tighter than ||, so csvnoquotes is checked whether or not there is a
                // header record. The parentheses below say exactly that, on purpose.
                if ((row.includeHeaderRecord === true && row.fileFormat === 'csv')
                    || row.fileFormat === 'csvnoquotes') {
                    for (const mapping of mappings) {
                        if (mapping.fileFieldName.indexOf(',') >= 0) {
                            ok = false;
                            msg('fieldMappingCsvNames').hidden = false;
                        }
                    }
                }
                return ok;
            }

            /**
             * One listener for the whole dialog, dispatching on data-action. The grid's four row
             * buttons and the footer's two are all reached from here, so there is no second
             * listener whose ordering could matter.
             */
            async function onClick(event) {
                const button = event.target.closest('[data-action]');
                if (!button) {
                    return;
                }
                const action = button.dataset.action;

                if (action === 'cancel') {
                    modal.dismiss();
                    return;
                }
                if (action === 'save') {
                    if (!formIsValid()) {
                        return;
                    }
                    // Writing to the list here rather than resolving the row keeps every dialog in
                    // the wizard the same shape. See the header.
                    const saved = util.copy(row);
                    if (editing === -1) {
                        list.push(saved);
                    } else {
                        list[editing] = saved;
                    }
                    modal.close(true);
                    return;
                }

                const position = button.closest('tr').sectionRowIndex;

                if (action === 'move-up' && position > 0) {
                    mappings.splice(position - 1, 2, mappings[position], mappings[position - 1]);
                    renumber(mappings);
                    renderMappings();
                    return;
                }
                if (action === 'move-down' && position < mappings.length - 1) {
                    mappings.splice(position, 2, mappings[position + 1], mappings[position]);
                    renumber(mappings);
                    renderMappings();
                    return;
                }
                if (action === 'delete-mapping') {
                    mappings.splice(position, 1);
                    renumber(mappings);
                    renderMappings();
                    return;
                }
                if (action === 'edit-mapping') {
                    if (await openFieldMappingDialog(mappings, position, sources)) {
                        renderMappings();
                    }
                }
            }

            const offs = [
                offTrack,
                dom.on(fileFormat, 'change', updateFileFormat),
                dom.on(content, 'click', onClick),
                dom.on(content.querySelector('#addFieldMapping'), 'click', async () => {
                    if (await openFieldMappingDialog(mappings, -1, sources)) {
                        renderMappings();
                    }
                })
            ];

            renderMappings();

            return () => {
                for (const off of offs) {
                    off();
                }
            };
        }
    });
}

/* ------------------------------------------------------------------ level 1: the page */

export function mount(view, locals) {
    return mountStep(view, locals, ({ config }) => {
        const list = config.campusLogicSection.fileDefinitionsList;
        const tbody = view.querySelector('#fileDefinitionsGrid tbody');
        const rowTemplate = view.querySelector('#fileDefinitionRowTemplate');

        function render() {
            tbody.textContent = '';
            for (const definition of list) {
                const tr = rowTemplate.content.firstElementChild.cloneNode(true);
                const cells = tr.cells;
                cells[0].textContent = definition.name ?? '';
                cells[1].textContent = definition.fileNameFormat ?? '';
                cells[2].textContent = definition.includeHeaderRecord ?? '';
                cells[3].textContent = definition.fileExtension ?? '';
                cells[4].textContent = definition.fileFormat ?? '';
                tbody.appendChild(tr);
            }
            if (list.length === 0) {
                tbody.appendChild(emptyRow(6));
            }
        }

        const sources = () => config.campusLogicSection.eventPropertyValueAvailableProperties;

        const offs = [
            dom.on(tbody, 'click', async (event) => {
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
                if (await openFileDefinitionDialog(list, position, sources())) {
                    render();
                }
            }),
            dom.on(view.querySelector('#addFileDefinition'), 'click', async () => {
                if (await openFileDefinitionDialog(list, -1, sources())) {
                    render();
                }
            })
        ];

        render();

        return () => {
            for (const off of offs) {
                off();
            }
        };
    });
}
