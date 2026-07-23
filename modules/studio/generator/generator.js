/**
 * Generator Sub-Module for Niche Hunter Pro Studio
 * Provides AI image generation capabilities
 * Universal Background Tunnel (V3 - Final Stability)
 */

export const Generator = {
    parentHelpers: null,
    isGenerating: false,
    
    init(helpers) {
        this.parentHelpers = helpers;
        console.log('✨ Generator Sub-Module: Initializing (Ultimate Tunneling)...');
        this.setupEventListeners();
        setTimeout(() => this.restoreKey(), 100);
    },

    restoreKey() {
        chrome.storage.local.get(['generator_gemini_key', 'generator_last_img', 'generator_last_prompt'], (res) => {
            const input = document.getElementById('generator-gemini-key');
            if (input) {
                if (res.generator_gemini_key) {
                    input.value = res.generator_gemini_key;
                }
            }
            if (res.generator_last_img) {
                this.displayResult(res.generator_last_img, res.generator_last_prompt || '');
                const promptArea = document.getElementById('generator-prompt');
                if (promptArea && res.generator_last_prompt) promptArea.value = res.generator_last_prompt;
            }
        });
    },

    setupEventListeners() {
        document.getElementById('generator-btn-submit')?.addEventListener('click', () => this.handleGenerate());
        document.getElementById('generator-btn-magic')?.addEventListener('click', () => this.handleMagicPrompt());
        
        const keyInput = document.getElementById('generator-gemini-key');
        if (keyInput) {
            keyInput.oninput = () => chrome.storage.local.set({ generator_gemini_key: keyInput.value.trim() });
        }
    },

    async handleMagicPrompt() {
        const key = document.getElementById('generator-gemini-key')?.value.trim();
        const prompt = document.getElementById('generator-prompt')?.value.trim();
        if (!key || !prompt) {
            this.parentHelpers?.showToast('⚠️ المفتاح أو الوصف مفقود');
            return;
        }

        const btnMagic = document.getElementById('generator-btn-magic');
        if (btnMagic) { btnMagic.textContent = '⏳'; btnMagic.disabled = true; }

        try {
            const systemPrompt = `You are an elite T-shirt design prompt engineer. Combine: mosaic style, sparkling glitter effect, shiny rhinestone, glowing highlights, high contrast, vector art, isolated on black background. Improve the user input into a professional detailed English prompt for image generation.`;
            
            // Use background tunnel for magic prompt too to avoid CSP
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    action: 'fetch_json',
                    url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
                    method: 'POST',
                    body: { contents: [{ parts: [{ text: `${systemPrompt}\n\nClient Input: ${prompt}` }] }] }
                }, resolve);
            });

            const enhanced = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (enhanced) {
                document.getElementById('generator-prompt').value = enhanced;
                this.parentHelpers?.showToast('✨ تم التحسين بنجاح');
            }
        } catch (e) {
            this.parentHelpers?.showToast('❌ فشل التحسين');
        } finally {
            if (btnMagic) { btnMagic.textContent = '✨'; btnMagic.disabled = false; }
        }
    },

    async handleGenerate() {
        if (this.isGenerating) return;
        
        const prompt = document.getElementById('generator-prompt')?.value.trim();
        const key = document.getElementById('generator-gemini-key')?.value.trim();
        const resultsContainer = document.getElementById('generator-results-display');
        
        if (!prompt) {
            this.parentHelpers?.showToast('⚠️ أدخل وصفاً أولاً');
            return;
        }

        this.setLoading(true);
        resultsContainer.innerHTML = `
            <div class="generator-loading-spinner">
                <div class="spinner-icon"></div>
                <span id="generator-load-status">بدء العمل عبر النفق المحمي...</span>
                <div id="generator-live-log" style="margin-top:10px; font-size:8px; line-height:1.2; text-align:left; color:#94a3b8; max-height:80px; overflow-y:auto; background:rgba(0,0,0,0.2); padding:5px; border-radius:4px;"></div>
            </div>
        `;

        const statusEl = document.getElementById('generator-load-status');
        const logEl = document.getElementById('generator-live-log');
        const appendLog = (msg, isError = false) => {
            const p = document.createElement('p');
            p.style.color = isError ? '#ef4444' : '#94a3b8';
            p.textContent = `> ${msg}`;
            if (logEl) logEl.prepend(p);
        };

        const seed = Math.floor(Math.random() * 1000000);

        // Strategy 1: Gemini Pro Image (Background Tunnel Mode)
        if (key) {
            try {
                if (statusEl) statusEl.textContent = 'جاري التوليد عبر Gemini Pro...';
                appendLog('محاولة Gemini Pro (v3.1-IMAGE)...');

                const response = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({
                        action: 'fetch_json',
                        url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${key}`,
                        method: 'POST',
                        body: {
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { responseMimeType: "image/png", responseModalities: ["IMAGE"] },
                            safetySettings: [
                                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                            ]
                        }
                    }, resolve);
                });

                if (response && response.success) {
                    const imgData = response.data?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
                    if (imgData) {
                        const dataURL = `data:image/png;base64,${imgData}`;
                        this.displayResult(dataURL, prompt);
                        this.parentHelpers?.showToast('💎 تم بنجاح عبر Gemini Pro!');
                        chrome.storage.local.set({ generator_last_img: dataURL, generator_last_prompt: prompt });
                        this.setLoading(false);
                        return;
                    }
                    appendLog('⚠️ Gemini لم يرجع صورة. جاري الانتقال للمحرك البديل...', true);
                } else {
                    appendLog(`❌ محرك Gemini فشل: ${response?.error}`, true);
                }
            } catch (err) {
                appendLog(`❌ خطأ نفق Gemini: ${err.message}`, true);
            }
        }

        // Strategy 2: Pollinations/Shakker (Background Tunnel)
        const engines = [
            { name: 'Stable Flux', url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&seed=${seed}&model=flux` },
            { name: 'Shakker Engine', url: `https://shakker.pollinations.ai/prompt/${encodeURIComponent(prompt)}?seed=${seed}` }
        ];

        let lastError = 'All engines failed';
        for (const engine of engines) {
            try {
                if (statusEl) statusEl.textContent = `محاولة ${engine.name}...`;
                appendLog(`جاري المحاولة عبر ${engine.name}...`);

                const res = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({ action: 'fetch_blob', url: engine.url }, resolve);
                });

                if (res && res.success) {
                    const dataURL = `data:image/png;base64,${res.base64}`;
                    this.displayResult(dataURL, prompt);
                    this.parentHelpers?.showToast(`✅ نجح عبر ${engine.name}`);
                    chrome.storage.local.set({ generator_last_img: dataURL, generator_last_prompt: prompt });
                    this.setLoading(false);
                    return;
                }
                appendLog(`⚠️ فشل ${engine.name}: ${res?.error || 'Network Error'}`, true);
                lastError = res?.error || 'Network Error';
            } catch (e) {
                appendLog(`❌ خطأ: ${e.message}`, true);
            }
        }

        this.setLoading(false);
        resultsContainer.innerHTML = `
            <div style="text-align:center; padding:15px; border:1px solid rgba(239,68,68,0.3); border-radius:8px;">
                <p style="color:#ef4444; font-size:11px; margin-bottom:5px;">❌ فشلت كافة عمليات التوليد</p>
                <div style="font-size:9px; color:var(--text-muted); text-align:left; margin-bottom:10px;">السبب التقني: ${lastError}</div>
                <button id="gen-retry-btn" style="background:var(--primary); color:#fff; border:none; padding:6px 15px; border-radius:5px; font-size:10px; cursor:pointer;">إعادة المحاولة عبر النفق</button>
            </div>
        `;
        document.getElementById('gen-retry-btn').onclick = () => this.handleGenerate();
    },

    setLoading(isLoading) {
        this.isGenerating = isLoading;
        const btn = document.getElementById('generator-btn-submit');
        const promptInput = document.getElementById('generator-prompt');
        if (btn) btn.disabled = isLoading;
        if (promptInput) promptInput.disabled = isLoading;
    },

    displayResult(url, prompt) {
        const resultsContainer = document.getElementById('generator-results-display');
        if (!resultsContainer) return;
        resultsContainer.innerHTML = '';
        const card = document.createElement('div');
        card.className = 'generator-result-card';
        const img = document.createElement('img');
        img.src = url;
        const actions = document.createElement('div');
        actions.className = 'card-actions';
        const addToStudioBtn = document.createElement('button');
        addToStudioBtn.innerHTML = '<i class="fa-solid fa-plus"></i> أضف للإنتاج';
        addToStudioBtn.className = 'btn-add-studio';
        addToStudioBtn.onclick = (e) => { e.stopPropagation(); this.addToStudio(url, prompt); };
        const downloadBtn = document.createElement('button');
        downloadBtn.innerHTML = '<i class="fa-solid fa-download"></i>';
        downloadBtn.className = 'btn-download-img';
        downloadBtn.style.cssText = 'background:rgba(255,255,255,0.2); border:none; color:#fff; width:30px; height:30px; border-radius:6px; margin-right:5px; cursor:pointer;';
        downloadBtn.onclick = (e) => { e.stopPropagation(); const a = document.createElement('a'); a.href = url; a.download = `AI_Design_${Date.now()}.png`; a.click(); };
        actions.appendChild(downloadBtn);
        actions.appendChild(addToStudioBtn);
        card.appendChild(img);
        card.appendChild(actions);
        resultsContainer.appendChild(card);
    },

    async addToStudio(url, prompt) {
        try {
            this.parentHelpers?.showToast('⏳ جاري النقل...');
            if (this.parentHelpers?.processImage) {
                this.parentHelpers.processImage({ name: `AI_Gen_${Date.now()}.png`, dataURL: url });
                if (this.parentHelpers?.goToStep) this.parentHelpers.goToStep(1);
                this.parentHelpers?.showToast('🚀 تم بنجاح!');
            }
        } catch (error) {
            this.parentHelpers?.showToast('❌ فشل النقل');
        }
    }
};
