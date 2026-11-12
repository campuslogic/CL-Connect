/**
 * pages/apiIntegration.js — the API Integration step and its two dialogs. The biggest page in the
 * wizard. Four things are specific to it.
 *
 *  1. FIVE COLUMN SETS FOR ONE GRID. Each integration renders as a ONE-ROW grid whose columns depend
 *     on its authentication method, and three of the five mask the password. That is the API_COLUMNS
 *     table below, which buildApiGrid() reads.
 *
 *  2. TWO LISTS, ONE OF THEM DERIVED. apiEndpointsList holds EVERY endpoint, each carrying an apiId;
 *     a per-integration grid shows the subset for one apiId. endpointsFor() filters on demand, so
 *     there is no second array to keep in sync.
 *
 *  3. ADD PUSHES BEFORE THE DIALOG OPENS, AND CANCEL POPS. The dialog needs the apiId that newId()
 *     computed from the list, so the half-built entry has to be in the list first. The pop hangs off
 *     a FALSY RESULT, not an error handler — core/modal.js resolves undefined on dismiss rather than
 *     rejecting.
 *
 *  4. AN ETHOS INTEGRATION GETS A PUBLISH ENDPOINT FOR FREE, created after the dialog saves, and its
 *     endpoint, method and MIME type are then read-only everywhere.
 *
 * PRESERVED, deliberately:
 *   - `pageValid` is read ONCE at mount, so the three "required" messages reflect validity as of
 *     page entry rather than flickering as each async check settles.
 */

import { mountStep } from './shell.js';
import * as dom from '../core/dom.js';
import * as model from '../core/model.js';
import * as util from '../core/util.js';
import * as validation from '../services/validation.js';
import { openModal } from '../core/modal.js';

const INTEGRATION_TEMPLATE = 'setup/template?templateName=AddApiIntegrationModal';
const ENDPOINT_TEMPLATE = 'setup/template?templateName=AddApiEndpointModal';

const ETHOS_ROOT = 'https://integrate.elluciancloud.com';

/** Display-only. The stored password is never touched. */
function mask(value) {
    return '●'.repeat(String(value === null || value === undefined ? '' : value).length);
}

function column(title, field, format) {
    return { title, field, format };
}

/**
 * One column list per authentication method. Note username and password change TITLE as well as
 * presence: "Client ID"/"Client Secret" under oauth2, "API Key" under ethos.
 */
const API_COLUMNS = {
    none: [
        column('API Name', 'apiName'),
        column('Authentication', 'authentication'),
        column('Root', 'root')
    ],
    basic: [
        column('API Name', 'apiName'),
        column('Authentication', 'authentication'),
        column('Root', 'root'),
        column('Username', 'username'),
        column('Password', 'password', mask)
    ],
    oauth2: [
        column('API Name', 'apiName'),
        column('Authentication', 'authentication'),
        column('Token Service', 'tokenService'),
        column('Root', 'root'),
        column('Client ID', 'username'),
        column('Client Secret', 'password', mask)
    ],
    oauth_wrap: [
        column('API Name', 'apiName'),
        column('Authentication', 'authentication'),
        column('Token Service', 'tokenService'),
        column('Root', 'root'),
        column('Username', 'username'),
        column('Password', 'password', mask)
    ],
    ethos: [
        column('API Name', 'apiName'),
        column('Authentication', 'authentication'),
        column('Root', 'root'),
        column('API Key', 'password', mask)
    ]
};

/** The URL rule the dialogs enforce: a prefix test, not a parse. */
function isHttpUrl(value) {
    return value.startsWith('http://') || value.startsWith('https://');
}

/* ------------------------------------------------------------------ the integration dialog */

/**
 * @param {object[]} list        apiIntegrationsList; the matching entry is replaced on save
 * @param {object}   integration the entry being edited — already IN the list, see the header
 * @returns {Promise<boolean>}   true when the dialog saved
 */
