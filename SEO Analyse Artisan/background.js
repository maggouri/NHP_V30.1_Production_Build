chrome.runtime.onInstalled.addListener(() => {
    console.log("SEO Analyse Artisan extension installed successfully.");
    // Schedule the daily hunt
    chrome.alarms.create('dailyTrendHunter', { periodInMinutes: 1440 });
});

async function fetchAllTrendsBackground() {
    let allTrends = [];
    try {
        // 1. Google Autocomplete (Search Trends)
        const seeds = ["t-shirt design for ", "funny shirt about ", "t-shirt idea for "];
        for (let seed of seeds) {
            const res = await fetch(`http://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(seed)}`);
            const data = await res.json();
            if (data[1]) {
                data[1].forEach(term => {
                    if (term.length > 5) {
                        allTrends.push({
                            title: term.replace(seed.trim(), '').trim(),
                            source: 'Google',
                            image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/120px-Google_%22G%22_logo.svg.png'
                        });
                    }
                });
            }
        }

        // 2. TeePublic Scrape (Live Market Popular Designs)
        for (let p = 1; p <= 4; p++) {
            const tpRes = await fetch(`https://www.teepublic.com/t-shirts?sort=popular&page=${p}`);
            const html = await tpRes.text();
            const regex = /<img[^>]+src="([^"]+)"[^>]+alt="([^"]+)"/gi;
            let match;
            while ((match = regex.exec(html)) !== null) {
                let src = match[1];
                let alt = match[2].replace(/ T-Shirt/gi, '').replace(/ Design/gi, '').trim();
                if ((src.includes('res.cloudinary') || src.includes('teepublic')) && alt.length > 5 && !alt.includes('Profile')) {
                    allTrends.push({ title: alt, source: 'TeePublic', image: src });
                }
            }
        }

        // 3. Pinterest (Visual Trends from State)
        try {
            const pinRes = await fetch('https://www.pinterest.com/search/pins/?q=tshirt%20design%20ideas');
            const pinHtml = await pinRes.text();
            const pinMatch = /<script id="__PWS_DATA__"[^>]*>([\s\S]*?)<\/script>/i.exec(pinHtml);
            if (pinMatch) {
                const pinData = JSON.parse(pinMatch[1]);
                const results = [];
                const traverse = (obj) => {
                    if (!obj || typeof obj !== 'object') return;
                    if (obj.images && obj.images.orig && obj.images.orig.url && (obj.title || obj.grid_title)) {
                        let title = obj.title || obj.grid_title;
                        if (title && title.length > 4 && title.length < 50) {
                            results.push({ title: title, source: 'Pinterest', image: obj.images.orig.url });
                        }
                    }
                    for (let key in obj) { traverse(obj[key]); }
                };
                traverse(pinData);
                allTrends = allTrends.concat(results);
            }
        } catch (e) { console.log("Pinterest parse error", e); }

        // Deduplicate logically
        const uniqueDict = {};
        allTrends.forEach(t => {
            let cleanTitle = t.title.toLowerCase().trim();
            if (!uniqueDict[cleanTitle]) {
                uniqueDict[cleanTitle] = t;
            }
        });

        let uniqueArray = Object.values(uniqueDict).sort(() => Math.random() - 0.5).slice(0, 300);

        // Cache the raw results
        await chrome.storage.local.set({ saaCachedTrends: uniqueArray, saaLastTrendUpdate: Date.now() });

        return { trends: uniqueArray };
    } catch (err) {
        return { error: err.message };
    }
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'dailyTrendHunter') {
        console.log("Starting Daily Trend Hunt...");
        fetchAllTrendsBackground();
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const action = message.type || message.action;
    if (action === 'CHECK_TRADEMARK') {
        const forbiddenWords = ['disney', 'marvel', 'nike', 'apple', 'star wars', 'mickey', 'harry potter'];
        const textToLower = message.payload.toLowerCase();

        let isSafe = true;
        for (let word of forbiddenWords) {
            if (textToLower.includes(word)) {
                isSafe = false;
                break;
            }
        }
        sendResponse({ safe: isSafe });
        return true;
    }

    if (action === 'FETCH_TRENDS' || action === 'fetch_trends') {
        chrome.storage.local.get(['saaCachedTrends', 'saaLastTrendUpdate'], async (res) => {
            // Use cache if it's fresh (less than 2 hours old) and user isn't forcing refresh
            const twoHours = 2 * 60 * 60 * 1000;
            if (!message.force && res.saaCachedTrends && res.saaLastTrendUpdate && (Date.now() - res.saaLastTrendUpdate < twoHours)) {
                sendResponse({ success: true, trends: res.saaCachedTrends, cached: true });
            } else {
                const freshData = await fetchAllTrendsBackground();
                freshData.success = true;
                sendResponse(freshData);
            }
        });
        return true;
    }

    if (action === 'FETCH_NEWS') {
        const query = message.payload || 'trending niche';
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

        fetch(url)
            .then(res => res.text())
            .then(xml => {
                // Simple regex to extract titles and links from RSS
                const items = [];
                const itemRegex = /<item>([\s\S]*?)<\/item>/g;
                const titleRegex = /<title>(.*?)<\/title>/;
                const linkRegex = /<link>(.*?)<\/link>/;
                const dateRegex = /<pubDate>(.*?)<\/pubDate>/;

                let match;
                while ((match = itemRegex.exec(xml)) !== null && items.length < 10) {
                    const itemContent = match[1];
                    const title = titleRegex.exec(itemContent)?.[1] || "No Title";
                    const link = linkRegex.exec(itemContent)?.[1] || "#";
                    const date = dateRegex.exec(itemContent)?.[1] || "";
                    items.push({ title, link, date });
                }
                sendResponse({ items });
            })
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }

    if (action === 'CALL_GEMINI' || action === 'call_gemini') {
        const apiKey = message.apiKey || "AIzaSyDtC8mbZy9cYSyTcoWYuwcqGy1cm7yrpzs";

        const executeGeminiCall = async () => {
            try {
                const targetModel = "gemini-2.0-flash";

                let parts = [{ text: message.prompt }];
                if (message.base64) {
                    const cleanBase64 = message.base64.replace(/^data:image\/[a-z]+;base64,/, '');
                    parts.push({
                        inline_data: {
                            mime_type: 'image/jpeg',
                            data: cleanBase64
                        }
                    });
                }

                // 2. إرسال الطلب بشكل مباشر ومستقر للجيل الأحدث
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: parts
                        }]
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    sendResponse({ success: false, error: data.error?.message || 'خطأ في الاتصال بواجهة Gemini API.' });
                    return;
                }

                if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                    const aiText = data.candidates[0].content.parts[0].text;
                    sendResponse({ success: true, data: { result: aiText } });
                } else {
                    sendResponse({ success: false, error: 'لم يقم الذكاء الاصطناعي بتوليد أي نص واضح.' });
                }
            } catch (err) {
                sendResponse({ success: false, error: 'فشل الاتصال: ' + err.message });
            }
        };

        executeGeminiCall();

        return true; // Indicate asynchronous response
    }

    if (action === 'lab_perform_scan') {
        const q = encodeURIComponent(message.query || '');
        const url1 = q ? `https://www.teepublic.com/t-shirts?query=${q}&sort=newest` : `https://www.teepublic.com/t-shirts?sort=newest`;
        const url2 = q ? `https://www.teepublic.com/t-shirts?query=${q}&sort=popular` : `https://www.teepublic.com/t-shirts?sort=popular`;

        Promise.all([
            fetch(url1).then(r => r.text()),
            fetch(url2).then(r => r.text())
        ]).then(([newest, popular]) => {
            sendResponse({ success: true, newestPages: [newest], popularPages: [popular] });
        }).catch(e => sendResponse({ success: false, error: e.message }));
        return true;
    }
});
