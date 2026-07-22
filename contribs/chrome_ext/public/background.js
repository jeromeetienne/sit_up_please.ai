const monitorPageUrl = chrome.runtime.getURL('monitor.html');

/**
 * Brings the dedicated monitor window forward, or creates it if it is not
 * already open. The monitor is intentionally a separate window rather than a
 * browser tab so changing normal tabs does not hide the camera page.
 */
async function openMonitorWindow() {
  const windows = await chrome.windows.getAll({ populate: true });
  const existingWindow = windows.find((window) =>
    window.tabs?.some((tab) => tab.url === monitorPageUrl),
  );

  if (existingWindow?.id !== undefined) {
    await chrome.windows.update(existingWindow.id, { focused: true });
    return;
  }

  await chrome.windows.create({
    url: monitorPageUrl,
    type: 'popup',
    width: 1120,
    height: 900,
  });
}

chrome.action.onClicked.addListener(() => {
  void openMonitorWindow();
});
