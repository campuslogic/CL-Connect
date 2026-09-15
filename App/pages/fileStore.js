/**
 * pages/fileStore.js — the named file stores, as a grid with one dialog.
 *
 *
 * THE FOLDER PICKER IS MOUNTED IN THE DIALOG, NOT THE GRID, and that is deliberate rather than
 * cosmetic: components/folderPicker.js fires a TestWritePermissions request on mount, which creates
 * the directory and can send mail. One picker per row would fire one per file store every time the step
 * is opened. Mounting it here means it happens once, when someone is actually editing a store.
 */

import { mountStep } from './shell.js';
import { emptyRow } from './grid.js';
import * as dom from '../core/dom.js';
import * as model from '../core/model.js';
import * as util from '../core/util.js';
import * as folderPicker from '../components/folderPicker.js';
import { openModal } from '../core/modal.js';

const STORE_TEMPLATE = 'setup/template?templateName=AddFileStoreModal';

/**
 * The File Definition name is typed and NOT checked here. A store may name a definition that has not
 * been added yet — that is a normal order to work in — so the cross-check waits until Save and is
 * reported by validation.testFileStoreSettings on the step behind this dialog.
 *
 * @param {object[]} list    the named stores, mutated in place on save
 * @param {number}   editing position being edited, or -1 to add
 * @returns {Promise<boolean>} true when the dialog saved
 */
function openFileStoreDialog(list, editing) {
    // The Add defaults. fileStoreMinutes matches the DefaultValue on FileStoreSetting.
    const row = editing === -1
        ? {
            name: null,
            fileStorePath: null,
            fileStoreMinutes: 1,
            fileDefinitionName: null
        }
        : util.copy(list[editing]);

    return openModal({
        template: STORE_TEMPLATE,
        windowClass: 'show',
        backdrop: 'static',
        setup(content, modal) {
            const host = { fileStore: row };
            const msg = (id) => content.querySelector('#' + id);

            content.querySelector('#fileStoreModalTitle').textContent =
                (editing === -1 ? 'Add' : 'Edit') + ' File Store';

            model.load(content, host);
            const offTrack = model.track(content, host);
            const offPicker = folderPicker.mountAll(content, host);

            /** All five messages are set here, and they all appear together on Save. */
            function formIsValid() {
                let ok = true;
                msg('fileStoreNameRequired').hidden = true;
                msg('fileStoreNameDuplicate').hidden = true;
                msg('fileStorePathRequired').hidden = true;
                msg('fileStoreMinutesRequired').hidden = true;
                msg('fileStoreFileDefinitionRequired').hidden = true;

                if (util.isNullOrWhitespace(row.name)) {
                    ok = false;
                    msg('fileStoreNameRequired').hidden = false;
                }
                // Case-insensitive, because FileStoresCollection keys on the lowered name — two
                // stores differing only in case would be one entry in Web.config.
                const clash = list.filter((s, i) => i !== editing && !util.isNullOrWhitespace(s.name)
                    && s.name.toLowerCase() === String(row.name || '').toLowerCase());
                if (clash.length > 0) {
                    ok = false;
                    msg('fileStoreNameDuplicate').hidden = false;
                }
                if (util.isNullOrWhitespace(row.fileStorePath)) {
                    ok = false;
                    msg('fileStorePathRequired').hidden = false;
                }
                if (row.fileStoreMinutes === null || row.fileStoreMinutes === undefined
                    || row.fileStoreMinutes === '') {
                    ok = false;
                    msg('fileStoreMinutesRequired').hidden = false;
                }
                if (util.isNullOrWhitespace(row.fileDefinitionName)) {
                    ok = false;
                    msg('fileStoreFileDefinitionRequired').hidden = false;
                }
                return ok;
            }

            const offs = [
                offTrack,
                offPicker,
                dom.on(content, 'click', (event) => {
                    const button = event.target.closest('[data-action]');
                    if (!button) {
                        return;
                    }
                    if (button.dataset.action === 'cancel') {
                        modal.dismiss();
                        return;
                    }
                    if (button.dataset.action !== 'save' || !formIsValid()) {
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

            return () => {
                for (const off of offs) {
                    off();
                }
            };
        }
    });
}

export function mount(view, locals) {
    return mountStep(view, locals, ({ config }) => {
        const list = config.campusLogicSection.fileStoreSettings.fileStores;
        const tbody = view.querySelector('#fileStoresGrid tbody');
        const rowTemplate = view.querySelector('#fileStoreRowTemplate');

        function render() {
            tbody.textContent = '';
            for (const store of list) {
                const tr = rowTemplate.content.firstElementChild.cloneNode(true);
                const cells = tr.cells;
                cells[0].textContent = store.name ?? '';
                cells[1].textContent = store.fileStorePath ?? '';
                cells[2].textContent = store.fileStoreMinutes ?? '';
                cells[3].textContent = store.fileDefinitionName ?? '';
                tbody.appendChild(tr);
            }
            if (list.length === 0) {
                tbody.appendChild(emptyRow(5));
            }
        }

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
                if (await openFileStoreDialog(list, position)) {
                    render();
                }
            }),
            dom.on(view.querySelector('#addFileStore'), 'click', async () => {
                if (await openFileStoreDialog(list, -1)) {
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