function openApiIntegrationDialog(list, integration) {
    const adding = !integration.authentication;
    // The Add defaults. apiId comes from the entry the caller already appended.
    const row = adding
        ? {
            apiId: integration.apiId,
            apiName: null,
            authentication: 'none',
            tokenService: null,
            root: null,
            username: null,
            password: null
        }
        : util.copy(integration);

    return openModal({
        template: INTEGRATION_TEMPLATE,
        windowClass: 'show',
        backdrop: 'static',
        setup(content, modal) {
            const host = { apiIntegration: row };
            const method = content.querySelector('#method');
            const root = content.querySelector('#root');
            const msg = (id) => content.querySelector('#' + id);

            content.querySelector('#apiIntegrationModalTitle').textContent =
                (adding ? 'Add' : 'Edit') + ' API Integration';

            // Neither condition can change while the dialog is open, so both are settled once.
            if (!adding && row.authentication !== 'ethos') {
                content.querySelector('#ethosOption').remove();
            }
            method.disabled = !adding && row.authentication === 'ethos';

            model.load(content, host);
            const offTrack = model.track(content, host);

            /** The four things that follow the authentication method. */
            function refreshSections() {
                const auth = method.value;
                content.querySelector('#tokenServiceRow').hidden =
                    !(auth === 'oauth2' || auth === 'oauth_wrap');
                content.querySelector('#usernameRow').hidden = auth === 'none' || auth === 'ethos';
                content.querySelector('#passwordRow').hidden = auth === 'none';

                content.querySelector('#usernameLabelUsername').hidden =
                    !(auth === 'basic' || auth === 'oauth_wrap');
                content.querySelector('#usernameLabelClientId').hidden = auth !== 'oauth2';
                content.querySelector('#passwordLabelPassword').hidden =
                    !(auth === 'basic' || auth === 'oauth_wrap');
                content.querySelector('#passwordLabelClientSecret').hidden = auth !== 'oauth2';
                content.querySelector('#passwordLabelApiKey').hidden = auth !== 'ethos';

                root.disabled = auth === 'ethos';
            }

            /** Choosing Ethos fills Root in and locks it. */
            function onMethodChange() {
                if (method.value === 'ethos') {
                    row.root = ETHOS_ROOT;
                    model.write(root, ETHOS_ROOT);
                }
                refreshSections();
            }

            /** All six messages are set here, and they all appear together on Save. */
            function formIsValid() {
                let ok = true;
                msg('apiNameRequired').hidden = true;
                msg('apiNameDuplicate').hidden = true;
                msg('apiTokenInvalid').hidden = true;
                msg('apiRootInvalid').hidden = true;
                msg('apiUsernameRequired').hidden = true;
                msg('apiPasswordRequired').hidden = true;

                if (util.isNullOrWhitespace(row.apiName)) {
                    ok = false;
                    msg('apiNameRequired').hidden = false;
                }
                // Excludes itself by apiId, which is this list's real key.
                const duplicates = list.filter((a) => a.apiName === row.apiName && a.apiId !== row.apiId);
                if (duplicates.length > 0) {
                    ok = false;
                    msg('apiNameDuplicate').hidden = false;
                }
                // Required AND a URL, both reported through the one message the markup has.
                if (util.isNullOrWhitespace(row.root) || !isHttpUrl(row.root)) {
                    ok = false;
                    msg('apiRootInvalid').hidden = false;
                }
                if (row.authentication !== 'none') {
                    if (row.authentication === 'oauth2' || row.authentication === 'oauth_wrap') {
                        if (util.isNullOrWhitespace(row.tokenService) || !isHttpUrl(row.tokenService)) {
                            ok = false;
                            msg('apiTokenInvalid').hidden = false;
                        }
                    }
                    if (row.authentication !== 'ethos' && util.isNullOrWhitespace(row.username)) {
                        ok = false;
                        msg('apiUsernameRequired').hidden = false;
                    }
                    if (util.isNullOrWhitespace(row.password)) {
                        ok = false;
                        msg('apiPasswordRequired').hidden = false;
                    }
                }
                return ok;
            }

            const offs = [
                offTrack,
                dom.on(method, 'change', onMethodChange),
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
                    // Replaces the entry with the matching apiId, as save() did by loop.
                    const saved = util.copy(row);
                    const i = list.findIndex((a) => a.apiId === row.apiId);
                    if (i !== -1) {
                        list[i] = saved;
                    }
                    modal.close(true);
                })
            ];

            refreshSections();

            return () => {
                for (const off of offs) {
                    off();
                }
            };
        }
    });
}

