// popup_new.js - MerchGhost Local-only Dashboard
// يتصل بـ chrome.storage.local ويعرض البيانات محلياً

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 MerchGhost Dashboard Loaded');
  loadLocalStats();

  // زر تحديث البيانات
  document.getElementById('fetch-now').addEventListener('click', () => {
    startManualFetch();
  });

  // زر النسخة الاحتياطية
  document.getElementById('export-btn').addEventListener('click', () => {
    exportDataLocally();
  });

  // إعداد تبويبات الواجهة (Tabs)
  const tabs = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });

  // أزرار التبديل (Toggle Switches) لأدوات البحث
  const amzToggle = document.getElementById('amazon-tools-toggle');
  const tpToggle = document.getElementById('teepublic-tools-toggle');

  if(amzToggle) {
    chrome.storage.local.get(['amazonToolsEnabled'], (res) => {
      amzToggle.checked = res.amazonToolsEnabled !== false; // افتراضي true
    });
    amzToggle.addEventListener('change', (e) => {
      chrome.storage.local.set({amazonToolsEnabled: e.target.checked});
    });
  }

  if(tpToggle) {
    chrome.storage.local.get(['tpToolsEnabled'], (res) => {
      tpToggle.checked = res.tpToolsEnabled !== false; // افتراضي true
    });
    tpToggle.addEventListener('change', (e) => {
      chrome.storage.local.set({tpToolsEnabled: e.target.checked});
    });
  }

  // وضع لقطة الشاشة (Screenshot Mode)
  const screenshotToggle = document.getElementById('screenshot-mode');
  if (screenshotToggle) {
    screenshotToggle.addEventListener('change', (e) => {
      document.body.classList.toggle('blur-mode', e.target.checked);
    });
  }

  // فتح صفحة إدارة الرفع
  document.getElementById('manage-uploads-btn').addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('modules/merchghost/uploader.html')
    });
  });
});

