import type { AnchorData } from '../types';

const ANCESTOR_DEPTH = 3;

function captureAncestorTags(node: Node): string[] {
  const tags: string[] = [];
  let current: Node | null = node.parentElement;
  while (current && current !== document.body && tags.length < ANCESTOR_DEPTH) {
    tags.push((current as Element).tagName.toLowerCase());
    current = current.parentElement;
  }
  return tags;
}

function scoreAncestors(node: Node, ancestorTags: string[]): number {
  const actual = captureAncestorTags(node);
  let score = 0;
  for (let i = 0; i < Math.min(actual.length, ancestorTags.length); i++) {
    if (actual[i] === ancestorTags[i]) score++;
    else break;
  }
  return score;
}

export function captureAnchor(selection: Selection): AnchorData {
  const range = selection.getRangeAt(0);
  const selectedText = selection.toString().replace(/\s+/g, ' ').trim();
  const startNode = range.startContainer;
  const ancestorTags = captureAncestorTags(startNode);

  return { selectedText, ancestorTags };
}

function buildRange(
  nodes: Array<{ node: Text; nodeStart: number; normLength: number }>,
  start: number,
  length: number,
): Range {
  const end = start + length;
  const range = document.createRange();
  let startSet = false;

  for (const entry of nodes) {
    const { node, nodeStart, normLength } = entry;
    const nodeEnd = nodeStart + normLength;
    if (!startSet && nodeEnd > start) {
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
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Text | null;
  let fullText = '';
  const nodes: Array<{ node: Text; nodeStart: number; normLength: number }> = [];

  while ((node = walker.nextNode() as Text | null)) {
    // Normalize whitespace runs within this node's text
    const norm = (node.textContent ?? '').replace(/\s+/g, ' ');
    // Strip leading space if fullText already ends with one (or is empty), trailing space always stripped
    const chunk = (fullText.length === 0 || fullText.endsWith(' ') ? norm.trimStart() : norm).trimEnd();
    if (chunk.length === 0) continue;
    // Add a separator space between nodes when needed
    if (fullText.length > 0 && !fullText.endsWith(' ')) fullText += ' ';
    const nodeStart = fullText.length;
    fullText += chunk;
    nodes.push({ node, nodeStart, normLength: chunk.length });
  }

  // Collect all occurrences of selectedText, score each by ancestor tag match
  const { selectedText, ancestorTags = [] } = anchor;
  let bestIdx = -1;
  let bestScore = -1;

  let searchFrom = 0;
  while (true) {
    const idx = fullText.indexOf(selectedText, searchFrom);
    if (idx === -1) break;

    // Find which text node contains this offset to score its ancestors
    const matchNode = nodes.find(n => idx >= n.nodeStart && idx < n.nodeStart + n.normLength);
    const score = matchNode ? scoreAncestors(matchNode.node, ancestorTags) : 0;

    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }

    searchFrom = idx + 1;
  }

  if (bestIdx === -1) return null;
  return buildRange(nodes, bestIdx, selectedText.length);
}
