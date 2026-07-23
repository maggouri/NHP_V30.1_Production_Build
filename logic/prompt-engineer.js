/**
 * محرك تحويل النيش إلى برومبت احترافي للـ POD (Studio V2)
 * يركز على أنماط التصميم الأكثر مبيعاً في TeePublic
 */

const DesignStyles = {
    VECTOR: "vector art illustration, flat design, clean strokes, minimalist, solid colors",
    VINTAGE: "distressed vintage style, retro 90s aesthetic, faded colors, textured screen print",
    STICKER: "die-cut sticker style, thick white border, high contrast, vibrant cartoon",
    TYPOGRAPHY: "creative typography, hand-lettered bold font, decorative elements",
    KAWAII: "kawaii style, cute Japanese anime aesthetic, pastel colors, adorable character design",
    CYBERPUNK: "cyberpunk aesthetic, neon lighting, futuristic, highly detailed, synthwave style"
};

export function generatePODPrompt(userNiche, styleKey = 'VECTOR') {
    const selectedStyle = DesignStyles[styleKey] || DesignStyles.VECTOR;

    // المكونات الأساسية لضمان جودة الطباعة وسهولة إزالة الخلفية
    const qualityBoosters = "masterpiece, sharp edges, 8k resolution, high-quality professional graphic";
    const technicalConstraints = "pure white background, isolated on white, no gradients, no shadows";

    // بناء البرومبت النهائي
    const finalPrompt = `${userNiche}, ${selectedStyle}, ${qualityBoosters}, ${technicalConstraints}`;

    // الكلمات السلبية (Negative Prompt) لمنع الأخطاء الشائعة
    const negativePrompt = "photorealistic, 3d render, blurry, messy lines, watermark, text, low resolution, complex background, grey background, shadows, shading, gradient colors";

    return {
        prompt: finalPrompt,
        negative_prompt: negativePrompt,
        steps: 30,
        cfg_scale: 7.5
    };
}

// تصدير الأنماط لتستخدمها واجهة المستخدم (UI) لإنشاء قائمة منسدلة
export { DesignStyles };
