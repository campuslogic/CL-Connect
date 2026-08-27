/**
 * core/model.js — loads the configuration object into a form and reads it back out. This is the
 * whole data layer.
 * 
 * This is in charge of the config and keeping it in sync with edits, it tries to ignore ireelevant or invalid
 * updates
 *
 * A control's `name` attribute IS its path into the configuration object:
 *
 *     <input name="smtpSection.from">   <->   config.smtpSection.from
 *
 * load()   config -> DOM, once, when the page mounts.
 * track()  DOM -> config, on input/change, two delegated listeners per page.
 *
 * One way each way, which is all a form needs. Nothing re-renders while the user types, so there is
 * no caret to protect and no state to converge.
 *
 * Using `name` rather than a data-* attribute buys three things from the platform: radio groups
 * uncheck each other, `form.elements['path']` finds a field without a query, and constraint
 * validation reports against a real named control.
 *
 * Only controls whose name contains a dot are configuration fields — every path has at least a
 * section and a key. A plain name means the control is local to its page (Export's per-table
 * checkboxes, Event Notifications' DSN boxes) and is left alone. The FIELDS selector is that rule.
 */

import * as dom from './dom.js';

/** Configuration-bound controls. The `*="."` is the "is this a config path" test. */
const FIELDS = 'input[name*="."], select[name*="."], textarea[name*="."]';

/** read() returns this when the control's value is not yet meaningful; callers skip the write. */
const SKIP = Symbol('cl.skip');

const warned = new Set();

/* ------------------------------------------------------------------ paths */

/**
 * Reads a dotted path. Returns undefined for any missing link rather than throwing, because the
 * configuration legitimately lacks whole sections (an unconfigured SMTP has no
 * specifiedPickupDirectory) and a page must still render.
 */
export function get(obj, path) {
    let o = obj;
    for (const key of path.split('.')) {
        if (o === null || o === undefined) {
            return undefined;
        }
        o = o[key];
    }
    return o;
}

/**
 * Writes a dotted path. Intermediate objects are NOT created: the configuration's shape comes
 * from Web.config, and inventing a section here would write a new one on Save. A missing link
 * means the markup and the configuration disagree, so it warns once and drops the write.
 *
 * @returns {boolean} whether the value was stored
 */
export function put(obj, path, value) {
    const keys = path.split('.');
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        o = o === null || o === undefined ? undefined : o[keys[i]];
        if (o === null || typeof o !== 'object') {
            if (!warned.has(path)) {
                warned.add(path);
                console.warn('[model] no such configuration path, edit discarded:', path);
            }
            return false;
        }
    }
    o[keys[keys.length - 1]] = value;
    return true;
}

/* ------------------------------------------------------------------ one control */

/** 'true'/'false' become real booleans; anything else stays a string. Radios only. */
function literal(text) {
    if (text === 'true') {
        return true;
    }
    if (text === 'false') {
        return false;
    }
    return text;
}

/**
 * Reads one control, coerced to the type Web.config expects.
 *
 * THIS TABLE IS THE ONE THING IN THE FILE THAT CAN SILENTLY CORRUPT A SAVED CONFIGURATION. A
 * boolean arriving as the string "true", or a port arriving as the number 25 instead of the string
 * "25", both change what gets written.
 */
export function read(el) {
    switch (el.type) {
        case 'checkbox':
            return el.checked;

        case 'radio':
            // Callers only reach here for the checked radio of a group.
            return literal(el.value);

        case 'number':
            if (el.value === '') {
                // badInput is a half-typed value like '-' or '1e', which the control reports as
                // empty. Writing now would null a purge threshold mid-keystroke.
                return el.validity && el.validity.badInput ? SKIP : null;
            }
            return Number.isNaN(el.valueAsNumber) ? SKIP : el.valueAsNumber;

        default:
            // The trim reaches Web.config while the untrimmed text stays visible in the box.
            return el.value.trim();
    }
}

/** Writes one control from a configuration value. */
export function write(el, value) {
    if (el.type === 'checkbox') {
        el.checked = !!value;
        return;
    }
    if (el.type === 'radio') {
        // Loose == is load-bearing: an integer-valued enum still selects its radio.
        el.checked = literal(el.value) == value;   // eslint-disable-line eqeqeq
        return;
    }
    el.value = value === null || value === undefined ? '' : String(value);
}

/* ------------------------------------------------------------------ whole form */

/**
 * config -> DOM. Call once per page mount, AFTER any component that supplies its own controls has
 * mounted — components/folderPicker.js names its input from the element's data-path, and a field
 * that does not exist yet cannot be filled.
 */
export function load(root, config) {
    for (const el of root.querySelectorAll(FIELDS)) {
        write(el, get(config, el.name));
    }
}

/**
 * DOM -> config, for every edit. Two delegated listeners at the page root, so controls created
 * later (a folder picker inside a toggled section) are covered without re-wiring.
 *
 * Both events are listened for because they cover different controls: `input` fires per keystroke
 * on text and number fields, `change` on selects, checkboxes and radios. Committing on every
 * keystroke is cheap here precisely because nothing re-renders in response.
 *
 * @returns {Function} off()
 */
export function track(root, config) {
    const commit = (event) => {
        const el = event.target;
        if (!el.name || !el.matches || !el.matches(FIELDS)) {
            return;
        }
        if (el.type === 'radio' && !el.checked) {
            return;
        }
        // What dirty() reads. Marked on the control's own form when it has one, so two forms on
        // one page stay independent.
        (el.form || root).classList.add('cl-dirty');
        const value = read(el);
        if (value !== SKIP) {
            put(config, el.name, value);
        }
    };
    const offInput = dom.on(root, 'input', commit);
    const offChange = dom.on(root, 'change', commit);
    return () => {
        offInput();
        offChange();
    };
}

/* ------------------------------------------------------------------ validation display */

/**
 * Turns on the "show errors on fields the user never touched" state — see Content/app.css §11.
 *
 * Untouched invalid fields are normally silent, which :user-invalid gives for free. But the wizard
 * also has to light them up when a page is known to be invalid without the user having done
 * anything: entering a step runs its validator, and Save runs all of them.
 */
export function showErrors(root, on) {
    root.classList.toggle('show-errors', !!on);
}

/**
 * Is every constraint on every control under `root` satisfied?
 *
 * Not root.checkValidity(), for two reasons: `root` is often the view container rather than a
 * <form>, and checkValidity() also fires an invalid event per control. This only reads.
 * willValidate excludes disabled, readonly and hidden-by-type controls.
 *
 * A CONTROL THE USER CANNOT SEE MUST NOT BLOCK THE FORM. Conditional sections here are toggled with
 * `hidden` rather than removed from the DOM, so that exclusion has to be stated. SMTP is the case
 * that proves it: its two delivery-method sections are mutually exclusive and both hold `required`
 * inputs, so without the [hidden] test a Network configuration leaves the hidden pickup-directory
 * input empty-and-invalid, and the Test SMTP button does nothing at all.
 *
 * `[hidden]` is the right test because it is the only way this app hides a section — app.css
 * forces `[hidden] { display: none !important }` precisely so that stays true against Bootstrap.
 */
export function valid(root) {
    for (const el of [...root.querySelectorAll('input, select, textarea')]) {
        if (el.willValidate && !el.checkValidity() && !el.closest('[hidden]')) {
            return false;
        }
    }
    return true;
}

/** Has the user edited anything under `root`? See track(). */
export function dirty(root) {
    return root.classList.contains('cl-dirty');
}
