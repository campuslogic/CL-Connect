/**
 * pages/formStep.js — the mount for a wizard step that is nothing but a configuration form.
 *
 * Ten steps use this. Their Razor views carry all of the behaviour: a `name` attribute per control
 * (core/model.js loads and saves it), <cl-folder-picker> and <cl-days-picker> elements that
 * pages/shell.js mounts, and .cl-required spans that Content/app.css §11 shows and hides. Nothing is
 * left for a page module to do, so main.js's stepRoute defaults to this one.
 *
 * A step that grows behaviour of its own gets its own module again, and main.js names it.
 */

import { mountStep } from './shell.js';

export function mount(view, locals) {
    return mountStep(view, locals);
}