// تحميل البيانات من التخزين المحلي
async function loadLocalStats() {
  const data = await chrome.storage.local.get(['localSalesData', 'localWorksData', 'artistMetrics', 'accountTier']);

  // تحديث الأرقام الرئيسية
  const sales = data.localSalesData || [];
  const works = data.localWorksData || [];
  const metrics = data.artistMetrics || { followers: 0, favorites: 0 };
  const tier = data.accountTier || 'Standard';

  document.getElementById('total-sales').textContent = sales.length.toLocaleString();

  // حساب إجمالي الأرباح
  const totalProfit = sales.reduce((sum, sale) => sum + (sale.artistMargin || 0), 0);
  document.getElementById('net-profit').textContent = `$${totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  document.getElementById('total-followers').textContent = metrics.followers.toLocaleString();
  document.getElementById('total-designs').textContent = (works.length || sales.length).toLocaleString();
  document.getElementById('account-tier').textContent = tier;

  // تحديث قائمة المبيعات الأخيرة
  renderRecentSales(sales);
}

// عرض قائمة المبيعات
function renderRecentSales(sales) {
  const container = document.getElementById('recent-sales-list');
  if (sales.length === 0) {
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-dim);"><p>لا توجد مبيعات مكتشفة حالياً</p></div>';
    return;
  }

  // أول 10 مبيعات فقط
  const recent = sales.slice(0, 10);
  container.innerHTML = '';

  recent.forEach(sale => {
    const item = document.createElement('div');
    item.className = 'sale-item';

    // استخدام thumbnailUrl إذا وجد في البيانات أو أيقونة افتراضية
    const thumbUrl = sale.thumbnailUrl || 'assets/icon.png';

    item.innerHTML = `
      <img src="${thumbUrl}" class="sale-thumb" onerror="this.src='assets/icon.png'">
      <div class="sale-details">
        <div class="sale-title sensitive-data" title="${sale.workTitle}">${sale.workTitle}</div>
        <div class="sale-meta">${sale.orderDate} • ${sale.product}</div>
      </div>
      <div class="sale-profit sensitive-data">+$${sale.artistMargin.toFixed(2)}</div>
    `;
    container.appendChild(item);
  });
}

// بدء جلب البيانات يدوياً عبر Offscreen Document
async function startManualFetch() {
  const btn = document.getElementById('fetch-now');
  const span = btn.querySelector('span:last-child');
  const icon = btn.querySelector('.icon');

  // تغيير حالة الزر
  btn.disabled = true;
  span.textContent = 'جاري التحديث...';
  icon.classList.add('animate-spin'); // تأكد من إضافة css لـ spin لاحقاً

  try {
    // 1. التأكد من وجود Offscreen Document
    await chrome.runtime.sendMessage({ action: 'setup-merchghost-offscreen' });

    // 2. طلب جلب المبيعات من Offscreen
    // ملاحظة: الرابط يجب أن يكون حساب ريدبابل الخاص بالمستخدم
    const rbSalesUrl = 'https://www.redbubble.com/portfolio/manage_payments?page=1';

    console.log('📡 جاري مراسلة Offscreen لجلب البيانات...');
    const response = await chrome.runtime.sendMessage({
      target: 'offscreen',
      action: 'fetch-and-extract-sales',
      data: { url: rbSalesUrl }
    });

    if (response && response.success) {
      // 3. إرسال البيانات للـ background ليقوم بحفظها
      chrome.runtime.sendMessage({
        action: 'save-sales-data',
        data: response.data
      });

      // 4. جلب ملخص الأعمال أيضاً
      const rbWorksUrl = 'https://www.redbubble.com/portfolio/images?page=1';
      const worksRes = await chrome.runtime.sendMessage({
        target: 'offscreen',
        action: 'fetch-and-extract-manage-works',
        data: { url: rbWorksUrl }
      });

      if (worksRes && worksRes.success) {
        chrome.runtime.sendMessage({ action: 'save-works-summary', data: worksRes.data });
        if (worksRes.artistMetrics) {
          chrome.runtime.sendMessage({ action: 'save-artist-metrics', data: worksRes.artistMetrics });
        }
      }

      // 5. جلب Tier
      const accountRes = await chrome.runtime.sendMessage({
        target: 'offscreen',
        action: 'fetch-and-extract-tier',
        data: { url: 'https://www.redbubble.com/artist-dashboard' }
      });
      if (accountRes && accountRes.success) {
        chrome.runtime.sendMessage({ action: 'save-account-tier', data: accountRes.data });
      }

      // تحديث الواجهة بعد وقت قصير للسماح بالحفظ
      setTimeout(() => {
        loadLocalStats();
        btn.disabled = false;
        span.textContent = 'تحديث البيانات';
        icon.classList.remove('animate-spin');
        showToast('✅ تم تحديث البيانات بنجاح!');
      }, 1000);

    } else {
      throw new Error(response.error || 'فشل الجلب من ريدبابل');
    }
  } catch (err) {
    console.error('❌ خطأ في الجلب:', err);
    btn.disabled = false;
    span.textContent = 'تحديث البيانات';
    icon.classList.remove('animate-spin');
    showToast('❌ تأكد من تسجيل دخولك في Redbubble أولاً');
  }
}

// دالة تصدير بيانات JSON احتياطية
function exportDataLocally() {
  chrome.storage.local.get(['localSalesData', 'localWorksData', 'artistMetrics', 'accountTier'], function (result) {
    const dataStr = JSON.stringify(result, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `MerchGhost_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('📁 تم تصدير النسخة الاحتياطية بنجاح');
  });
}

// نظام تنبيهات بسيط (Toast)
function showToast(msg) {
  let toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #1e293b;
    border: 1px solid var(--primary);
    color: white;
    padding: 10px 20px;
    border-radius: 20px;
    font-size: 13px;
    z-index: 1000;
    box-shadow: 0 5px 15px rgba(0,0,0,0.5);
    animation: fadeIn 0.3s;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
