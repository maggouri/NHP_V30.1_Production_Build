/**
 * موصل الـ API الخاص بـ Hugging Face (مُحدث لدعم FLUX) لـ Studio V2
 * وظيفته: إرسال البرومبت الذكي واستلام روابط الصور العالية الجودة
 */

export async function generateImagesFromFal(promptData, numImages = 1) {
    // استخدام نموذج FLUX.1-schnell القوي والسريع من Hugging Face
    const endpoint = "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell";

    // Hugging Face tokens — configure in extension settings; never commit real keys
    const hfTokens = [];

    try {
        // 1. اختيار مفتاح عشوائي لتوزيع الحمل وتجنب الحظر (Rate Limits)
        const randomToken = hfTokens[Math.floor(Math.random() * hfTokens.length)];

        // 2. إرسال الطلب لـ Hugging Face
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${randomToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                inputs: promptData.prompt,
                parameters: {
                    // FLUX لا يدعم الكلمات السلبية بنفس الطريقة لكنه يتفوق في الفهم
                    guidance_scale: promptData.cfg_scale || 7.5,
                    num_inference_steps: 4, // FLUX Schnell يحتاج 4 خطوات فقط ليعطي نتيجة مثالية
                    width: 1024,
                    height: 1024
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`مشكلة في الاتصال بمحرك FLUX (${response.status}): ${errorText}`);
        }

        // 3. محرك Hugging Face يعيد الصورة كـ Blob (ملف ثنائي)
        const blob = await response.blob();

        // تحويل الـ Blob إلى صيغة Base64 لتتوافق مع الـ Background Script والتصدير
        const base64Url = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

        return [base64Url]; // إرجاعها داخل مصفوفة كما تتوقع واجهة المستخدم

    } catch (error) {
        console.error("Critical API Connector Error:", error);
        throw error; // نقوم برمي الخطأ لكي تستقبله واجهة المستخدم (UI) وتظهر تنبيهاً
    }
}
