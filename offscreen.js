// نظام الدرع الواقي (Keep-Alive) لمنع إغلاق الإضافة أثناء الرفع الطويل
const NHP_OFFSCREEN_PORTS = Object.freeze({
    heartbeat: 'nhp-emailcore-lite-heartbeat-v1'
});

chrome.runtime.onConnect.addListener((port) => {
    if (port.name === NHP_OFFSCREEN_PORTS.heartbeat) {
        port.onMessage.addListener((msg) => {
            try {
                if (msg?.action === 'ping') {
                    port.postMessage({ pong: true, service: 'nhp-emailcore-lite-offscreen', ts: Date.now() });
                }
            } catch (error) {
                console.warn('[Offscreen] heartbeat recovered:', error?.message || error);
            }
        });
    }
});

// الاستماع للرسائل القادمة من الإضافة
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        if (!message || typeof message !== 'object' || message.target !== 'offscreen') return false;
    } catch (error) {
        console.warn('[Offscreen] invalid message recovered:', error?.message || error);
        return false;
    }

    if (message.action === 'EMAILCORE_COPY_TEXT') {
        const text = String(message.text || '');
        navigator.clipboard.writeText(text)
            .then(() => sendResponse({ success: true }))
            .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;
    }
    if (message.type === 'PROCESS_IMAGE') {
        processImage(message.data)
            .then(res => sendResponse({ success: true, result: res }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }

    // MerchGhost Actions
    if (message.action === 'ping') {
        sendResponse({ success: true, pong: true });
        return true;
    }

    if (['fetch-and-extract-sales', 'fetch-and-extract-works-summary', 'fetch-and-extract-manage-works', 'fetchHTML', 'extractPricing', 'fetch-and-extract-tier', 'play-sound'].includes(message.action)) {
        handleMerchGhostMessage(message.action, message.data)
            .then(result => {
                if (result && typeof result === 'object' && 'data' in result && 'artistMetrics' in result) {
                    sendResponse({ success: true, data: result.data, artistMetrics: result.artistMetrics });
                } else {
                    sendResponse({ success: true, data: result });
                }
            })
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
});

async function handleMerchGhostMessage(action, data) {
    switch (action) {
        case 'fetch-and-extract-sales': return await fetchAndExtractSales(data.url);
        case 'fetch-and-extract-works-summary': return await fetchAndExtractWorksSummary(data.url);
        case 'fetch-and-extract-manage-works': return await fetchAndExtractManageWorks(data.url);
        case 'fetchHTML': return await fetchHTML(data.url);
        case 'extractPricing': return await fetchAndExtractPricing(data.url);
        case 'fetch-and-extract-tier': return await fetchAndExtractTier(data.url);
        case 'play-sound': playSound(data.soundUrl); return { success: true };
        default: throw new Error(`Unknown action: ${action}`);
    }
}

// --- MerchGhost Specialized Extraction Functions ---
// (Copying from MerchGhost offscreen.js)

async function fetchAndExtractSales(url) {
    const response = await fetch(url, { credentials: 'include', headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return extractSalesFromDOM(doc);
}

function extractSalesFromDOM(doc) {
    const sales = [];
    const table = doc.querySelector('.sales-table table, table.payments');
    if (!table) return sales;
    const rows = table.querySelectorAll('tbody tr, tr:not(.total)');
    rows.forEach(row => {
        if (row.classList.contains('total')) return;
        const cells = row.querySelectorAll('td');
        if (cells.length < 10) return;
        try {
            const orderDateText = cells[0]?.textContent?.trim() || '';
            const orderDate = parseMerchDate(orderDateText);
            const workLink = cells[2]?.querySelector('a');
            const workTitle = workLink?.textContent?.trim() || '';
            const editUrl = workLink?.href || '';
            const workId = extractMerchWorkId(editUrl);
            const orderNumber = cells[3]?.textContent?.trim() || '';
            const product = cells[4]?.textContent?.trim() || '';
            const status = cells[8]?.textContent?.trim() || '';
            const qty = parseInt(cells[9]?.textContent?.trim() || '0', 10);
            const retailPrice = parseMerchCurrency(cells[10]?.textContent?.trim() || '');
            const artistMargin = parseMerchCurrency(cells[11]?.textContent?.trim() || '');
            const saleId = `${orderNumber}_${workId}_${product}_${orderDate}_${qty}_${artistMargin.toFixed(2)}`;
            sales.push({ saleId, orderNumber, orderDate, workId, workTitle, editUrl, product, quantity: qty, retailPrice, artistMargin, status, timestamp: new Date().toISOString() });
        } catch (e) { }
    });
    return sales;
}

async function fetchAndExtractWorksSummary(url) {
    const response = await fetch(url, { credentials: 'include' });
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const works = [];
    const table = doc.querySelector('table.payments.summary, table.summary');
    if (!table) return works;
    table.querySelectorAll('tbody tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 4) return;
        const workLink = cells[0]?.querySelector('a');
        works.push({ workId: extractMerchWorkId(workLink?.href || ''), workTitle: workLink?.textContent?.trim() || '', totalQuantity: parseInt(cells[1]?.textContent || '0'), totalMargin: parseMerchCurrency(cells[2]?.textContent || '') });
    });
    return works;
}

async function fetchAndExtractManageWorks(url) {
    const response = await fetch(url, { credentials: 'include' });
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const works = extractMerchManageWorksFromDOM(doc);
    let artistMetrics = (url.includes('page=1') || !url.includes('page=')) ? extractMerchArtistMetrics(doc) : null;
    return artistMetrics ? { data: works, artistMetrics } : works;
}

function extractMerchManageWorksFromDOM(doc) {
    const works = [];
    doc.querySelectorAll('script').forEach(script => {
        const text = script.textContent || '';
        const matches = text.match(/ManageWorksView\.works\.push\(new WorkView\(ManageWorksView, \{[\s\S]+?\}\)\)/g);
        if (matches) {
            matches.forEach(match => {
                const idM = match.match(/id:\s*(\d+)/);
                const titleM = match.match(/title:\s*"([^"]+)"/);
                const urlM = match.match(/url:\s*'([^']+)'/);
                const thumbM = match.match(/workBlock[\s\S]+?src="(https?:\/\/ih\d+\.redbubble\.net\/image\.\d+\.\d+\/[^"]+)"/);
                if (idM) {
                    works.push({ workId: idM[1], title: titleM ? titleM[1] : '', url: urlM ? urlM[1] : '', thumbnailUrl: thumbM ? thumbM[1] : '', lastUpdated: new Date().toISOString() });
                }
            });
        }
    });
    return works;
}

