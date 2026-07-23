const DEFAULT_GEMINI_KEY = '';

function setStatus(message, type = 'success') {
    const statusDiv = document.getElementById('api-status');
    if (!statusDiv) return;
    statusDiv.textContent = message;
    statusDiv.className = `api-status ${type === 'success' ? 'success' : ''}`;
    statusDiv.style.display = 'block';
}

async function getStoredGeminiKey() {
    const result = await chrome.storage.local.get(['seoAnalyseGeminiKey']);
    return result.seoAnalyseGeminiKey || '';
}

async function saveGeminiKey() {
    const input = document.getElementById('gemini-api-key');
    const value = input?.value?.trim() || '';
    await chrome.storage.local.set({ seoAnalyseGeminiKey: value });
    setStatus(value ? 'تم حفظ مفتاح Gemini المخصص بنجاح.' : 'تم حذف المفتاح المخصص — أضف مفتاحاً لتفعيل التوليد.');
}

async function generateTags() {
    const generateBtn = document.getElementById('generate-tags-btn');
    const nicheInput = document.getElementById('tp-niche-input');
    const resultArea = document.getElementById('tags-result-area');
    const tagsListDiv = document.getElementById('tags-list');
    const loadingDiv = document.getElementById('gen-loading');

    const niche = nicheInput?.value?.trim();
    if (!niche) {
        alert('يرجى إدخال اسم النيتش أولاً.');
        return;
    }

    const customKey = await getStoredGeminiKey();
    const apiKey = String(customKey || DEFAULT_GEMINI_KEY || '').trim();
    if (!apiKey) {
        alert('مفتاح Gemini غير مُعدّ. أدخله في الحقل أعلاه أو من لوحة التحكم → مفاتيح AI.');
        return;
    }
    const originalLabel = generateBtn.textContent;

    generateBtn.disabled = true;
    generateBtn.textContent = 'جاري التوليد...';
    loadingDiv.classList.remove('hidden');
    resultArea.classList.add('hidden');

    const prompt = `Act as a veteran TeePublic SEO expert. Generate exactly 25 high-quality TeePublic tags for the niche "${niche}".
Return only one comma-separated line with exactly 25 tags.
No explanation. No numbering.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            throw new Error(`API ${response.status}`);
        }

        const data = await response.json();
        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const tags = aiText
            .replace(/\n/g, ',')
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
            .slice(0, 25);

        if (tags.length === 0) {
            throw new Error('Empty result');
        }

        tagsListDiv.textContent = tags.join(', ');
        resultArea.classList.remove('hidden');
        setStatus(`تم توليد ${tags.length} Tag بنجاح.`);
    } catch (error) {
        console.error('SEO Analyse Artisan Error:', error);
        setStatus(`فشل التوليد: ${error.message}`, 'error');
    } finally {
        loadingDiv.classList.add('hidden');
        generateBtn.disabled = false;
        generateBtn.textContent = originalLabel;
    }
}

function bindGuideButton() {
    const guideBtn = document.getElementById('guide-btn');
    if (!guideBtn) return;

    guideBtn.addEventListener('click', () => {
        const originalLabel = 'كيفية الاستخدام';
        guideBtn.textContent = 'افتح أي صفحة بحث أو صفحة تصميم ثم استخدم الأداة';
        guideBtn.style.background = 'linear-gradient(135deg, #00d2ff, #00c853)';
        setTimeout(() => {
            guideBtn.textContent = originalLabel;
            guideBtn.style.background = '';
        }, 3200);
    });
}

function bindCopyButton() {
    const copyBtn = document.getElementById('copy-all-btn');
    const tagsListDiv = document.getElementById('tags-list');
    if (!copyBtn || !tagsListDiv) return;

    copyBtn.addEventListener('click', async () => {
        const text = tagsListDiv.textContent.trim();
        if (!text) return;

        await navigator.clipboard.writeText(text);
        const originalLabel = copyBtn.textContent;
        copyBtn.textContent = 'تم النسخ';
        setTimeout(() => {
            copyBtn.textContent = originalLabel;
        }, 1800);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const apiKeyInput = document.getElementById('gemini-api-key');
    const saveKeyBtn = document.getElementById('save-api-key');
    const generateBtn = document.getElementById('generate-tags-btn');

    if (apiKeyInput) {
        apiKeyInput.value = await getStoredGeminiKey();
    }

    chrome.storage.local.get(['saaGlobalAuto'], (result) => {
        if (result.saaGlobalAuto !== false) {
            setStatus('المستشار الذكي جاهز ويعمل في الخلفية.');
        } else {
            setStatus('الوضع التلقائي متوقف حالياً، لكن مولد التاجز جاهز.', 'error');
        }
    });

    saveKeyBtn?.addEventListener('click', saveGeminiKey);
    generateBtn?.addEventListener('click', generateTags);
    bindGuideButton();
    bindCopyButton();
});
