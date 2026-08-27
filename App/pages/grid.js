/** pages/grid.js — shared by the grid pages, which are otherwise a render loop each. */

/** The placeholder row for an empty grid. Styled by Content/app.css */
export function emptyRow(columns) {
    const tr = document.createElement('tr');
    const td = tr.insertCell();
    td.colSpan = columns;
    td.className = 'cl-grid-empty';
    td.textContent = 'No records available.';
    return tr;
}