function extractMerchArtistMetrics(doc) {
    const fM = (doc.querySelector('.artist-followers-metric')?.textContent || '').match(/(\d+)/);
    const vM = (doc.querySelector('.artist-favorites-metric')?.textContent || '').match(/(\d+)/);
    return { followers: fM ? parseInt(fM[1]) : 0, favorites: vM ? parseInt(vM[1]) : 0 };
}

function parseMerchDate(t) {
    const p = t.trim().split(' ');
    if (p.length === 3) {
        const months = { 'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12' };
        return `20${p[2]}-${months[p[1]] || '01'}-${p[0].padStart(2, '0')}`;
    }
    return new Date().toISOString().split('T')[0];
}

function extractMerchWorkId(url) {
    const m = url.match(/\/shop\/ap\/(\d+)/) || url.match(/\/portfolio\/images\/(\d+)-/);
    return m ? m[1] : '';
}

function parseMerchCurrency(t) {
    const m = t.match(/[\d.]+/);
    return m ? parseFloat(m[0]) : 0;
}

async function fetchHTML(url) {
    const r = await fetch(url, { credentials: 'include' });
    return await r.text();
}

async function fetchAndExtractPricing(url) {
    const r = await fetch(url, { credentials: 'include' });
    const html = await r.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const pricing = [];
    doc.querySelectorAll('input.markup-percentage[data-product]').forEach(input => {
        pricing.push({ productName: input.getAttribute('data-product'), markup: parseFloat(input.value) || 0 });
    });
    return pricing;
}

async function fetchAndExtractTier(url) {
    const r = await fetch(url, { credentials: 'include' });
    const html = await r.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const callout = doc.querySelector('.artist-account-tiers-callout')?.textContent || '';
    if (callout.match(/Standard/i)) return 'Standard';
    if (callout.match(/Premium/i)) return 'Premium';
    if (callout.match(/Pro/i)) return 'Pro';
    return 'Unknown';
}

function playSound(url) {
    try { new Audio(url).play(); } catch (e) { }
}

