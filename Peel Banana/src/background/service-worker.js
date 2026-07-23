/**
 * Background Service Worker
 * Handles downloads from popup.
 */

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DOWNLOAD_IMAGE') {
    downloadImage(message.dataUrl, message.filename)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});

/**
 * Download an image using chrome.downloads API
 * @param {string} dataUrl - Image data URL
 * @param {string} filename - Target filename
 */
async function downloadImage(dataUrl, filename) {
  return chrome.downloads.download({
    url: dataUrl,
    filename: filename,
    saveAs: false
  });
}
