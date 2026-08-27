/**
 * pages/smtp.js — replaces smtpcontroller.js.
 */

import { mountStep } from './shell.js';
import * as dom from '../core/dom.js';
import * as model from '../core/model.js';
import * as setup from '../services/setup.js';
import * as validation from '../services/validation.js';

/** SmtpDeliveryMethod's integers, in the spelling the three <option> values use. */
const DELIVERY_METHODS = ['Network', 'SpecifiedPickupDirectory', 'PickupDirectoryFromIis'];

export function mount(view, locals) {
    const smtp = setup.state.configurationModel.smtpSection;
    if (DELIVERY_METHODS[smtp.deliveryMethod] !== undefined) {
        smtp.deliveryMethod = DELIVERY_METHODS[smtp.deliveryMethod];
    }

    return mountStep(view, locals, ({ form, refresh }) => {
        const method = form.elements['smtpSection.deliveryMethod'];
        const credentials = form.elements['smtpSection.network.defaultCredentials'];

        const networkLeft = view.querySelector('#smtpNetworkLeft');
        const networkRight = view.querySelector('#smtpNetworkRight');
        const pickupDirectory = view.querySelector('#smtpPickupDirectory');
        const networkCredentials = view.querySelector('#smtpNetworkCredentials');
        const testPassed = view.querySelector('#smtpTestPassed');
        const testFailed = view.querySelector('#smtpTestFailed');

        /** The three conditional groups. */
        function showSections() {
            const network = method.value === 'Network';
            networkLeft.hidden = !network;
            networkRight.hidden = !network;
            pickupDirectory.hidden = method.value !== 'SpecifiedPickupDirectory';
            // `credentials` is a RadioNodeList; .value is the checked radio's value, or '' when
            // neither is checked — in which case the sub-section stays hidden, as it did before.
            networkCredentials.hidden = credentials.value !== 'false';
        }

        /** The two alert spans, from the async test result. */
        function showTestResult() {
            const pv = validation.state.pageValidations || {};
            testPassed.hidden = !(pv.smtpValid && pv.issmtpTested);
            testFailed.hidden = !(!pv.smtpValid && pv.issmtpTested);
        }

        const offs = [
            dom.on(form, 'change', showSections),
            dom.on(view.querySelector('#testSmtpButton'), 'click', () => {
                if (model.valid(form)) {
                    // Repaint when the test settles, not on the busy event: that fires BEFORE the
                    // handlers which set issmtpTested, so the banners would show the previous
                    // result. Guide §7.43.
                    validation.testSMTPSettings(form).then(refresh);
                }
            })
        ];

        showSections();

        return {
            // Called at mount and whenever a request settles — see pages/shell.js.
            refresh: showTestResult,
            destroy() {
                for (const off of offs) {
                    off();
                }
            }
        };
    });
}
