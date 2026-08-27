/**
 * core/modal.js — dialogs, on native <dialog>.
 *
 * showModal() supplies the backdrop, the focus trap, Esc handling, focus restoration on close and
 * top-layer stacking (a folder picker opens from inside a modal), so there is nothing here but
 * fetching the template and wiring close/dismiss.
 *
 * Site.css's `.modal-medium .modal-dialog { width:600px }` means windowClass must sit on an
 * ANCESTOR of a .modal-dialog, and Bootstrap's `.modal-dialog { pointer-events:none }` needs the
 * .modal-content child or the dialog is unclickable. Never add the class `modal` — Bootstrap's
 * `.modal { display:none }` would hide it outright.
 */

import * as dom from './dom.js';
import * as http from './http.js';

/**
 * openModal({ template, setup, params, windowClass, backdrop })
 *
 *   template   relative URL of the Razor partial, e.g.
 *              'setup/template?templateName=AddBatchProcessModal'
 *   setup      (content, api, params) => teardown|undefined. The caller wires the dialog's own
 *              listeners and returns whatever needs undoing on close.
 *   backdrop   'static' blocks Esc, which every dialog in this app asks for.
 *
 * Resolves with the value passed to close(v), and resolves UNDEFINED on dismiss or Esc rather than
 * rejecting — so a caller must test the resolved value, not just chain off it. A template-fetch
 * failure does reject, and leaves no <dialog> behind.
 */
export async function openModal(options) {
    const { template, setup, params, windowClass, backdrop } = options || {};
    const html = await http.text(template);

    const dlg = document.createElement('dialog');
    dlg.className = ('cl-modal ' + (windowClass || '')).trim();
    dlg.innerHTML = '<div class="modal-dialog"><div class="modal-content"></div></div>';
    const content = dlg.querySelector('.modal-content');
    // dom.setFragment, never innerHTML: the template is a fetched response, so it goes through the
    // inert parse. Modal templates are fragments, which is what setFragment requires.
    dom.setFragment(content, html);

    let result;
    let settle;
    const done = new Promise((resolve) => {
        settle = resolve;
    });

    const api = {
        close(v) {
            result = v;
            if (dlg.open) {
                dlg.close('close');
            }
        },
        dismiss() {
            result = undefined;
            if (dlg.open) {
                dlg.close('dismiss');
            }
        }
    };
    const offs = [];
    let teardown;

    // every form in this app is actionless, so a <button> inside a modal <form> would
    // submit and navigate the whole SPA away.
    offs.push(dom.on(content, 'submit', (e) => e.preventDefault()));
    if (backdrop === 'static') {
        offs.push(dom.on(dlg, 'cancel', (e) => e.preventDefault()));
    }
    offs.push(dom.on(dlg, 'close', () => {
        for (const off of offs) {
            off();
        }
        if (typeof teardown === 'function') {
            teardown();
        }
        dlg.remove();
        settle(result);
    }, { once: true }));

    document.body.appendChild(dlg);
    dlg.showModal();
    // After showModal so layout and autofocus have settled. Nothing can be missed by attaching
    // listeners here: showModal() is synchronous, so no user input is possible in between.
    if (setup) {
        teardown = setup(content, api, params);
    }

    return done;
}