/* ------------------------------------------------------------------ the endpoint dialog */

/**
 * @param {object[]} endpoints  apiEndpointsList — ALL endpoints, not one API's
 * @param {number}   editing    position in that list, or -1 to add
 * @param {string}   apiId      the integration this endpoint belongs to
 * @param {string[]} sources    eventPropertyValueAvailableProperties
 * @param {boolean}  readonly   true for an ethos integration
 * @returns {Promise<boolean>}  true when the dialog saved
 */
function openApiEndpointDialog(endpoints, editing, apiId, sources, readonly) {
    // The Add defaults.
    const row = editing === -1
        ? { apiId, name: null, endpoint: null, method: 'GET', mimeType: null, parameterMappings: null }
        : util.copy(endpoints[editing]);

    /**
     * The stored value is a JSON string; the dialog edits an array and Save serialises it back. A
     * trailing empty row is always present, which is what makes newParameterMapping() work.
     */
    const mappings = [];
    if (row.parameterMappings !== null && row.parameterMappings !== undefined) {
        for (const mapping of JSON.parse(row.parameterMappings)) {
            mappings.push({ parameter: mapping.parameter, eventData: mapping.eventData });
        }
    }
    mappings.push({ parameter: '', eventData: null });

    return openModal({
        template: ENDPOINT_TEMPLATE,
        windowClass: 'show',
        backdrop: 'static',
        setup(content, modal) {
            const host = { apiEndpoint: row };
            const methodSelect = content.querySelector('#method');
            const mappingHost = content.querySelector('#parameterMappingRows');
            const mappingTemplate = content.querySelector('#parameterMappingRowTemplate');
            const msg = (id) => content.querySelector('#' + id);

            content.querySelector('#apiEndpointModalTitle').textContent =
                (editing === -1 ? 'Add' : 'Edit') + ' Endpoint';

            model.load(content, host);
            const offTrack = model.track(content, host);

            // An Ethos integration fixes these three.
            content.querySelector('#endpoint').disabled = readonly;
            methodSelect.disabled = readonly;
            content.querySelector('#mimeType').disabled = readonly;

            /** MIME type applies to POST and PUT only. */
            function methodTakesMimeType() {
                return methodSelect.value === 'POST' || methodSelect.value === 'PUT';
            }

            function refreshMimeType() {
                content.querySelector('#mimeTypeRow').hidden = !methodTakesMimeType();
            }

            /**
             * Switching to a method that has no MIME type drops the value here, where the user's
             * choice actually happens, rather than as a side effect of validating on Save.
             */
            function onMethodChange() {
                if (!methodTakesMimeType()) {
                    row.mimeType = '';
                    model.write(content.querySelector('#mimeType'), '');
                }
                refreshMimeType();
            }

            function appendMappingRow(mapping, index) {
                const tr = mappingTemplate.content.firstElementChild.cloneNode(true);
                tr.dataset.mappingIndex = index;

                tr.querySelector('.cl-parameter').value = mapping.parameter ?? '';

                const eventData = tr.querySelector('.cl-event-data');
                for (const name of sources || []) {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    eventData.appendChild(option);
                }
                eventData.value = mapping.eventData ?? '';

                // The first row's Delete is hidden.
                tr.querySelector('.cl-delete-mapping').hidden = index === 0;
                mappingHost.appendChild(tr);
            }

            function renderMappings() {
                mappingHost.textContent = '';
                mappings.forEach(appendMappingRow);
            }

            /**
             * Filling the last row appends a fresh empty one.
             *
             * IT APPENDS ONE ROW AND DOES NOT RE-RENDER, and that distinction is the whole reason
             * grids rebuild only on add and delete. This runs on every keystroke in the last row's
             * parameter box, so a full rebuild would replace the very input being typed into. The
             * existing rows keep their identity, focus and caret; only the new empty row is created.
             */
            function newParameterMapping() {
                if (mappings[mappings.length - 1].parameter !== '') {
                    mappings.push({ parameter: '', eventData: null });
                    appendMappingRow(mappings[mappings.length - 1], mappings.length - 1);
                }
            }

            /** All four messages are set here, and they all appear together on Save. */
            function formIsValid() {
                let ok = true;
                msg('endpointNameRequired').hidden = true;
                msg('endpointNameDuplicate').hidden = true;
                msg('endpointMimeTypeRequired').hidden = true;
                msg('endpointNoParameters').hidden = true;

                if (util.isNullOrWhitespace(row.name)) {
                    ok = false;
                    msg('endpointNameRequired').hidden = false;
                }
                // The duplicate check spans ALL integrations' endpoints, as it always did.
                for (let i = 0; i < endpoints.length; i++) {
                    if (i !== editing && endpoints[i].name === row.name) {
                        ok = false;
                        msg('endpointNameDuplicate').hidden = false;
                    }
                }
                // Validation only. Clearing on GET/DELETE is onMethodChange()'s job.
                if ((row.method === 'POST' || row.method === 'PUT')
                    && util.isNullOrWhitespace(row.mimeType)) {
                    ok = false;
                    msg('endpointMimeTypeRequired').hidden = false;
                }
                // Any row with a parameter satisfies this; position does not matter, and blank rows
                // are dropped by cleanupParameterMappings(). Whitespace-only counts as blank here
                // for the same reason — otherwise it would pass and then be spliced away on save.
                const hasParameters = mappings.some(
                    (mapping) => !util.isNullOrWhitespace(mapping.parameter)
                );
                if (!hasParameters) {
                    ok = false;
                }
                msg('endpointNoParameters').hidden = hasParameters;
                return ok;
            }

            /**
             * Drops the blank rows and serialises the rest back into the stored JSON string.
             */
            function cleanupParameterMappings() {
                let i = mappings.length;
                while (i--) {
                    if (util.isNullOrWhitespace(mappings[i].parameter)) {
                        mappings.splice(i, 1);
                    }
                }
                row.parameterMappings = JSON.stringify(mappings);
            }

            const offs = [
                offTrack,
                dom.on(methodSelect, 'change', onMethodChange),
                dom.on(mappingHost, 'input', (event) => {
                    const tr = event.target.closest('[data-mapping-index]');
                    if (!tr || !event.target.classList.contains('cl-parameter')) {
                        return;
                    }
                    mappings[Number(tr.dataset.mappingIndex)].parameter = event.target.value;
                    newParameterMapping();
                }),
                dom.on(mappingHost, 'change', (event) => {
                    const tr = event.target.closest('[data-mapping-index]');
                    if (!tr || !event.target.classList.contains('cl-event-data')) {
                        return;
                    }
                    mappings[Number(tr.dataset.mappingIndex)].eventData = event.target.value;
                }),
                dom.on(mappingHost, 'click', (event) => {
                    const button = event.target.closest('[data-action="delete-mapping"]');
                    if (!button) {
                        return;
                    }
                    mappings.splice(Number(button.closest('[data-mapping-index]').dataset.mappingIndex), 1);
                    renderMappings();
                }),
                dom.on(content.querySelector('.modal-footer'), 'click', (event) => {
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
                    cleanupParameterMappings();
                    const saved = util.copy(row);
                    if (editing === -1) {
                        endpoints.push(saved);
                    } else {
                        endpoints[editing] = saved;
                    }
                    modal.close(true);
                })
            ];

            // Normalises on open too: an endpoint stored with GET and a stale MIME type loses it.
            onMethodChange();
            renderMappings();

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
    return mountStep(view, locals, ({ config }) => {
        const integrations = config.campusLogicSection.apiIntegrationsList;
        const endpoints = config.campusLogicSection.apiEndpointsList;
        const pageValid = validation.state.pageValidations.apiIntegrationsValid;

        const host = view.querySelector('#apiIntegrationList');
        const blockTemplate = view.querySelector('#apiIntegrationBlockTemplate');
        const commandsTemplate = view.querySelector('#apiIntegrationCommandsTemplate');
        const endpointRowTemplate = view.querySelector('#apiEndpointRowTemplate');
        const mappingTemplate = view.querySelector('#apiParameterMappingTemplate');
        const empty = view.querySelector('#noApiIntegrations');

        /** One integration's endpoints, computed rather than cached. */
        function endpointsFor(apiId) {
            return endpoints.filter((endpoint) => endpoint.apiId === apiId);
        }

        function sources() {
            return config.campusLogicSection.eventPropertyValueAvailableProperties;
        }

        /** The one-row grid whose columns depend on the authentication method. */
        function buildApiGrid(table, integration) {
            // An entry with no authentication yet still gets the base three columns, so it is
            // visible — and therefore editable and deletable — rather than an empty grid.
            const columns = API_COLUMNS[integration.authentication] || API_COLUMNS.none;
            const head = table.tHead.rows[0];
            const body = table.tBodies[0].rows[0];
            for (const col of columns) {
                const th = document.createElement('th');
                th.textContent = col.title;
                head.appendChild(th);
                const td = body.insertCell();
                td.textContent = col.format
                    ? col.format(integration[col.field])
                    : (integration[col.field] ?? '');
            }
            const commandsHeader = document.createElement('th');
            commandsHeader.className = 'cl-grid-commands';
            head.appendChild(commandsHeader);
            body.appendChild(commandsTemplate.content.firstElementChild.cloneNode(true));
        }

        /** The Parameter Mappings cell: one "parameter -> eventData" line per entry. */
        function fillMappingCell(td, json) {
            // JSON.parse(null) is null, which is the case the old template's `if` was guarding.
            const parsed = JSON.parse(json === undefined ? null : json);
            if (!parsed) {
                return;
            }
            for (const mapping of parsed) {
                const line = mappingTemplate.content.firstElementChild.cloneNode(true);
                line.querySelector('.cl-parameter').textContent = mapping.parameter ?? '';
                line.querySelector('.cl-event-data').textContent = mapping.eventData ?? '';
                td.appendChild(line);
            }
        }

        function renderEndpoints(tbody, list, isEthos) {
            tbody.textContent = '';
            for (const endpoint of list) {
                const tr = endpointRowTemplate.content.firstElementChild.cloneNode(true);
                const cells = tr.cells;
                cells[0].textContent = endpoint.name ?? '';
                cells[1].textContent = endpoint.endpoint ?? '';
                cells[2].textContent = endpoint.method ?? '';
                cells[3].textContent = endpoint.mimeType ?? '';
                fillMappingCell(cells[4], endpoint.parameterMappings);
                // An Ethos endpoint cannot be deleted.
                tr.querySelector('.cl-delete-endpoint').hidden = isEthos;
                tbody.appendChild(tr);
            }
        }

        function render() {
            host.textContent = '';
            integrations.forEach((integration, index) => {
                const block = blockTemplate.content.firstElementChild.cloneNode(true);
                block.dataset.apiIndex = index;

                const isEthos = integration.authentication === 'ethos';
                const mine = endpointsFor(integration.apiId);

                buildApiGrid(block.querySelector('.cl-api-grid'), integration);

                block.querySelector('.cl-endpoints-wrapper').hidden = mine.length === 0;
                renderEndpoints(block.querySelector('.cl-endpoints-grid tbody'), mine, isEthos);

                block.querySelector('.cl-no-endpoints').hidden = !(mine.length === 0 && !pageValid);

                // The Ethos message names the endpoint it is complaining about, and stays hidden
                // when there are no endpoints at all.
                const ethosMessage = block.querySelector('.cl-ethos-parameters');
                const first = mine[0];
                const missingParameters = isEthos && first
                    && (first.parameterMappings === null || first.parameterMappings === undefined);
                ethosMessage.hidden = !(missingParameters && !pageValid);
                if (missingParameters) {
                    ethosMessage.textContent = (first.name ?? '') + ': At least one parameter is required.';
                }

                // An Ethos integration cannot take further endpoints.
                block.querySelector('.cl-add-endpoint').hidden = isEthos;

                host.appendChild(block);
            });

            empty.hidden = integrations.length !== 0;
            view.querySelector('#noApiIntegrationsRequired').hidden = pageValid;
        }

        /** Last id plus one, as a string. */
        function newId() {
            if (integrations.length > 0) {
                return String(parseInt(integrations[integrations.length - 1].apiId, 10) + 1);
            }
            return '0';
        }

        async function addApiIntegration() {
            // Pushed BEFORE the dialog opens, because the dialog is handed the entry. See the header.
            const integration = {
                apiId: newId(),
                apiName: null,
                authentication: null,
                tokenService: null,
                root: null,
                username: null,
                password: null
            };
            integrations.push(integration);
            // Not rendered yet: the entry exists only so the dialog has its apiId, and every entry
            // now renders, so drawing it here would flash a blank integration behind the dialog.

            const saved = await openApiIntegrationDialog(integrations, integration);
            if (!saved) {
                // Cancel removes the half-built entry. core/modal.js resolves undefined rather
                // than rejecting, so this has to hang off a falsy result.
                integrations.splice(integrations.length - 1, 1);
                render();
                return;
            }
            // Re-find the entry: the dialog REPLACED it in the list rather than mutating it.
            const stored = integrations.filter((a) => a.apiId === integration.apiId)[0];
            if (stored && stored.authentication === 'ethos') {
                endpoints.push({
                    apiId: stored.apiId,
                    name: 'Ethos Publish',
                    endpoint: '/publish',
                    method: 'POST',
                    mimeType: 'application/json',
                    parameterMappings: null
                });
            }
            render();
        }

        async function onClick(event) {
            const button = event.target.closest('[data-action]');
            if (!button) {
                return;
            }
            const block = button.closest('[data-api-index]');
            const integration = integrations[Number(block.dataset.apiIndex)];
            const action = button.dataset.action;

            if (action === 'edit-api') {
                if (await openApiIntegrationDialog(integrations, integration)) {
                    render();
                }
                return;
            }
            if (action === 'delete-api') {
                integrations.splice(integrations.indexOf(integration), 1);
                // "Remove all corresponding endpoints", backwards so the splices do not shift.
                let i = endpoints.length;
                while (i--) {
                    if (endpoints[i].apiId === integration.apiId) {
                        endpoints.splice(i, 1);
                    }
                }
                render();
                return;
            }

            const isEthos = integration.authentication === 'ethos';

            if (action === 'add-endpoint') {
                if (await openApiEndpointDialog(endpoints, -1, integration.apiId, sources(), isEthos)) {
                    render();
                }
                return;
            }

            // A row of the endpoints grid. Its position is a position in THIS API's subset, so the
            // object it names is what locates it in the full list. Matching by endpoint URL instead
            // would delete the wrong row when two APIs share a path.
            const row = endpointsFor(integration.apiId)[button.closest('tr').sectionRowIndex];
            const position = endpoints.indexOf(row);

            if (action === 'delete-endpoint') {
                endpoints.splice(position, 1);
                render();
                return;
            }
            if (action === 'edit-endpoint') {
                if (await openApiEndpointDialog(endpoints, position, integration.apiId, sources(), isEthos)) {
                    render();
                }
            }
        }

        const offs = [
            dom.on(view.querySelector('#addApiIntegration'), 'click', addApiIntegration),
            dom.on(host, 'click', onClick)
        ];

        render();

        return () => {
            for (const off of offs) {
                off();
            }
        };
    });
}
