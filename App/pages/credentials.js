/**
 * pages/credentials.js — the API Credentials step. Two behaviours:
 *
 *  1. Test runs the credentials validator, but only if the form passes its own constraints. The
 *     button is type="button" so it cannot submit: a submit button would suppress the browser's own
 *     validation bubble, so the validity check is explicit instead.
 *  2. Editing either field clears the previous test result, so "Connection Successful" cannot
 *     outlive the credentials it described.
 *
 * Both banners are painted from the promise testCredentials returns, NOT from the shell's busy-event
 * repaint. See the click handler.
 */

import { mountStep } from './shell.js';
import * as dom from '../core/dom.js';
import * as model from '../core/model.js';
import * as validation from '../services/validation.js';

export function mount(view, locals) {
    return mountStep(view, locals, ({ form, refresh }) => {
        const passed = view.querySelector('#credentialsTestPassed');
        const failed = view.querySelector('#credentialsTestFailed');

        function showTestResult() {
            const pv = validation.state.pageValidations || {};
            passed.hidden = !(pv.apiCredentialsValid && pv.apiCredentialsTested);
            failed.hidden = !(!pv.apiCredentialsValid && pv.apiCredentialsTested);
        }

        const offs = [
            dom.on(view.querySelector('#testCredentialsButton'), 'click', () => {
                if (model.valid(form)) {
                    // Repaint when the test settles, not when the request count drops. The shell's
                    // refresh is also wired to http's busy event, but that fires from http.js's
                    // `finally` — BEFORE the handlers that set apiCredentialsTested — so the banner
                    // was painted from the pre-test flags and did not appear until the next repaint,
                    // which for most users meant leaving the page. Guide §7.43.
                    validation.testCredentials(form).then(refresh);
                }
            }),
            // Editing either field invalidates the last test.
            dom.on(form, 'input', () => {
                const pv = validation.state.pageValidations;
                if (!pv) {
                    return;
                }
                pv.apiCredentialsValid = true;
                pv.apiCredentialsTested = false;
                refresh();
            })
        ];

        return {
            refresh: showTestResult,
            destroy() {
                for (const off of offs) {
                    off();
                }
            }
        };
    });
}
