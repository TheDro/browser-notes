import type { AnchorData } from '../types';

function getTextContext(node: Text, offset: number, direction: 'before' | 'after', maxLen = 50): string {
  let result = '';
  let current: Node | null = node;
  let startOffset = direction === 'before' ? offset : offset;

  if (direction === 'before') {
    result = node.textContent?.slice(0, startOffset) ?? '';
    current = node;
    while (result.length < maxLen) {
      const prev = prevTextNode(current);
      if (!prev) break;
      result = (prev.textContent ?? '') + result;
      current = prev;
    }
    return result.slice(-maxLen);
  } else {
    result = node.textContent?.slice(startOffset) ?? '';
    current = node;
    while (result.length < maxLen) {
      const next = nextTextNode(current);
      if (!next) break;
      result += next.textContent ?? '';
      current = next;
    }
    return result.slice(0, maxLen);
  }
}

function prevTextNode(node: Node): Text | null {
  let current: Node | null = node;
  while (current) {
    if (current.previousSibling) {
      current = current.previousSibling;
      while (current.lastChild) current = current.lastChild;
      if (current.nodeType === Node.TEXT_NODE) return current as Text;
    } else {
      current = current.parentNode;
      if (!current || current === document.body) return null;
    }
  }
  return null;
}

function nextTextNode(node: Node): Text | null {
  let current: Node | null = node;
  while (current) {
    if (current.firstChild) {
      current = current.firstChild;
    } else if (current.nextSibling) {
      current = current.nextSibling;
    } else {
      while (current.parentNode && !current.parentNode.nextSibling) {
        current = current.parentNode;
        if (current === document.body) return null;
      }
      if (!current.parentNode) return null;
      current = current.parentNode.nextSibling;
    }
    if (current && current.nodeType === Node.TEXT_NODE) return current as Text;
  }
  return null;
}

const BLOCK_TAGS = new Set([
  'P','DIV','ARTICLE','SECTION','LI','BLOCKQUOTE','TD','TH','MAIN',
  'HEADER','FOOTER','NAV','ASIDE','FIGURE','FIGCAPTION','H1','H2','H3',
  'H4','H5','H6','PRE','ADDRESS',
]);

function nearestBlockXPath(node: Node): string {
  let current: Node | null = node;
  while (current && current !== document.body) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as Element;
      if (BLOCK_TAGS.has(el.tagName)) {
        return getXPath(el);
      }
    }
    current = current.parentNode;
  }
  return getXPath(document.body);
}

function getXPath(el: Element): string {
  if (el === document.body) return '/html/body';
  const parts: string[] = [];
  let current: Element | null = el;
  while (current && current !== document.body) {
    const tag = current.tagName.toLowerCase();
    const parent: Element | null = current.parentElement;
    let index = 1;
    if (parent) {
      for (const sibling of Array.from(parent.children) as Element[]) {
        if (sibling === current) break;
        if (sibling.tagName === current.tagName) index++;
      }
    }
    parts.unshift(`${tag}[${index}]`);
    current = parent;
  }
  return '/html/body/' + parts.join('/');
}

export function captureAnchor(selection: Selection): AnchorData {
  const range = selection.getRangeAt(0);
  const selectedText = selection.toString().replace(/\s+/g, ' ').trim();
  const startNode = range.startContainer as Text;
  const endNode = range.endContainer as Text;

  const prefixContext = getTextContext(startNode, range.startOffset, 'before');
  const suffixContext = getTextContext(endNode, range.endOffset, 'after');
  const blockXPath = nearestBlockXPath(startNode);

  return { selectedText, prefixContext, suffixContext, blockXPath };
}

