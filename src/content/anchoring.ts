import type { AnchorData } from '../types';


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
  const blockXPath = nearestBlockXPath(startNode);

  return { selectedText, blockXPath };
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

  // Find the text nodes that span this range (using normalized offsets)
  return buildRange(normNodes, idx, anchor.selectedText.length);
}

function buildRange(
  nodes: Array<{ node: Text; start: number; normLength: number }>,
  start: number,
  length: number,
): Range {
  const end = start + length;
  const range = document.createRange();
  let startSet = false;

  for (const entry of nodes) {
    const { node, start: nodeStart, normLength: nodeLen } = entry;
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
  if (idx !== -1) {
    return buildRange(nodes, idx, anchor.selectedText.length);
  }

  return null;
}

