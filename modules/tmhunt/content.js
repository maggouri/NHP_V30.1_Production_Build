// content.js - Reliable Search Automation
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'PERFORM_SEARCH') {
    (async () => {
      try {
        const results = await automateSearch(request.niches);
        sendResponse(results);
      } catch (e) {
        sendResponse({ error: e.message });
      }
    })();
    return true; // async response
  }
});

async function automateSearch(niches) {
  // 1. Switch Tab if needed
  const tabBtn = document.querySelector('a[href="#ngrams"]') || document.querySelector('a[data-toggle="tab"][href="#ngrams"]');
  if (tabBtn) tabBtn.click();
  await new Promise(r => setTimeout(r, 800));

  // 2. Fill Textarea
  const ta = document.querySelector('textarea.n-gram');
  if (!ta) throw new Error("Could not find textarea.n-gram");
  
  ta.value = niches.join('\n');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  ta.dispatchEvent(new Event('change', { bubbles: true }));

  // 3. Click Search
  const btn = document.querySelector('.search-ngram.searchBtn');
  if (!btn) throw new Error("Could not find search button");
  
  btn.removeAttribute('disabled');
  btn.click();

  // 4. Wait for results
  await waitForResults();

  // 5. Scrape
  const rows = document.querySelectorAll('table#table tbody tr');
  const foundSet = new Set();
  
  rows.forEach(r => {
    const trademark = r.cells[1]?.innerText?.toLowerCase().trim();
    if (trademark) foundSet.add(trademark);
  });

  const safe = [];
  const restricted = [];

  niches.forEach(n => {
    const ln = n.toLowerCase().trim();
    let isFound = false;
    for (let f of foundSet) {
      if (f.includes(ln) || ln.includes(f)) {
        isFound = true;
        break;
      }
    }
    if (isFound) restricted.push(n);
    else safe.push(n);
  });

  return { safe, restricted };
}

async function waitForResults() {
  return new Promise((resolve) => {
    let checkCount = 0;
    const interval = setInterval(() => {
      checkCount++;
      const processing = document.querySelector('#table_processing');
      const isProcessing = processing && processing.style.display !== 'none';
      const hasRows = document.querySelectorAll('table#table tbody tr').length > 0;
      const empty = document.querySelector('.dataTables_empty');

      if (!isProcessing && (hasRows || empty || checkCount > 50)) {
        clearInterval(interval);
        setTimeout(resolve, 800);
      }
    }, 300);
  });
}