function levenshteinSimilarity(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  const maxLen = longer.length;
  if (maxLen === 0) return 1;

  const dist = levenshtein(longer, shorter);
  return (maxLen - dist) / maxLen;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

function contextMatches(text: string, prefixContext: string, suffixContext: string, index: number, len: number): boolean {
  const actualPrefix = text.slice(Math.max(0, index - 50), index);
  const actualSuffix = text.slice(index + len, index + len + 50);
  const prefixSim = levenshteinSimilarity(actualPrefix, prefixContext.slice(-actualPrefix.length || undefined));
  const suffixSim = levenshteinSimilarity(actualSuffix, suffixContext.slice(0, actualSuffix.length || undefined));
  return prefixSim >= 0.8 || suffixSim >= 0.8;
}

function rangeFromTextNode(textNode: Text, offset: number, length: number): Range {
  const range = document.createRange();
  // The text might span multiple text nodes; for simplicity anchor to the single node
  const endOffset = Math.min(offset + length, textNode.length);
  range.setStart(textNode, offset);
  range.setEnd(textNode, endOffset);
  return range;
}

function searchInElement(el: Element, anchor: AnchorData): Range | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node: Text | null;
  let rawText = '';
  const nodes: Array<{ node: Text; start: number }> = [];

  while ((node = walker.nextNode() as Text | null)) {
    if (rawText.length > 0) rawText += ' ';
    nodes.push({ node, start: rawText.length });
    rawText += node.textContent ?? '';
  }

  const fullText = rawText.replace(/\s+/g, ' ').trim();
  // Rebuild node start offsets against the normalized fullText
  let normOffset = 0;
  const normNodes: Array<{ node: Text; start: number; normLength: number }> = [];
  for (const entry of nodes) {
    const normLength = (entry.node.textContent ?? '').replace(/\s+/g, ' ').length;
    normNodes.push({ node: entry.node, start: normOffset, normLength });
    normOffset += normLength + 1; // +1 for the separator space
  }

  const idx = fullText.indexOf(anchor.selectedText);
  if (idx === -1) return null;

  if (!contextMatches(fullText, anchor.prefixContext, anchor.suffixContext, idx, anchor.selectedText.length)) {
    return null;
  }

  // Find the text nodes that span this range (using normalized offsets)
  return buildRange(normNodes, idx, anchor.selectedText.length);
}

function buildRange(
  nodes: Array<{ node: Text; start: number; normLength?: number }>,
  start: number,
  length: number,
): Range {
  const end = start + length;
  const range = document.createRange();
  let startSet = false;

  for (const entry of nodes) {
    const { node, start: nodeStart } = entry;
    // Use normalized length if provided (for whitespace-normalized searches),
    // otherwise fall back to raw text length.
    const nodeLen = entry.normLength ?? (node.textContent?.length ?? 0);
    const nodeEnd = nodeStart + nodeLen;
    if (!startSet && nodeEnd > start) {
      // Map normalized offset back to raw offset within this node
      range.setStart(node, start - nodeStart);
      startSet = true;
    }
    if (startSet && nodeEnd >= end) {
      range.setEnd(node, end - nodeStart);
      break;
    }
  }
  return range;
}

export function findAnchor(anchor: AnchorData): Range | null {
  // Step 1: Try block XPath hint
  try {
    const result = document.evaluate(
      anchor.blockXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null,
    );
    const el = result.singleNodeValue as Element | null;
    if (el) {
      const range = searchInElement(el, anchor);
      if (range) return range;
    }
  } catch {
    // XPath failed, continue
  }

  // Step 2: Full document search with context validation
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Text | null;
  let rawText = '';
  const rawNodes: Array<{ node: Text; start: number }> = [];

  while ((node = walker.nextNode() as Text | null)) {
    if (rawText.length > 0) rawText += ' ';
    rawNodes.push({ node, start: rawText.length });
    rawText += node.textContent ?? '';
  }

  // Normalize whitespace to match how selectedText was captured
  const fullText = rawText.replace(/\s+/g, ' ').trim();
  let normOffset = 0;
  const nodes: Array<{ node: Text; start: number; normLength: number }> = [];
  for (const entry of rawNodes) {
    const normLength = (entry.node.textContent ?? '').replace(/\s+/g, ' ').length;
    nodes.push({ node: entry.node, start: normOffset, normLength });
    normOffset += normLength + 1; // +1 for the separator space
  }

  const idx = fullText.indexOf(anchor.selectedText);
  if (idx !== -1 && contextMatches(fullText, anchor.prefixContext, anchor.suffixContext, idx, anchor.selectedText.length)) {
    return buildRange(nodes, idx, anchor.selectedText.length);
  }

  // Step 3: Partial match on first 20 chars
  const partial = anchor.selectedText.slice(0, 20);
  if (partial.length >= 5) {
    const partialIdx = fullText.indexOf(partial);
    if (partialIdx !== -1) {
      const actualPrefix = fullText.slice(Math.max(0, partialIdx - 50), partialIdx);
      const actualSuffix = fullText.slice(partialIdx + partial.length, partialIdx + partial.length + 50);
      const prefixMatch = levenshteinSimilarity(actualPrefix, anchor.prefixContext.slice(-actualPrefix.length || undefined)) >= 0.8;
      const suffixMatch = levenshteinSimilarity(actualSuffix, anchor.suffixContext.slice(0, actualSuffix.length || undefined)) >= 0.8;
      if (prefixMatch || suffixMatch) {
        return buildRange(nodes, partialIdx, partial.length);
      }
    }
  }

  return null;
}

export function rangeFromSingleNode(node: Text, startOffset: number, endOffset: number): Range {
  return rangeFromTextNode(node, startOffset, endOffset - startOffset);
}
