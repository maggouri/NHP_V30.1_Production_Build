/**
 * 🧠 NHP Central AI Brain - Core Engine
 * Powered by Gemini 2.5 Flash (v1 API)
 * Centralized Logic for all AI operations in Niche Hunter Pro
 */

class AICentralBrain {
    constructor() {
        this.apiKey = '';
        this.baseUrl = "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent";
        this.systemContext = "You are the Niche Hunter Pro Super-AI. You are a professional Print on Demand strategist, SEO expert, and Trademark analyst.";
        /** Matches ai-bridge-server default (see NHP_AI_BRIDGE_PORT). */
        this.localBridgeBaseUrl = "http://127.0.0.1:3031";
        /** Keep bridge attempt short so offline/hung server does not block Gemini fallback. */
        this.localBridgeTimeoutMs = 4500;
        this.localBridgeDisabledUntil = 0;
        this.geminiApiDisabledUntil = 0;
        this.geminiApiDisabledReason = "";
    }

    _getRetryDelayMsFromErrorMessage(message, fallbackMs = 60000) {
        const text = String(message || "");
        const retryMatch = text.match(/retry\s+in\s+([\d.]+)s/i);
        if (retryMatch) {
            const seconds = Number(retryMatch[1]);
            if (Number.isFinite(seconds) && seconds > 0) {
                return Math.max(5000, Math.ceil(seconds * 1000) + 1500);
            }
        }
        return fallbackMs;
    }

    _markGeminiApiUnavailable(status, message = "") {
        const raw = String(message || "");
        const retryMs = status === 429
            ? this._getRetryDelayMsFromErrorMessage(raw, 60000)
            : 30 * 60 * 1000;
        this.geminiApiDisabledUntil = Date.now() + retryMs;
        this.geminiApiDisabledReason = status === 429
            ? `Gemini API quota/rate limit. Retry after ${Math.ceil(retryMs / 1000)}s.`
            : `Gemini API unavailable (${status}). ${raw}`.trim();
    }

    _assertGeminiApiAvailable() {
        if (Date.now() < this.geminiApiDisabledUntil) {
            const waitSeconds = Math.ceil((this.geminiApiDisabledUntil - Date.now()) / 1000);
            throw new Error(`${this.geminiApiDisabledReason || 'Gemini API temporarily disabled.'} Wait ${waitSeconds}s.`);
        }
    }

