import type { Annotation } from '../types';

const HIGHLIGHT_CLASS = 'bn-highlight';

// Hex color → rgba with alpha for background
function colorToBackground(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},0.35)`;
}

export function applyHighlight(range: Range, annotation: Annotation): HTMLElement[] {
  const marks: HTMLElement[] = [];

  // Collect all text nodes within the range
  const textNodes: Array<{ node: Text; start: number; end: number }> = [];
  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
  );

  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    if (!range.intersectsNode(node)) continue;
    const nodeRange = document.createRange();
    nodeRange.selectNodeContents(node);

    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : node.length;
    textNodes.push({ node, start, end });
  }

  for (const { node: textNode, start, end } of textNodes) {
    if (start >= end) continue;
    wrapTextNode(textNode, start, end, annotation, marks);
  }

  return marks;
}

function wrapTextNode(
  textNode: Text,
  start: number,
  end: number,
  annotation: Annotation,
  marks: HTMLElement[],
): void {
  const parent = textNode.parentNode;
  if (!parent) return;

  // Split the text node into: [before][selected][after]
  const before = textNode.textContent?.slice(0, start) ?? '';
  const selected = textNode.textContent?.slice(start, end) ?? '';
  const after = textNode.textContent?.slice(end) ?? '';

  const mark = document.createElement('mark');
  mark.className = HIGHLIGHT_CLASS;
  mark.dataset.annotationId = annotation.id;
  mark.style.setProperty('--bn-color', colorToBackground(annotation.color));
  mark.style.setProperty('--bn-color-solid', annotation.color);
  mark.textContent = selected;
  marks.push(mark);

  const fragment = document.createDocumentFragment();
  if (before) fragment.appendChild(document.createTextNode(before));
  fragment.appendChild(mark);
  if (after) fragment.appendChild(document.createTextNode(after));

  parent.replaceChild(fragment, textNode);
}

export function removeHighlight(annotationId: string): void {
  const marks = Array.from(document.querySelectorAll<HTMLElement>(
    `mark.${HIGHLIGHT_CLASS}[data-annotation-id="${annotationId}"]`,
  ));
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    const text = document.createTextNode(mark.textContent ?? '');
    parent.replaceChild(text, mark);
    // Normalize adjacent text nodes
    if (parent.nodeType === Node.ELEMENT_NODE) {
      (parent as Element).normalize();
    }
  }
}

export function removeAllHighlights(): void {
  const marks = Array.from(document.querySelectorAll<HTMLElement>(`mark.${HIGHLIGHT_CLASS}`));
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark);
  }
  document.body.normalize();
}

export function pulseHighlight(annotationId: string): void {
  const mark = document.querySelector<HTMLElement>(
    `mark.${HIGHLIGHT_CLASS}[data-annotation-id="${annotationId}"]`,
  );
  if (!mark) return;
  mark.classList.remove('bn-pulse');
  void mark.offsetWidth; // reflow to restart animation
  mark.classList.add('bn-pulse');
  mark.addEventListener('animationend', () => mark.classList.remove('bn-pulse'), { once: true });
}

export function getMarkElement(annotationId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `mark.${HIGHLIGHT_CLASS}[data-annotation-id="${annotationId}"]`,
  );
}