async function processImage({ imageUrl, targetWidth, targetHeight, dpi, fileName }) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";

        img.onload = () => {
            const canvas = document.getElementById('upscaleCanvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

            canvas.toBlob((blob) => {
                if (!blob) return reject(new Error('فشل تحويل الصورة إلى Blob'));

                const reader = new FileReader();
                reader.onload = function (e) {
                    const newBuffer = changeDpi(e.target.result, dpi || 300);
                    const finalBlob = new Blob([newBuffer], { type: 'image/png' });

                    const name = fileName || `TeePublic_Design_${Date.now()}.png`;
                    finalizeAndDownload(finalBlob, name);
                    resolve("started_downloading");
                };
                reader.onerror = () => reject(new Error('فشل قراءة الملف أثناء معالجة DPI'));
                reader.readAsArrayBuffer(blob);
            }, 'image/png');
        };
        img.onerror = () => reject(new Error('فشل تحميل الصورة الأولية'));
        img.src = imageUrl;
    });
}

function finalizeAndDownload(blob, fileName) {
    const reader = new FileReader();
    reader.onloadend = function () {
        const base64data = reader.result;

        // استخدام API التحميل الخاص بكروم لبدء "التحميل الصامت"
        // في حال تم حجب chrome.downloads داخل الـ offscreen بـ Manifest V3،
        // يتم استخدام الـ background.js ليقوم هو بالتحميل لأنه المنفذ الشرعي المسموح له.
        if (chrome.downloads && chrome.downloads.download) {
            chrome.downloads.download({
                url: base64data,
                filename: fileName,
                saveAs: false // تحميل مباشر دون إزعاج المستخدم
            }, (downloadId) => {
                chrome.runtime.sendMessage({ type: 'IMAGE_PROCESS_COMPLETE' });
            });
        } else {
            // بديل آمن يرسل الصورة للـ Background الذي يمتلك صلاحية Downloads أكيدة، ثم يغلق الـ Offscreen
            chrome.runtime.sendMessage({
                type: 'DOWNLOAD_IMAGE',
                dataUrl: base64data,
                filename: fileName
            }, () => {
                chrome.runtime.sendMessage({ type: 'IMAGE_PROCESS_COMPLETE' });
            });
        }
    };
    reader.readAsDataURL(blob);
}

// دالة متقدمة لحقن الـ DPI (300) داخل بيانات الـ PNG
function changeDpi(arrayBuffer, dpi) {
    const uint8Array = new Uint8Array(arrayBuffer);
    const dpm = Math.round(dpi * 39.3701);
    const physChunk = new Uint8Array(21);

    physChunk[0] = 0; physChunk[1] = 0; physChunk[2] = 0; physChunk[3] = 9;
    physChunk[4] = 112; physChunk[5] = 72; physChunk[6] = 89; physChunk[7] = 115;

    physChunk[8] = (dpm >>> 24) & 0xFF; physChunk[9] = (dpm >>> 16) & 0xFF; physChunk[10] = (dpm >>> 8) & 0xFF; physChunk[11] = dpm & 0xFF;
    physChunk[12] = (dpm >>> 24) & 0xFF; physChunk[13] = (dpm >>> 16) & 0xFF; physChunk[14] = (dpm >>> 8) & 0xFF; physChunk[15] = dpm & 0xFF;
    physChunk[16] = 1;

    const crc = crc32(physChunk.slice(4, 17));
    physChunk[17] = (crc >>> 24) & 0xFF; physChunk[18] = (crc >>> 16) & 0xFF; physChunk[19] = (crc >>> 8) & 0xFF; physChunk[20] = crc & 0xFF;

    let offset = 8;
    const dataLen = (uint8Array[offset] << 24) | (uint8Array[offset + 1] << 16) | (uint8Array[offset + 2] << 8) | uint8Array[offset + 3];
    offset += 12 + dataLen;

    const finalArray = new Uint8Array(uint8Array.length + physChunk.length);
    finalArray.set(uint8Array.slice(0, offset), 0);
    finalArray.set(physChunk, offset);
    finalArray.set(uint8Array.slice(offset), offset + physChunk.length);

    return finalArray.buffer;
}

function crc32(buf) {
    let c;
    const crcTable = [];
    for (let n = 0; n < 256; n++) {
        c = n;
        for (let k = 0; k < 8; k++) {
            c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        crcTable[n] = c;
    }
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
}
