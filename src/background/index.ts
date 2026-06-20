chrome.commands.onCommand.addListener((command) => {
  if (command !== 'annotate' && command !== 'clear-page') return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab?.id == null) return;
    const message = command === 'annotate'
      ? { type: 'TRIGGER_ANNOTATION' }
      : { type: 'CLEAR_PAGE' };
    chrome.tabs.sendMessage(tab.id, message).catch(() => {
      // Content script not present on this page (e.g. chrome:// or new tab).
    });
  });
});
