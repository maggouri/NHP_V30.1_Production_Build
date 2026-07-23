(function () {
  const TAB_URL = chrome.runtime.getURL('popup.html?mode=tab');

  function openExpandedTab() {
    return chrome.tabs.create({ url: TAB_URL, active: true });
  }

  function openAppWindow() {
    return chrome.windows.create({
      url: TAB_URL,
      type: 'popup',
      width: 1280,
      height: 850,
      focused: true
    });
  }

  function openSmallPopup() {
    location.replace(chrome.runtime.getURL('popup.html'));
  }

  chrome.storage.local.get(['uiLaunchMode', 'nhpExplicitPopupLaunchV301'], function (res) {
    const mode = res.uiLaunchMode || 'tab';
    const useSmallPopup = mode === 'popup' && res.nhpExplicitPopupLaunchV301 === true;

    const done = function () {
      try { window.close(); } catch (_) { /* popup may already be closed */ }
    };

    if (useSmallPopup) {
      openSmallPopup();
      return;
    }

    const launch = mode === 'window' ? openAppWindow() : openExpandedTab();
    Promise.resolve(launch).then(done).catch(function () {
      openExpandedTab().then(done).catch(done);
    });
  });
})();
