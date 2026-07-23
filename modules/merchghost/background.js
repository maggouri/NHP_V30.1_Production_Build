// background.js - MerchGhost Local-only
// يدير جلب البيانات وحفظها محلياً في المتصفح

console.log('👻 MerchGhost Background Service Worker بدأت بنجاح');

// إعداد التخزين المحلي والتحقق من الأذونات
chrome.runtime.onInstalled.addListener(() => {
  console.log('✅ تم تثبيت MerchGhost بنجاح');
  initializeStorage();
});

// تهيئة التخزين إذا لم يكن موجوداً
async function initializeStorage() {
  const result = await chrome.storage.local.get(['localSalesData', 'localWorksData', 'artistMetrics', 'accountTier']);
  if (!result.localSalesData) await chrome.storage.local.set({ localSalesData: [] });
  if (!result.localWorksData) await chrome.storage.local.set({ localWorksData: [] });
  if (!result.artistMetrics) await chrome.storage.local.set({ artistMetrics: { followers: 0, favorites: 0 } });
  if (!result.accountTier) await chrome.storage.local.set({ accountTier: 'Unknown' });
  console.log('📂 تم تهيئة التخزين المحلي بنجاح');
}

// الاستماع للرسائل من الواجهة أو Offscreen
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'save-sales-data') {
    handleSaveSalesData(message.data);
    return true;
  }

  if (message.action === 'save-works-summary') {
    handleSaveWorksSummary(message.data);
    return true;
  }

  if (message.action === 'save-artist-metrics') {
    chrome.storage.local.set({ 'artistMetrics': message.data }, () => {
      console.log('✅ تم حفظ إحصائيات الفنان محلياً');
    });
    return true;
  }

  if (message.action === 'save-account-tier') {
    chrome.storage.local.set({ 'accountTier': message.data }, () => {
      console.log('✅ تم حفظ مرتبة الحساب:', message.data);
    });
    return true;
  }
});

// دالة لدمج المبيعات وتجنب التكرار
function handleSaveSalesData(newSales) {
  chrome.storage.local.get(['localSalesData'], (result) => {
    let existingSales = result.localSalesData || [];

    // دمج المبيعات الجديدة (استخدام saleId كمعرف فريد)
    const existingIds = new Set(existingSales.map(s => s.saleId));
    const mergedSales = [...existingSales];

    let addedCount = 0;
    newSales.forEach(sale => {
      if (!existingIds.has(sale.saleId)) {
        mergedSales.push(sale);
        existingIds.add(sale.saleId);
        addedCount++;
      }
    });

    // ترتيب المبيعات حسب التاريخ (الأحدث أولاً)
    mergedSales.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));

    chrome.storage.local.set({ 'localSalesData': mergedSales }, () => {
      console.log(`✅ تم حفظ ${addedCount} مبيعة جديدة محلياً. الإجمالي: ${mergedSales.length}`);

      // إبلاغ الواجهة إذا كانت مفتوحة لتحديث العرض
      chrome.runtime.sendMessage({
        action: 'sales-updated',
        addedCount: addedCount,
        totalCount: mergedSales.length
      }).catch(err => {
        // تجاهل الخطأ إذا كانت الواجهة مغلقة
      });
    });
  });
}

// دالة لحفظ ملخص الأعمال
function handleSaveWorksSummary(newWorks) {
  chrome.storage.local.get(['localWorksData'], (result) => {
    // ملخص الأعمال عادة يتم تحديثه بالكامل أو دمجه
    // هنا سنقوم بتحديثه بالكامل لأنه ملخص تراكمي من ريدبابل
    chrome.storage.local.set({ 'localWorksData': newWorks }, () => {
      console.log(`✅ تم تحديث ملخص الأعمال. الإجمالي: ${newWorks.length}`);
    });
  });
}

// إدارة Offscreen Document
async function setupOffscreen() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length > 0) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['DOM_PARSER'],
    justification: 'Parsing Redbubble pages to extract sales data local-only'
  });
}

// تشغيل جلب البيانات دورياً (اختياري)
chrome.alarms.create('check-sales-alarm', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'check-sales-alarm') {
    console.log('⏰ تنبيه: جاري فحص المبيعات دورياً...');
    // هنا يمكن إضافة كود للجلب التلقائي إذا رغب المستخدم
  }
});
