/** core/util.js — the two helpers with more than one caller. */

/**
 * Note isNullOrWhitespace(0) === false, because '0'.trim() !== ''. The batch process dialog relies
 * on that: a Max Batch Size of 0 must not report "Required". Do not simplify to a falsiness check.
 */
export function isNullOrWhitespace(value) {
    if (value === undefined || value === null) {
        return true;
    }
    return value.toString().trim() === '';
}

/** Deep copy. Everything copied here originates as JSON from Web.config. */
export function copy(value) {
    return structuredClone(value);
}
