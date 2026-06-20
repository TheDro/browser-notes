import type { Message } from '../types';
import { getAnnotations } from '../storage';
import { matchesUrl } from '../url-utils';
import { renderNoteList } from './NoteList';

async function init(): Promise<void> {
  const app = document.getElementById('app')!;

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  const url = tab?.url ?? '';

  const all = await getAnnotations();
  const annotations = all.filter((a) => matchesUrl(a, url));

  const header = document.createElement('header');
  const title = document.createElement('h1');
  title.textContent = 'browser-notes';
  header.appendChild(title);
  app.appendChild(header);

  const content = document.createElement('div');
  content.id = 'content';
  app.appendChild(content);

  renderNoteList(content, annotations, async (id) => {
    if (!tab?.id) return;
    const message: Message = { type: 'JUMP_TO_ANNOTATION', id };
    await chrome.tabs.sendMessage(tab.id, message);
    window.close();
  });
}

init();
