(function () {
  var params = new URLSearchParams(location.search);
  if (params.get('mode') === 'tab') {
    document.documentElement.classList.add('nhp-tab-mode');
    return;
  }
  document.documentElement.classList.add('nhp-popup-mode');
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
  chrome.storage.local.get(['uiLaunchMode', 'nhpExplicitPopupLaunchV301'], function (res) {
    var launch = res.uiLaunchMode || 'tab';
    if (launch === 'popup' && res.nhpExplicitPopupLaunchV301) return;
    params.set('mode', 'tab');
    location.replace(chrome.runtime.getURL('popup.html?' + params.toString()));
  });
})();
