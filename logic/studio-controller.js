import { generatePODPrompt } from './prompt-engineer.js';
import { generateImagesFromFal } from './api-connector.js';

export async function startDesignGeneration(userNiche) {
    const promptData = generatePODPrompt(userNiche, 'VECTOR');
    const totalImages = 5;
    const allImageUrls = [];

    try {
        // إظهار الهياكل (Skeletons) بالعدد المطلوب
        if (typeof window.showSkeletons === 'function') window.showSkeletons(totalImages);

        // التوليد المتتالي: صورة بصورة لتجنب انقطاع الاتصال (Timeout)
        for (let i = 0; i < totalImages; i++) {
            try {
                const singleResult = await generateImagesFromFal(promptData, 1);
                if (singleResult && singleResult.length > 0) {
                    allImageUrls.push(singleResult[0]);
                    if (typeof window.renderSingleThumbnail === 'function') {
                        window.renderSingleThumbnail(singleResult[0], i);
                    }
                }
            } catch (err) {
                console.error(`خطأ في توليد الصورة ${i + 1}:`, err);
                if (typeof window.showErrorForSkeleton === 'function') window.showErrorForSkeleton(i, err.message);
            }
        }
        return allImageUrls;
    } catch (error) {
        if (typeof window.showErrorNotification === 'function') {
            window.showErrorNotification("عذراً، حدث خطأ أثناء الاتصال بالمحرك الذكي: " + error.message);
        }
    }
}

/**
 * إرسال طلب معالجة الصورة إلى الخلفية (The Controller)
 * @param {string} imageUrl الرابط المؤقت للصورة من الـ API
 */
export async function processAndExport(imageUrl) {
    return new Promise((resolve, reject) => {
        // رسالة للـ Service Worker الذي قمنا بتحميله ببروتوكول الـ Routing
        chrome.runtime.sendMessage({
            type: 'PROCESS_IMAGE_REQUEST',
            data: {
                imageUrl: imageUrl,
                targetWidth: 4500,
                targetHeight: 5400,
                dpi: 300,
                fileName: `TeePublic_Design_${Date.now()}.png`
            }
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Communication Error:", chrome.runtime.lastError);
                return reject(chrome.runtime.lastError);
            }
            resolve(response);
        });
    });
}
