chrome.commands.onCommand.addListener((command) => {
  if (command !== 'annotate') return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab?.id == null) return;
    chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_ANNOTATION' });
  });
});
