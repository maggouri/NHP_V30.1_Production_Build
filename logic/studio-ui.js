import { startDesignGeneration, processAndExport } from './studio-controller.js';

export function showSkeletons(count = 5) {
    const grid = document.getElementById('results-grid');
    if (!grid) return;

    grid.innerHTML = Array(count).fill(0).map((_, i) => `
        <div id="skeleton-${i}" class="animate-pulse bg-gray-800 rounded-lg h-40 w-full border border-gray-700 flex flex-col items-center justify-center gap-2 shadow-md">
            <div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span class="text-gray-500 text-[10px]">جاري التوليد...</span>
        </div>
    `).join('');
}

export function renderSingleThumbnail(url, index) {
    const grid = document.getElementById('results-grid');
    const skeleton = document.getElementById(`skeleton-${index}`);
    if (!grid) return;

    const itemHtml = `
        <div class="relative group overflow-hidden rounded-lg border border-gray-700 bg-gray-800 transition-all hover:border-blue-500 shadow-md hover:shadow-xl">
            <img src="${url}" class="w-full h-40 object-cover" alt="Design ${index + 1} for Print on Demand">
            
            <div class="absolute inset-0 bg-black bg-opacity-60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-2 text-center backdrop-blur-sm">
                <button data-url="${url}" class="export-btn bg-green-600 mb-2 hover:bg-green-700 text-white text-[10px] font-bold py-2 px-3 rounded shadow-lg transition-transform active:scale-95 flex items-center gap-1">
                    <span>📥</span> EXPORT 4500x5400 (300 DPI)
                </button>
                <span class="text-[9px] text-gray-300">Fast Background Removal Active</span>
            </div>
        </div>
    `;

    if (skeleton) {
        skeleton.outerHTML = itemHtml;
    } else {
        grid.insertAdjacentHTML('beforeend', itemHtml);
    }

    const newBtn = document.querySelector(`button[data-url="${url}"]`);
    if (newBtn) {
        attachExportEvent(newBtn);
    }
}

export function showErrorForSkeleton(index, errorMsg) {
    const skeleton = document.getElementById(`skeleton-${index}`);
    if (skeleton) {
        skeleton.classList.remove('animate-pulse');
        skeleton.classList.replace('bg-gray-800', 'bg-red-900');
        skeleton.innerHTML = `<span class="text-red-300 text-[10px] text-center p-2">❌ فشل: ${errorMsg || 'خطأ في السيرفر'}</span>`;
    }
}

function attachExportEvent(btn) {
    btn.addEventListener('click', async () => {
        const imgUrl = btn.getAttribute('data-url');
        const originalHtml = btn.innerHTML;

        btn.innerHTML = '⏳ جاري المعالجة...';
        btn.disabled = true;
        btn.classList.replace('bg-green-600', 'bg-gray-600');
        btn.classList.replace('hover:bg-green-700', 'hover:bg-gray-700');

        try {
            await processAndExport(imgUrl);
            btn.innerHTML = '✅ تم التنزيل بنجاح';
            btn.classList.replace('bg-gray-600', 'bg-blue-600');
            btn.classList.replace('hover:bg-gray-700', 'hover:bg-blue-700');
            setTimeout(() => resetBtn(btn, originalHtml, 'bg-blue-600', 'hover:bg-blue-700'), 3000);
        } catch (err) {
            btn.innerHTML = '❌ خطأ في المعالجة';
            btn.classList.replace('bg-gray-600', 'bg-red-600');
            btn.classList.replace('hover:bg-gray-700', 'hover:bg-red-700');
            setTimeout(() => resetBtn(btn, originalHtml, 'bg-red-600', 'hover:bg-red-700'), 3000);
        }
    });
}

function resetBtn(btn, html, oldColorClass, oldHoverClass) {
    btn.innerHTML = html;
    btn.disabled = false;
    btn.classList.replace(oldColorClass, 'bg-green-600');
    btn.classList.replace(oldHoverClass, 'hover:bg-green-700');
}

window.showSkeletons = showSkeletons;
window.renderSingleThumbnail = renderSingleThumbnail;
window.showErrorForSkeleton = showErrorForSkeleton;
window.showErrorNotification = (msg) => alert(msg);

export async function initStudioUI() {
    const generateBtn = document.getElementById('generate-btn');
    const nicheInput = document.getElementById('niche-input');

    // تم إيقاف الاعتماد على Fal.ai واستبداله بموديل FLUX المدمج

    if (generateBtn && nicheInput) {
        generateBtn.addEventListener('click', async () => {
            const niche = nicheInput.value.trim();
            if (!niche) {
                alert("الرجاء إدخال اسم النيش لتبدأ السحر!");
                return;
            }


            await startDesignGeneration(niche);
        });

        nicheInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                generateBtn.click();
            }
        });
    }
}

// التشغيل التلقائي عند التحديث (بدون الحاجة لترقيع popup.js)
document.addEventListener('DOMContentLoaded', () => {
    initStudioUI();
});