    /**
     * Optional: same controlled Chrome session as /ai-image-bridge, text-only (Gemini web UI).
     */
    async _tryLocalAiTextBridge(promptText, targetUrl = "") {
        const body = String(promptText || "").trim();
        if (!body) return null;
        if (Date.now() < this.localBridgeDisabledUntil) return null;
        const url = `${this.localBridgeBaseUrl.replace(/\/$/, "")}/ai-text-bridge`;
        const controller = new AbortController();
        const timeoutMs = Math.max(
            1500,
            Number(this.localBridgeTimeoutMs) || 4500
        );
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetUrl: targetUrl || undefined,
                    promptText: body
                }),
                signal: controller.signal
            });
            const rawText = await response.text().catch(() => "");
            let data = {};
            try {
                data = rawText ? JSON.parse(rawText) : {};
            } catch (_) {
                console.warn(
                    "Local AI text bridge returned non-JSON; falling back to Gemini API.",
                    `(${response.status})`
                );
                return null;
            }
            if (!response.ok || !data.success) {
                const errMsg = data.error || `HTTP ${response.status}`;
                console.warn("Local AI text bridge:", errMsg, "— falling back to Gemini API.");
                return null;
            }
            const text = String(data.responseText || "").trim();
            return text || null;
        } catch (error) {
            if (error?.name === "AbortError") {
                console.warn(
                    `Local AI text bridge timed out after ${timeoutMs}ms; falling back to Gemini API.`
                );
            } else {
                this.localBridgeDisabledUntil = Date.now() + 30000;
                console.warn(
                    "Local AI text bridge unavailable:",
                    error?.message || error,
                    "— falling back to Gemini API."
                );
            }
            return null;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async _ensureGeminiApiKey() {
        if (String(this.apiKey || '').trim()) return this.apiKey;
        try {
            const resolved = await new Promise((resolve) => {
                chrome.runtime?.sendMessage?.({
                    action: 'NHP_AI_SETTINGS_BRIDGE_RESOLVE_GEMINI',
                    file: 'ai-brain.js',
                }, (response) => {
                    if (chrome.runtime?.lastError || !response?.ok) {
                        resolve(null);
                        return;
                    }
                    resolve(response);
                });
            });
            if (resolved?.apiKey) {
                this.apiKey = String(resolved.apiKey).trim();
                return this.apiKey;
            }
        } catch (_) {
            /* legacy ladder below */
        }
        const storageKeys = ['nhpInternalGeminiKey', 'seoInternalGeminiKey', 'customGeminiKey'];
        const stored = await new Promise((resolve) => {
            try {
                chrome.storage?.local?.get(storageKeys, (res) => resolve(res || {}));
            } catch (_) {
                resolve({});
            }
        });
        this.apiKey = String(
            stored.nhpInternalGeminiKey || stored.seoInternalGeminiKey || stored.customGeminiKey || ''
        ).trim();
        return this.apiKey;
    }

    /**
     * Internal: Low-level call to Gemini API
     */
    async _callAI(prompt, systemInstruction = "", isVision = false, imageBase64 = null) {
        await this._ensureGeminiApiKey();
        if (!this.apiKey) {
            throw new Error('مفتاح Gemini غير مُعدّ. أضفه من لوحة التحكم → مفاتيح AI.');
        }
        this._assertGeminiApiAvailable();
        const url = `${this.baseUrl}?key=${this.apiKey}`;

        const payload = {
            contents: [{
                parts: [
                    { text: systemInstruction ? `${systemInstruction}\n\nUser Input: ${prompt}` : prompt }
                ]
            }],
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 2048,
            }
        };

        // If vision is required (for imitation mode)
        if (isVision && imageBase64) {
            const raw = String(imageBase64);
            const mimeGuess = raw.match(/^data:([^;,]+)[;,]/i)?.[1] || 'image/png';
            const b64 = (raw.includes(',') ? raw.split(',')[1] : raw) || '';
            payload.contents[0].parts.push({
                inlineData: {
                    mimeType: mimeGuess,
                    data: b64.replace(/\s/g, '')
                }
            });
        }

        const abortController = new AbortController();
        const timeoutMs = 45000;
        const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: abortController.signal
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const detailedError = errorData.error?.message || response.statusText;
                if (response.status === 403 || response.status === 429) {
                    this._markGeminiApiUnavailable(response.status, detailedError);
                }
                throw new Error(`Gemini API Error (${response.status}): ${detailedError}`);
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const trimmed = String(text).trim();
            if (trimmed) return trimmed;

            const finishReason = data.candidates?.[0]?.finishReason || '';
            const blockReason = data.promptFeedback?.blockReason || '';
            const hint = [finishReason, blockReason].filter(Boolean).join(' · ');
            throw new Error(
                hint
                    ? `Gemini returned no text (${hint}).`
                    : 'Gemini returned no text (empty candidates).'
            );
        } catch (error) {
            if (error?.name === 'AbortError') {
                const timeoutErr = new Error(`Gemini request timed out after ${timeoutMs / 1000}s.`);
                console.error("Central AI Brain Error:", timeoutErr);
                throw timeoutErr;
            }
            console.error("Central AI Brain Error:", error);
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    // --- Specialized Modules ---

    /**
     * 1. Trends Analysis & Niche Mixing
     */
    async analyzeTrends(rawTrendsList) {
        const prompt = `Analyze these raw trends from TeePublic and suggest 5 high-potential "Niche Mixes" or unique design angles: ${JSON.stringify(rawTrendsList)}`;
        const instruction = "Strategic Trend Advisor: Focus on evergreen potential + current trending viral topics.";
        return await this._callAI(prompt, instruction);
    }

    /**
     * 2. SEO & Tags Generation (25 Tags Standard)
     */
    async generateTags(niche) {
        const prompt = `Generate 25 high-performing SEO tags for a design about: "${niche}".`;
        const instruction = "SEO Specialist: Return only comma-separated tags. No text before or after.";
        const result = await this._callAI(prompt, instruction);
        return result ? result.split(',').map(t => t.trim()) : [];
    }

    /**
     * 3. Trademark Safety Analysis
     */
    async checkTrademarkRisk(query) {
        const prompt = `Check this phrase for trademark or copyright risk in the POD world: "${query}". Describe risk and suggest 3 safe alternatives.`;
        const instruction = "Legal Risk Assessor: Be strict with Disney, Marvel, and famous quotes. Provide actionable alternatives.";
        return await this._callAI(prompt, instruction);
    }

    /**
     * 4. Design Aesthetic Auditor
     */
    async auditDesign(designMetadata) {
        // Future: Integration with Vision API for base64 analysis
        const prompt = `Review this design idea meta-data: ${JSON.stringify(designMetadata)}. Provide an Aesthetic and Marketability score (1-10).`;
        const instruction = "Professional Art Director: Critique colors, fonts, and niche appeal.";
        return await this._callAI(prompt, instruction);
    }

    /**
     * 5. Islamic Sharia Ruling Auditor (Ultra-Concise Mode)
     */
    async getIslamicRuling(niche) {
        const prompt = `المستخدم مسلم يعمل في Print-on-Demand (تصاميم التيشرتات والمحتوى التسويقي).
        النيتش أو مجال العمل المقترح: "${niche}".
        احكم هل **العمل كمصمم/بائع في هذا المجال** (إنشاء تصاميم وبيعها في هذا السياق) جائز بشكل عام للمسلم من زاوية الشريعة، مع الأخذ بالاعتبار المحتوى الغالب للنيتش (ما يُباع ويُروَّج).
        أجب بالحكم بين أقواس فقط كأحد: [حلال] أو [حرام] أو [شبهة].
        بعد القوس نفس السطر، شرح عربي قصير جداً للسبب (سطر واحد).
        مثال: [شبهة] - قد يخلط التصاميم بمحتوى غير محرم؛ يحتاج تفصيل للمنتج الفعلي.`;
        const instruction = "مستشار أخلاقي إسلامي مختصر: الحكم بالأقواس ثم شرح قصير بالعربية؛ لا تستخدم سوى [حلال] أو [حرام] أو [شبهة].";
        const combinedForBridge = `${instruction}\n\nUser Input: ${prompt}`;
        const bridged = await this._tryLocalAiTextBridge(combinedForBridge);
        if (bridged) return bridged;
        return await this._callAI(prompt, instruction);
    }

    /**
     * 6. Radar Competition Gap Miner & Rising Star Predictor
     */
    async analyzeRadarNiche(niche, designs) {
        const prompt = `حلل النيش التالي: "${niche}".
        عينة التصاميم المنافسة: ${JSON.stringify(designs.slice(0, 5))}.
        
        المطلوب:
        1. تقييم احتمالية نجاح هذا النيش كترند صاعد بنسبة مئوية (مثال: 85%).
        2. قارن هذا النيش مع الأحداث والأخبار العالمية الحالية.
        أعطني الخلاصة في سطر واحد قصير جداً يوضح مدى قوة النيش والثغرة التي يمكن استغلالها، وتأكد من تضمين النسبة المئوية في النص.
        اكتب باللغة العربية وبدون أي مقدمات.`;
        const instruction = "محلل استراتيجي خبير ومركّز. أجب باختصار شديد جداً (كلمات يسيرة فقط).";
        return await this._callAI(prompt, instruction);
    }

    /**
     * 6.1 Visual Style Analyzer (Radar Hunter)
     */
    async analyzeTrendStyle(niche, imageBase64) {
        if (!imageBase64) return "لا توجد صورة للتحليل البصري.";
        const prompt = `Analyze the visual style of this trending design for the niche "${niche}". 
        Describe the style in one short Arabic sentence. Focus on typography, layout, and art style.
        Example: "نمط ريترو عتيق بألوان باستيل مع خطوط سميكة ورسوم مسطحة".`;
        const instruction = "Visual Art Director: Be concise and professional in Arabic.";
        return await this._callAI(prompt, instruction, true, imageBase64);
    }

    /**
     * 7. AI Creative Studio: Imitation / Vision Analyzer
     * Updated with User's Master POD Instructions and 20 Styles
     */
    async analyzeReferenceImage(imageBase64) {
        if (!imageBase64) return null;

        const masterStyles = `
            1. Retro/Vintage, 2. Typography, 3. Humorous, 4. Pop Art, 5. Kawaii, 
            6. Synthwave, 7. Minimalist, 8. Anime/Manga, 9. Grunge, 10. Line Art,
            11. Gothic/Edgy, 12. Surrealism, 13. Vaporwave, 14. Geometric, 
            15. Psychedelic, 16. Hand-Drawn, 17. Distressed, 18. Cottagecore, 
            19. Cyberpunk, 20. Collage
        `;

        const prompt = `
            I am going to feed your output directly into an AI image generator. Analyze the attached reference design carefully.
            Write a highly detailed image generation prompt to redraw this design, making slight adjustments to the style as appropriate.
            
            Instructions for the prompt you must write:
            1. Describe the main subject, exact pose, key visual elements, and colors of the original design in extreme detail so the image generator can recreate it perfectly.
            2. The prompt MUST request "four high-quality Print-on-Demand (POD) design variations on a solid black background in a 2x2 grid (quad-layout)".
            3. For the first variation, specify that it should be in the exact same style as the original image but with much better quality.
            4. For the other three variations, YOU must silently choose 3 appropriate styles from this list: ${masterStyles}. Always select the most suitable style for the design subject to ensure maximum acceptance and sales, and explicitly write those 3 chosen styles into the prompt.
            5. CRITICAL: Return ONLY the final English prompt string. I always want designs; do not explain or describe anything to me in writing. I only want designs.
        `;

        const instruction = "Senior TeePublic Art Director & Prompt Engineer. Output ONLY the raw English prompt. No conversational text.";
        return await this._callAI(prompt, instruction, true, imageBase64);
    }

    /**
     * 8. POD Prompt Enhancer (Text-to-Prompt)
     * For high-quality generation from simple keywords.
     */
    async enhancePODPrompt(niche) {
        const prompt = `Transform this niche into a professional POD Master Prompt: "${niche}". 
        Make it a "Vector illustration, bold outlines, vintage retro colors, isolated on black background, crisp edges, quad-layout". 
        Focus on maximum sales appeal for TeePublic.`;
        const instruction = "TeePublic Design Architect: Return ONLY the enhanced English prompt.";
        return await this._callAI(prompt, instruction);
    }

    /**
     * 9. Admin Smart Assistant Parser
     */
    async parseAdminCommand(commandText) {
        const prompt = `أنت المساعد الذكي الخاص بإضافة Niche Hunter Pro (صديق، متحدث بشري، مفيد، ومحترف في الطباعة عند الطلب POD).
        يمكنك الدردشة، التعريف بنفسك وبإمكانياتك (توليد SEO، الرادار الذكي، أتمتة الرفع، فحص العلامات التجارية USPTO، والاستوديو)، وتنفيذ أوامر المستخدم.
        
        أرسل المستخدم: "${commandText}"
        
        أرجع الإجابة بصيغة JSON فقط بهذا التنسيق:
        { "reply": "هنا تكتب ردك البشري والطبيعي على المستخدم باللغة العربية", "action": "ACTION_NAME", "payload": "ANY_DATA" }
        
        الإجراءات التي يمكنك تنفيذها (ACTION_NAME):
        - nav_trends: فتح الترندات
        - nav_uspto: فتح USPTO
        - nav_radar: فتح الرادار
        - nav_note: فتح الملاحظات
        - nav_seo: فتح SEO
        - scan_radar: فحص نيش في الرادار (مرر اسم النيش في payload)
        - clear_notes: مسح الملاحظات
        - sync_cloud: مزامنة سحابية
        - none: استخدمها إذا كان كلام المستخدم مجرد دردشة أو سؤال ولا يطلب تنفيذ مهمة.
        
        أرجع JSON فقط وبدون أي نصوص أو علامات Markdown خارجه.`;
        const instruction = "Output strictly valid JSON containing 'reply', 'action', and 'payload'.";
        const result = await this._callAI(prompt, instruction);
        try { const cleanJson = result.match(/\{[\s\S]*\}/); return cleanJson ? JSON.parse(cleanJson[0]) : null; } catch(e) { return null; }
    }
}

// Global Export for Modules
window.AICentralBrain = new AICentralBrain();
console.log("🧠 NHP Central AI Brain Initialized.");
