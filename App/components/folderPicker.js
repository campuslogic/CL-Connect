/**
 * components/folderPicker.js — an <input>, a Browse button and a Test button. 20 of them across
 * 12 views.
 *
 * The element declares which configuration path it edits and whether it is required:
 *
 *     <cl-folder-picker class="col-lg-7" required
 *                       data-path="campusLogicSection.isirUploadSettings.isirUploadFilePath">
 *
 * mount() stamps FolderPicker.cshtml inside it and names the input after data-path. From that
 * moment core/model.js treats it as an ordinary field: model.track()'s delegated listener at the
 * page root commits its edits, including the value the folder tree writes — which is why writing
 * that value dispatches a change event.
 *
 * ---------------------------------------------------------------------------------------------
 * MOUNTING A PICKER FIRES A MUTATING REQUEST, and that is deliberate.
 *
 * At mount it runs checkUnique(), then test() if the STORED path is neither '' nor undefined —
 * note `null` passes that guard, which is why the gate reads the configuration value rather than
 * input.value, since core/model.js writes null to the DOM as ''.
 *
 * test() calls api/FolderPicker/TestWritePermissions, which creates the directory if it is missing
 * and can send real SMTP mail on failure. So merely navigating to a page with a saved path has
 * side effects. It is what makes the "Path is valid" banner appear on load, so it stays — but it
 * must be blocked at the network layer in any automated run. Guide §7.18.
 *
 * When the path is NOT unique, test() makes no request and pathValidated stays false, so NEITHER
 * banner shows and the Test button looks like it did nothing. Current behaviour, preserved.
 */

import * as dom from '../core/dom.js';
import * as http from '../core/http.js';
import * as model from '../core/model.js';
import { openModal } from '../core/modal.js';
import * as validation from '../services/validation.js';
import { tree } from './tree.js';

// SetupController's generic Template action resolves templateName to Views/Setup/<name>.cshtml.
const TEMPLATE_URL = 'setup/template?templateName=FolderPicker';
const MODAL_TEMPLATE_URL = 'setup/template?templateName=FolderPickerModal';

let uid = 0;
let templateHtml = null;
let templatePromise = null;

/**
 * Fetches the picker's Razor partial once and caches it. Called from main.js's stepRoute resolve,
 * which is what lets mount() be synchronous — pages/shell.js mounts the pickers and core/model.js
 * reads their inputs in the same tick.
 */
export function preload() {
    if (templateHtml !== null) {
        return Promise.resolve(templateHtml);
    }
    if (!templatePromise) {
        templatePromise = http.text(TEMPLATE_URL).then((html) => {
            templateHtml = html;
            return html;
        });
    }
    return templatePromise;
}

/**
 * Mounts every <cl-folder-picker data-path="..."> under `root`.
 *
 * @returns {Function} teardown for all of them
 */
export function mountAll(root, config) {
    const teardowns = [...root.querySelectorAll('cl-folder-picker[data-path]')].map((el) => mount(el, config));
    return () => teardowns.forEach((off) => off());
}

/**
 * Mounts one picker.
 *
 * @returns {Function} teardown
 */
function mount(el, config) {
    if (templateHtml === null) {
        // Nothing sensible to render, and throwing would take the whole page down. The resolve in
        // main.js is what guarantees this cannot happen in the app.
        console.error('[folderPicker] template not preloaded; call preload() from the route resolve');
        return () => {};
    }

    const path = el.dataset.path;
    // setFragment, not innerHTML: templateHtml came off the wire. See core/dom.js.
    dom.setFragment(el, templateHtml);

    const input = el.querySelector('input');
    const notUnique = el.querySelector('.cl-path-not-unique');
    const validMsg = el.querySelector('.cl-path-valid');
    const invalidMsg = el.querySelector('.cl-path-invalid');

    input.name = path;
    input.id = 'folderPath-' + (++uid);
    input.required = el.hasAttribute('required');
    // model.load() already ran over the page's static markup; this input did not exist yet.
    model.write(input, model.get(config, path));

    let validPath = true;
    let pathValidated = false;

    function showResult() {
        validMsg.hidden = !(validPath && pathValidated);
        invalidMsg.hidden = !(!validPath && pathValidated);
    }

    /** Cross-section comparison, so no constraint can express it — hence a JS-toggled span. */
    function checkUnique() {
        notUnique.hidden = uniqueOf(input.value);
        return notUnique.hidden;
    }

    function test() {
        try {
            pathValidated = false;
            showResult();
            if (checkUnique()) {
                // Fire and forget, and SIDE-EFFECTING — see the header.
                validation.testWritePermissions(input.value, () => {
                    pathValidated = true;
                    validPath = true;
                    showResult();
                }, () => {
                    pathValidated = true;
                    validPath = false;
                    showResult();
                });
            }
        } catch (e) {
            pathValidated = true;
            validPath = false;
            showResult();
        }
    }

    let opening = false;

    async function browse() {
        if (opening) {
            return;   // double-click guard: two dialogs must not stack
        }
        opening = true;
        try {
            const picked = await openModal({
                template: MODAL_TEMPLATE_URL,
                windowClass: 'full-screen-modal show',
                backdrop: 'static',
                setup(content, modal) {
                    let selected = null;
                    const t = tree(content.querySelector('.cl-tree-frame'), {
                        onSelect(p) {
                            selected = p;
                        }
                    });
                    const off = dom.on(content, 'click', (event) => {
                        const button = event.target.closest('[data-action]');
                        if (!button) {
                            return;
                        }
                        if (button.dataset.action === 'cancel') {
                            modal.dismiss();
                        } else {
                            // null when Select was pressed with nothing chosen.
                            modal.close(selected);
                        }
                    });
                    return () => {
                        off();
                        t.destroy();
                    };
                }
            });
            // undefined on dismiss/Esc (core/modal.js resolves rather than rejecting), null when
            // Select was pressed with no selection. Neither should touch the configuration.
            if (picked !== undefined && picked !== null) {
                input.value = picked;
                // What commits it: core/model.js's delegated listener at the page root. Writing
                // .value programmatically fires nothing, so the event has to be dispatched.
                input.dispatchEvent(new Event('change', { bubbles: true }));
                checkUnique();
            }
            input.focus();
        } finally {
            opening = false;
        }
    }

    const offs = [
        dom.on(input, 'blur', checkUnique),
        dom.on(el, 'click', (event) => {
            const button = event.target.closest('[data-action]');
            if (!button) {
                return;
            }
            if (button.dataset.action === 'browse') {
                browse();
            } else {
                test();
            }
        })
    ];

    // --- mount-time behaviour. Order matters; see the header.
    checkUnique();
    const stored = model.get(config, path);
    if (stored !== '' && stored !== undefined) {
        test();
    }

    return () => {
        for (const off of offs) {
            off();
        }
        el.innerHTML = '';
    };
}

/**
 * validation.folderPathUnique dereferences about eleven sub-sections of campusLogicSection with no
 * guards, so it throws on a null or partial configuration. Every step resolves the configuration
 * before mounting, so this guard is belt-and-braces rather than load-bearing.
 */
function uniqueOf(path) {
    try {
        return validation.folderPathUnique(path);
    } catch (e) {
        return true;
    }
}
