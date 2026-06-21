export type Scope = 'domain' | 'exact';

export interface AnchorData {
  selectedText: string;
  ancestorTags: string[];
}

export interface Annotation {
  id: string;
  noteText: string;
  color: string;
  createdAt: number;
  updatedAt: number;
  scope: Scope;
  urlKey: string;
  anchor: AnchorData;
  anchorFailed?: boolean;
}

export type Message =
  | { type: 'TRIGGER_ANNOTATION' }
  | { type: 'JUMP_TO_ANNOTATION'; id: string }
  | { type: 'CLEAR_PAGE' }
  | { type: 'RETRY_HIGHLIGHTS' };
