import type { Annotation } from '../types';

export function renderNoteList(container: HTMLElement, annotations: Annotation[], onJump: (id: string) => void): void {
  container.innerHTML = '';

  if (annotations.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No notes on this page.';
    container.appendChild(empty);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'note-list';

  for (const annotation of annotations) {
    const item = document.createElement('li');
    item.className = 'note-item';

    const colorDot = document.createElement('span');
    colorDot.className = 'color-dot';
    colorDot.style.background = annotation.color;

    const body = document.createElement('div');
    body.className = 'note-body';

    const excerpt = document.createElement('div');
    excerpt.className = 'note-excerpt';
    excerpt.textContent = truncate(annotation.anchor.selectedText, 60);

    const text = document.createElement('div');
    text.className = 'note-text';
    text.textContent = truncate(annotation.noteText, 100);

    body.appendChild(excerpt);
    body.appendChild(text);

    if (annotation.anchorFailed) {
      const badge = document.createElement('span');
      badge.className = 'not-found-badge';
      badge.textContent = 'not found';
      body.appendChild(badge);
    }

    const jumpBtn = document.createElement('button');
    jumpBtn.className = 'jump-btn';
    jumpBtn.textContent = '↗';
    jumpBtn.title = 'Jump to highlight';
    jumpBtn.disabled = annotation.anchorFailed === true;
    jumpBtn.addEventListener('click', () => onJump(annotation.id));

    item.appendChild(colorDot);
    item.appendChild(body);
    item.appendChild(jumpBtn);
    list.appendChild(item);
  }

  container.appendChild(list);
}

function truncate(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max) + '…';
}
