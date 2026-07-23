// Helper: Debounce
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function parseNiches(id) {
  return document.getElementById(id).value
    .split(/[
,]+/)
    .map(n => n.trim())
    .filter(n => n.length > 0);
}

function renderList(arr, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!arr || arr.length === 0) {
    el.innerHTML = '<div class="empty-msg">لا توجد نتائج</div>';
    return;
  }

  el.innerHTML = '';
  arr.forEach((n, i) => {
    const div = document.createElement('div');
    div.className = 'card-item animate-scale-in';
    div.title = n;

    let badge = '';
    if (containerId === 'u-safeList') badge = '<span style="background:var(--safe); color:#fff; font-size:8px; padding:1px 4px; border-radius:4px; margin-left:6px; font-weight:700;">SAFE</span>';
    if (containerId === 'u-bannedList') badge = '<span style="background:var(--banned); color:#fff; font-size:8px; padding:1px 4px; border-radius:4px; margin-left:6px; font-weight:700;">BANNED</span>';
    if (containerId === 'tp-excelList') badge = '<span style="background:var(--safe); color:#fff; font-size:8px; padding:1px 4px; border-radius:4px; margin-left:6px; font-weight:700;">EXCELLENT</span>';
    if (containerId === 'tp-medList') badge = '<span style="background:var(--warning); color:#fff; font-size:8px; padding:1px 4px; border-radius:4px; margin-left:6px; font-weight:700;">AVERAGE</span>';

    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${i + 1}. ${n}</span>
        ${badge}
      </div>
    `;

    div.addEventListener('click', () => {
      navigator.clipboard.writeText(n).then(() => showToast(`✅ تم نسخ: ${n}`));
    });
    el.appendChild(div);
  });
  // Auto-scroll to bottom of list to see newest results if scrolling
  el.scrollTop = el.scrollHeight;
}

function exportTxt(data, filename) {
  const content = Array.isArray(data) ? data.join('
') : data;
  if (!content) { showToast('⚠️ لا توجد بيانات للتصدير'); return; }
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  showToast('📥 تم التصدير بنجاح!');
}

function copyList(storageKey, label) {
  chrome.storage.local.get(storageKey, d => {
    const arr = d[storageKey] || [];
    if (!arr.length) { showToast('⚠️ القائمة فارغة'); return; }
    navigator.clipboard.writeText(arr.join('
'))
      .then(() => showToast(`✅ تم نسخ ${label} !`));
  });
}

function formatNiches(inputId, countId) {
  const el = document.getElementById(inputId);
  if (!el) return;

  let text = el.value;

  // الخطوة 1: فصل الكلمات الملصقة على أساس CamelCase
  // مثال: "Usa HockeyJack" → "Usa Hockey
Jack"
  text = text.replace(/([a-z])([A-Z])/g, '$1
$2');

  // الخطوة 2: تنظيف الفراغات المتعددة داخل كل سطر
  const lines = text.split('
')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  // الخطوة 3: إزالة التكرار مع الحفاظ على الترتيب
  const seen = new Set();
  const unique = lines.filter(line => {
    const key = line.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  el.value = unique.join('
');
  el.dispatchEvent(new Event('input'));
  document.getElementById(countId).textContent = unique.length;
  showToast(`✅ تم تنظيم ${unique.length} نيتش!`);
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });
}
