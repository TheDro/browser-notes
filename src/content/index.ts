import type { Annotation, Message } from '../types';
import { getAnnotations, saveAnnotation, updateAnnotation, deleteAnnotation } from '../storage';
import { matchesUrl, deriveUrlKey } from '../url-utils';
import { captureAnchor, findAnchor } from './anchoring';
import { applyHighlight, removeHighlight, removeAllHighlights, pulseHighlight, getMarkElement } from './highlight';
import { showCreate, showView } from './popover';

// In-memory map of annotation id → annotation (for currently active page)
let activeAnnotations: Map<string, Annotation> = new Map();
let lastKnownHref = location.href;

async function loadAnnotationsForPage(): Promise<void> {
  const all = await getAnnotations();
  const matching = all.filter((a) => matchesUrl(a, location.href));

  activeAnnotations = new Map();
  for (const annotation of matching) {
    const range = findAnchor(annotation.anchor);
    const withStatus: Annotation = { ...annotation, anchorFailed: range === null };
    activeAnnotations.set(annotation.id, withStatus);
    if (range) {
      applyHighlight(range, withStatus);
    }
  }
}

function handleTriggerAnnotation(): void {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

  const text = selection.toString().trim();
  if (!text) return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // Capture anchor data and clear selection reference before showing popover
  const anchorData = captureAnchor(selection);

  showCreate(rect, (noteText, scope, color) => {
    const annotation: Annotation = {
      id: crypto.randomUUID(),
      noteText,
      color,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      scope,
      urlKey: deriveUrlKey(location.href, scope),
      anchor: anchorData,
    };

    // Re-create the range from the stored anchor since selection may have cleared
    const anchoredRange = findAnchor(anchorData);
    if (anchoredRange) {
      applyHighlight(anchoredRange, annotation);
    } else {
      annotation.anchorFailed = true;
    }

    activeAnnotations.set(annotation.id, annotation);
    saveAnnotation(annotation);
  });
}

function handleHighlightClick(annotationId: string, markEl: HTMLElement): void {
  const annotation = activeAnnotations.get(annotationId);
  if (!annotation) return;

  const rect = markEl.getBoundingClientRect();

  showView(
    annotation,
    rect,
    (noteText) => {
      const updated: Annotation = { ...annotation, noteText, updatedAt: Date.now() };
      activeAnnotations.set(annotation.id, updated);
      updateAnnotation(updated);
    },
    () => {
      activeAnnotations.delete(annotation.id);
      removeHighlight(annotation.id);
      deleteAnnotation(annotation.id);
    },
  );
}

// Delegated click listener for highlights
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const mark = target.closest('mark.bn-highlight') as HTMLElement | null;
  if (!mark) return;
  const id = mark.dataset.annotationId;
  if (!id) return;
  e.preventDefault();
  e.stopPropagation();
  handleHighlightClick(id, mark);
});

// Message listener
chrome.runtime.onMessage.addListener((rawMessage: unknown) => {
  const message = rawMessage as Message;
  if (message.type === 'TRIGGER_ANNOTATION') {
    handleTriggerAnnotation();
  } else if (message.type === 'JUMP_TO_ANNOTATION') {
    const mark = getMarkElement(message.id);
    if (mark) {
      mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      pulseHighlight(message.id);
    }
  }
});

// SPA support: MutationObserver + URL change detection
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const observer = new MutationObserver(() => {
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const currentHref = location.href;
    if (currentHref !== lastKnownHref) {
      lastKnownHref = currentHref;
      removeAllHighlights();
      activeAnnotations.clear();
      await loadAnnotationsForPage();
    } else {
      // Same URL: retry any previously failed annotations
      for (const [id, annotation] of activeAnnotations) {
        if (!annotation.anchorFailed) continue;
        const range = findAnchor(annotation.anchor);
        if (range) {
          const updated = { ...annotation, anchorFailed: false };
          activeAnnotations.set(id, updated);
          applyHighlight(range, updated);
        }
      }
      // Repair detached marks
      for (const [id, annotation] of activeAnnotations) {
        if (annotation.anchorFailed) continue;
        const mark = getMarkElement(id);
        if (mark && !document.body.contains(mark)) {
          const range = findAnchor(annotation.anchor);
          if (range) {
            applyHighlight(range, annotation);
          } else {
            activeAnnotations.set(id, { ...annotation, anchorFailed: true });
          }
        }
      }
    }
  }, 500);
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial load
loadAnnotationsForPage();
