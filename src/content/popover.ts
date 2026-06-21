import type { Annotation, Scope } from '../types';
import { normalizeUrl } from '../url-utils';

const COLORS = ['#ffd700', '#ff6b6b', '#51cf66', '#74c0fc', '#cc5de8'];

type SaveCallback = (noteText: string, scope: Scope, color: string) => void;
type UpdateCallback = (noteText: string) => void;
type DeleteCallback = () => void;

let popoverEl: HTMLDivElement | null = null;

function getPopover(): HTMLDivElement {
  if (popoverEl) return popoverEl;
  popoverEl = document.createElement('div');
  popoverEl.id = 'bn-popover';
  popoverEl.style.display = 'none';
  document.body.appendChild(popoverEl);

  // Close on outside click
  document.addEventListener('mousedown', (e) => {
    if (popoverEl && !popoverEl.contains(e.target as Node)) {
      hide();
    }
  });
  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
  });

  return popoverEl;
}

function positionNear(rect: DOMRect): void {
  const el = getPopover();
  const margin = 8;
  const popW = 280;
  const popH = el.offsetHeight || 200;

  let left = rect.left;
  let top = rect.bottom + margin;

  // Clamp horizontally
  if (left + popW > window.innerWidth - margin) {
    left = window.innerWidth - popW - margin;
  }
  left = Math.max(margin, left);

  // Flip above if not enough room below
  if (top + popH > window.innerHeight - margin) {
    top = rect.top - popH - margin;
  }
  top = Math.max(margin, top);

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

export function showCreate(rect: DOMRect, onSave: SaveCallback): void {
  const el = getPopover();
  el.innerHTML = '';
  el.style.display = 'block';

  const currentUrl = location.href;
  const { normalized, domain } = normalizeUrl(currentUrl);

  // Textarea
  const textarea = document.createElement('textarea');
  textarea.placeholder = 'Add a note…';
  el.appendChild(textarea);

  // Color swatches
  const colorRow = document.createElement('div');
  colorRow.className = 'bn-color-row';
  let selectedColor = COLORS[0];

  for (const color of COLORS) {
    const swatch = document.createElement('button');
    swatch.className = 'bn-color-swatch' + (color === selectedColor ? ' selected' : '');
    swatch.style.background = color;
    swatch.title = color;
    swatch.addEventListener('click', () => {
      selectedColor = color;
      colorRow.querySelectorAll('.bn-color-swatch').forEach((s) => s.classList.remove('selected'));
      swatch.classList.add('selected');
    });
    colorRow.appendChild(swatch);
  }
  el.appendChild(colorRow);

  // Scope radios
  const scopeRow = document.createElement('div');
  scopeRow.className = 'bn-scope-row';

  const scopes: Array<{ value: Scope; label: string }> = [
    { value: 'exact', label: `This page (${normalized})` },
    { value: 'domain', label: `All of ${domain}` },
  ];

  let selectedScope: Scope = 'exact';

  for (const { value, label } of scopes) {
    const lbl = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'bn-scope';
    radio.value = value;
    radio.checked = value === 'exact';
    radio.addEventListener('change', () => { selectedScope = value; });
    lbl.appendChild(radio);
    lbl.appendChild(document.createTextNode(label));
    scopeRow.appendChild(lbl);
  }
  el.appendChild(scopeRow);

  // Buttons
  const btnRow = document.createElement('div');
  btnRow.className = 'bn-btn-row';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'bn-btn bn-btn-secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', hide);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'bn-btn bn-btn-primary';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    const text = textarea.value.trim();
    if (!text) { textarea.focus(); return; }
    hide();
    onSave(text, selectedScope, selectedColor);
  });

  // Allow Ctrl/Cmd+Enter to save
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      saveBtn.click();
    }
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);
  el.appendChild(btnRow);

  positionNear(rect);
  textarea.focus();
}

export function showView(
  annotation: Annotation,
  markRect: DOMRect,
  onUpdate: UpdateCallback,
  onDelete: DeleteCallback,
): void {
  const el = getPopover();
  el.innerHTML = '';
  el.style.display = 'block';

  if (annotation.anchorFailed) {
    const notice = document.createElement('div');
    notice.className = 'bn-not-found-notice';
    notice.textContent = 'Note text not found on this page.';
    el.appendChild(notice);
  }

  // Scope display
  const scopeDisplay = document.createElement('div');
  scopeDisplay.className = 'bn-scope-display';
  const scopeLabel: Record<Scope, string> = {
    exact: 'This page only',
    domain: `All of ${annotation.urlKey}`,
  };
  scopeDisplay.textContent = scopeLabel[annotation.scope];
  el.appendChild(scopeDisplay);

  // Editable note text
  const noteEl = document.createElement('div');
  noteEl.className = 'bn-note-text';
  noteEl.contentEditable = 'true';
  noteEl.textContent = annotation.noteText;
  el.appendChild(noteEl);

  // Buttons
  const btnRow = document.createElement('div');
  btnRow.className = 'bn-btn-row';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'bn-btn bn-btn-danger';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', () => {
    hide();
    onDelete();
  });

  const saveBtn = document.createElement('button');
  saveBtn.className = 'bn-btn bn-btn-primary';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    const text = (noteEl.textContent ?? '').trim();
    if (!text) return;
    hide();
    onUpdate(text);
  });

  const closeBtn = document.createElement('button');
  closeBtn.className = 'bn-btn bn-btn-secondary';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', hide);

  btnRow.appendChild(deleteBtn);
  btnRow.appendChild(closeBtn);
  btnRow.appendChild(saveBtn);
  el.appendChild(btnRow);

  positionNear(markRect);
  noteEl.focus();
}

function hide(): void {
  if (popoverEl) popoverEl.style.display = 'none';
}
