/**
 * components/tree.js — a lazy, single-selection folder tree over
 * GET api/folderpicker/openfolderexplorer. Used only by the folder picker's dialog.
 *
 * FOUR SERVER BEHAVIOURS SHAPE THIS, and none of them can be fixed from here:
 *
 *  - The response is [{ path, name, hasChildren }], and `path` is the identity.
 *
 *  - hasChildren IS ALWAYS TRUE, because the server sets it from "is this a DirectoryInfo" and
 *    every surviving entry is one. So every node gets an expander, including empty folders, and an
 *    expand can legitimately return []. Hiding the expanders would need a probe request per node,
 *    i.e. a full recursive crawl of C: on open.
 *
 *  - THE ROOT IS HARDCODED c:\ AND IS NOT ITSELF A NODE. A blank directoryPath is rewritten to c:\
 *    and anything resolving outside it is rejected, so the first level is C:'s children. There is no
 *    drive list, and `c:\` can only be typed into the picker's input, never picked from the tree.
 *
 *  - FOLDERS CARRYING EXTRA ATTRIBUTE FLAGS ARE INVISIBLE. The server filters on
 *    `Attributes == FileAttributes.Directory` — exact equality, not HasFlag — so anything marked
 *    ReadOnly, System, Archive, ReparsePoint or NotContentIndexed is omitted. Expect a sparse tree.
 *
 * EVERY FAILURE ARRIVES AS A BODILESS 417, including access-denied, so err.message is a generic
 * 'HTTP 417' and naming the folder is the only useful information available. The node renders an
 * inline retry row rather than spinning forever.
 */

import * as dom from '../core/dom.js';
import * as http from '../core/http.js';

const READ_URL = 'api/folderpicker/openfolderexplorer';

/**
 * tree(container, { onSelect })
 *   onSelect(path)  fired on every selection change; the picker keeps the latest value.
 * -> { destroy() }
 */
export function tree(container, options) {
    const opts = options || {};

    const el = document.createElement('div');
    el.className = 'cl-tree';
    el.setAttribute('role', 'tree');

    // Children are attached to their owning <li>, so collapsing keeps a loaded subtree in the
    // DOM: load once, then toggle.
    const rootList = document.createElement('ul');
    rootList.className = 'cl-tree-list';
    el.appendChild(rootList);
    container.appendChild(el);

    let selectedRow = null;

    function row(item) {
        const li = document.createElement('li');
        li.className = 'cl-tree-item';
        li.setAttribute('role', 'treeitem');
        li.dataset.path = item.path;
        // Every node claims children (see the header), so every node gets an expander.
        li.setAttribute('aria-expanded', 'false');

        const line = document.createElement('div');
        line.className = 'cl-tree-line';

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'cl-tree-toggle';
        // The label is on the row, so the caret itself is decorative.
        toggle.setAttribute('aria-hidden', 'true');
        toggle.tabIndex = -1;

        const label = document.createElement('button');
        label.type = 'button';
        label.className = 'cl-tree-label';
        label.textContent = item.name;

        line.append(toggle, label);
        li.appendChild(line);
        return li;
    }

    function setBusy(li, busy) {
        li.classList.toggle('is-busy', !!busy);
    }

    function clearChildren(host) {
        if (host === el) {
            // The root list is permanent — emptying it keeps reload()/Retry working. Removing it
            // (as the generic branch does for an <li>) would leave nowhere to render into.
            rootList.replaceChildren();
        }
        for (const kid of [...host.querySelectorAll(':scope > .cl-tree-error, :scope > .cl-tree-empty')]) {
            kid.remove();
        }
        if (host !== el) {
            const list = host.querySelector(':scope > .cl-tree-list');
            if (list) {
                list.remove();
            }
        }
    }

    function showError(li, message) {
        clearChildren(li);
        const box = document.createElement('div');
        box.className = 'cl-tree-error';
        const text = document.createElement('span');
        // A bodiless 417 has no message worth showing, so name the folder instead.
        text.textContent = message;
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'cl-tree-retry';
        retry.textContent = 'Retry';
        box.append(text, retry);
        li.appendChild(box);
        li.dataset.loaded = 'false';
    }

    async function load(li) {
        const path = li ? li.dataset.path : '';
        const host = li || el;
        setBusy(host, true);
        try {
            // directoryPath='' is what the old transport sent for the root (`id || ""`), and the
            // server rewrites it to c:\.
            const items = await http.get(READ_URL, { directoryPath: path || '' });
            const list = Array.isArray(items) ? items : [];
            if (li) {
                clearChildren(li);
                li.dataset.loaded = 'true';
                if (!list.length) {
                    // Claimed children, delivered none. Say so, since the expander cannot be
                    // removed — see the header.
                    const empty = document.createElement('div');
                    empty.className = 'cl-tree-empty';
                    empty.textContent = 'No sub-folders';
                    li.appendChild(empty);
                    return;
                }
            } else {
                // Also clears a previous root-level error box, so Retry recovers cleanly.
                clearChildren(el);
            }
            const target = li ? document.createElement('ul') : rootList;
            if (li) {
                target.className = 'cl-tree-list';
            }
            for (const item of list) {
                target.appendChild(row(item));
            }
            if (li) {
                li.appendChild(target);
            }
        } catch (e) {
            const name = li ? li.dataset.path : 'c:\\';
            // Every server-side failure arrives as a bodiless 417, so err.message is a generic
            // 'HTTP 417'. Naming the folder is the only useful information available.
            showError(li || el, 'Could not read ' + name);
            if (li) {
                li.setAttribute('aria-expanded', 'false');
            }
        } finally {
            setBusy(host, false);
        }
    }

    function select(li) {
        if (selectedRow) {
            selectedRow.classList.remove('is-selected');
            selectedRow.removeAttribute('aria-selected');
        }
        selectedRow = li;
        li.classList.add('is-selected');
        li.setAttribute('aria-selected', 'true');
        if (opts.onSelect) {
            opts.onSelect(li.dataset.path);
        }
    }

    async function toggleNode(li) {
        const open = li.getAttribute('aria-expanded') === 'true';
        if (open) {
            li.setAttribute('aria-expanded', 'false');
            return;
        }
        li.setAttribute('aria-expanded', 'true');
        if (li.dataset.loaded !== 'true') {
            await load(li);
        }
    }

    // One delegated listener for the whole tree. The component owns its own DOM entirely.
    const offClick = dom.on(el, 'click', (event) => {
        const target = event.target;
        if (!target || !target.closest) {
            return;
        }
        const retry = target.closest('.cl-tree-retry');
        if (retry) {
            const li = retry.closest('.cl-tree-item');
            load(li || null);
            return;
        }
        const toggle = target.closest('.cl-tree-toggle');
        if (toggle) {
            const li = toggle.closest('.cl-tree-item');
            if (li) {
                toggleNode(li);
            }
            return;
        }
        const label = target.closest('.cl-tree-label');
        if (label) {
            const li = label.closest('.cl-tree-item');
            if (li) {
                select(li);
                // Clicking the label expands as well as selects.
                toggleNode(li);
            }
        }
    });

    load(null);

    return {
        destroy() {
            offClick();
            el.remove();
        }
    };
}
