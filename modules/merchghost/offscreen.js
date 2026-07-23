// Offscreen Document - لجلب البيانات بدون فتح تبويبات

console.log('✅ Offscreen document تم تحميله بنجاح');

// استماع للرسائل من background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') {
    return false;
  }
  
  // معالجة ping للتحقق من وجود offscreen document
  if (message.action === 'ping') {
    sendResponse({ success: true, pong: true });
    return true;
  }
  
  console.log('📨 استلام رسالة في offscreen:', message.action);
  
  handleMessage(message.action, message.data)
    .then(result => {
      console.log('✅ نجحت العملية:', message.action);
      // ⚡ إذا كان result يحتوي على data و artistMetrics، إرسالهما بشكل منفصل
      if (result && typeof result === 'object' && 'data' in result && 'artistMetrics' in result) {
        sendResponse({ success: true, data: result.data, artistMetrics: result.artistMetrics });
      } else {
      sendResponse({ success: true, data: result });
      }
    })
    .catch(error => {
      console.error('❌ خطأ في offscreen:', message.action, error);
      sendResponse({ success: false, error: error.message });
    });
  
  return true; // للإبقاء على القناة مفتوحة للاستجابة غير المتزامنة
});

// معالجة الرسائل
async function handleMessage(action, data) {
  switch (action) {
    case 'fetch-and-extract-sales':
      return await fetchAndExtractSales(data.url);
    
    case 'fetch-and-extract-works-summary':
      return await fetchAndExtractWorksSummary(data.url);
    
    case 'fetch-and-extract-manage-works':
      return await fetchAndExtractManageWorks(data.url);
    
    case 'fetchHTML':
      return await fetchHTML(data.url);
    
    case 'extractPricing':
      return await fetchAndExtractPricing(data.url);
    
    case 'fetch-and-extract-tier':
      return await fetchAndExtractTier(data.url);
    
    case 'play-sound':
      console.log('🔊 [OFFSCREEN] استلام رسالة play-sound')
      console.log('🔊 [OFFSCREEN] soundUrl:', data.soundUrl)
      playSound(data.soundUrl);
      return { success: true };
    
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// تشغيل الصوت
function playSound(soundUrl) {
  console.log('🔊 [OFFSCREEN] بدء playSound - soundUrl:', soundUrl)
  
  try {
    console.log('🔊 [OFFSCREEN] إنشاء Audio object...')
    const audio = new Audio(soundUrl);
    console.log('✅ [OFFSCREEN] تم إنشاء Audio object')
    
    audio.volume = 1;
    console.log('🔊 [OFFSCREEN] ضبط Volume إلى 1')
    
    console.log('🔊 [OFFSCREEN] محاولة تشغيل الصوت...')
    audio.play().then(() => {
      console.log('✅ [OFFSCREEN] تم تشغيل الصوت بنجاح')
    }).catch(error => {
      console.error('❌ [OFFSCREEN] خطأ في تشغيل الصوت:', error);
      console.error('❌ [OFFSCREEN] تفاصيل الخطأ:', JSON.stringify(error, null, 2));
    });
    
    // إضافة event listeners للتتبع
    audio.addEventListener('loadstart', () => {
      console.log('🔊 [OFFSCREEN] Audio: loadstart')
    })
    audio.addEventListener('loadeddata', () => {
      console.log('🔊 [OFFSCREEN] Audio: loadeddata')
    })
    audio.addEventListener('canplay', () => {
      console.log('🔊 [OFFSCREEN] Audio: canplay')
    })
    audio.addEventListener('playing', () => {
      console.log('🔊 [OFFSCREEN] Audio: playing')
    })
    audio.addEventListener('ended', () => {
      console.log('🔊 [OFFSCREEN] Audio: ended')
    })
    audio.addEventListener('error', (e) => {
      console.error('❌ [OFFSCREEN] Audio error event:', e)
      console.error('❌ [OFFSCREEN] Audio error code:', audio.error?.code)
      console.error('❌ [OFFSCREEN] Audio error message:', audio.error?.message)
    })
  } catch (error) {
    console.error('❌ [OFFSCREEN] خطأ عام في playSound:', error);
    console.error('❌ [OFFSCREEN] تفاصيل الخطأ العام:', JSON.stringify(error, null, 2));
  }
  
  console.log('🔊 [OFFSCREEN] انتهاء playSound')
}

// جلب واستخراج المبيعات
async function fetchAndExtractSales(url) {
  try {
    console.log('📥 جلب المبيعات من:', url);
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    if (!html || html.length === 0) {
      throw new Error('Empty response from server');
    }
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const sales = extractSalesFromDOM(doc);
    console.log(`✅ تم استخراج ${sales.length} مبيعة`);
    return sales;
  } catch (error) {
    console.error('❌ خطأ في fetchAndExtractSales:', error);
    throw error;
  }
}

// جلب واستخراج Works Summary
async function fetchAndExtractWorksSummary(url) {
  try {
    console.log('📥 جلب Works Summary من:', url);
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    if (!html || html.length === 0) {
      throw new Error('Empty response from server');
    }
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const works = extractWorksSummaryFromDOM(doc);
    console.log(`✅ تم استخراج ${works.length} work`);
    return works;
  } catch (error) {
    console.error('❌ خطأ في fetchAndExtractWorksSummary:', error);
    throw error;
  }
}

// جلب واستخراج Manage Works
async function fetchAndExtractManageWorks(url) {
  try {
    console.log('📥 جلب Manage Works من:', url);
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    if (!html || html.length === 0) {
      throw new Error('Empty response from server');
    }
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const works = extractManageWorksFromDOM(doc);
    console.log(`✅ تم استخراج ${works.length} work`);
    
    // ⚡ جلب Followers و Favorites من header (فقط من الصفحة الأولى)
    let artistMetrics = null;
    if (url.includes('page=1') || !url.includes('page=')) {
      artistMetrics = extractArtistMetricsFromDOM(doc);
      // artistMetrics دائماً موجود (حتى لو كانت القيم 0)
      if (artistMetrics !== null && artistMetrics !== undefined) {
        console.log(`✅ تم استخراج Artist Metrics: Followers=${artistMetrics.followers}, Favorites=${artistMetrics.favorites}`);
      }
    }
    
    // إرجاع works مع metrics (حتى لو كانت القيم 0)
    if (artistMetrics !== null && artistMetrics !== undefined) {
      return { data: works, artistMetrics: artistMetrics };
    }
    
    return works;
  } catch (error) {
    console.error('❌ خطأ في fetchAndExtractManageWorks:', error);
    throw error;
  }
}

// استخراج المبيعات من DOM
function extractSalesFromDOM(doc) {
  const sales = [];
  const table = doc.querySelector('.sales-table table, table.payments');
  
  if (!table) return sales;
  
  const rows = table.querySelectorAll('tbody tr, tr:not(.total)');
  
  rows.forEach((row, index) => {
    if (row.classList.contains('total')) return;
    
    const cells = row.querySelectorAll('td');
    if (cells.length < 10) return;
    
    try {
      const orderDateText = cells[0]?.textContent?.trim() || '';
      const orderDate = parseDate(orderDateText);
      
      const workLink = cells[2]?.querySelector('a');
      const workTitle = workLink?.textContent?.trim() || '';
      const editUrl = workLink?.href || '';
      // Use extractWorkIdFromUrlForShop which handles both shop URLs and edit URLs
      const workId = extractWorkIdFromUrlForShop(editUrl);
      
      const orderNumber = cells[3]?.textContent?.trim() || '';
      const product = cells[4]?.textContent?.trim() || '';
      const status = cells[8]?.textContent?.trim() || '';
      const qty = parseInt(cells[9]?.textContent?.trim() || '0', 10);
      const retailPriceText = cells[10]?.textContent?.trim() || '';
      const retailPrice = parseCurrency(retailPriceText);
      const marginText = cells[11]?.textContent?.trim() || '';
      const artistMargin = parseCurrency(marginText);
      
      // إنشاء saleId فريد ومستقر (بدون index لأنه قد يتغير)
      // استخدام: orderNumber + workId + product + orderDate + quantity + retailPrice + artistMargin
      // تضمين quantity لضمان التفرد - نفس orderNumber يمكن أن يحتوي على عدة مبيعات بكميات مختلفة
      // استخدام Math.round لتجنب مشاكل toFixed
      const retailPriceRounded = Math.round(retailPrice * 100) / 100;
      const artistMarginRounded = Math.round(artistMargin * 100) / 100;
      const saleId = `${orderNumber}_${workId}_${product}_${orderDate}_${qty}_${retailPriceRounded.toFixed(2)}_${artistMarginRounded.toFixed(2)}`;
      const netProfit = artistMargin;
      
      sales.push({
        saleId: saleId,
        orderNumber: orderNumber,
        orderDate: orderDate,
        workId: workId,
        workTitle: workTitle,
        editUrl: editUrl,
        product: product,
        quantity: qty,
        retailPrice: retailPrice,
        artistMargin: artistMargin,
        netProfit: netProfit,
        status: status,
        isCancelled: status.toLowerCase().includes('cancel') || status.toLowerCase().includes('refund'),
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error('خطأ في استخراج مبيعة:', e);
    }
  });
  
  return sales;
}

// استخراج Works Summary من DOM
function extractWorksSummaryFromDOM(doc) {
  const works = [];
  const table = doc.querySelector('table.payments.summary, table.summary');
  
  if (!table) return works;
  
  const rows = table.querySelectorAll('tbody tr, tr:not(.total)');
  
  rows.forEach((row) => {
    if (row.classList.contains('total')) return;
    
    const cells = row.querySelectorAll('td');
    if (cells.length < 4) return;
    
    try {
      const workLink = cells[0]?.querySelector('a');
      const workTitle = workLink?.textContent?.trim() || '';
      const workUrl = workLink?.href || '';
      const workId = extractWorkIdFromUrlForShop(workUrl);
      
      const qty = parseInt(cells[1]?.textContent?.trim() || '0', 10);
      const marginText = cells[2]?.textContent?.trim() || '';
      const margin = parseCurrency(marginText);
      const taxText = cells[3]?.textContent?.trim() || '';
      const tax = parseCurrency(taxText);
      
      works.push({
        workId: workId,
        workTitle: workTitle,
        workUrl: workUrl,
        totalQuantity: qty,
        totalMargin: margin,
        totalTax: tax
      });
    } catch (e) {
      console.error('خطأ في استخراج Work:', e);
    }
  });
  
  return works;
}

// استخراج Manage Works من DOM - استخراج مباشر بدون JSON parsing
function extractManageWorksFromDOM(doc) {
  const works = [];
  const scripts = doc.querySelectorAll('script');
  
  scripts.forEach(script => {
    const text = script.textContent || '';
    
    if (text.includes('ManageWorksView.works.push')) {
      // استخراج كل WorkView object مباشرة باستخدام regex
      const workMatches = text.match(/ManageWorksView\.works\.push\(new WorkView\(ManageWorksView, \{[\s\S]+?\}\)\)/g);
      
      if (workMatches) {
        workMatches.forEach(match => {
          try {
            // استخراج البيانات مباشرة باستخدام regex patterns بسيطة
            const workIdMatch = match.match(/id:\s*(\d+)/);
            const workId = workIdMatch ? workIdMatch[1] : null;
            
            if (!workId) {
              return; // تخطي إذا لم نجد workId
            }
            
            // استخراج title
            const titleMatch = match.match(/title:\s*"([^"]+)"/);
            const title = titleMatch ? titleMatch[1] : '';
            
            // استخراج url
            const urlMatch = match.match(/url:\s*'([^']+)'/);
            const url = urlMatch ? urlMatch[1] : '';
            
            // استخراج editUrl
            const editUrlMatch = match.match(/editUrl:\s*'([^']+)'/);
            const editUrl = editUrlMatch ? editUrlMatch[1] : '';
            
            // استخراج duplicateUrl
            const duplicateUrlMatch = match.match(/duplicateUrl:\s*'([^']+)'/);
            const duplicateUrl = duplicateUrlMatch ? duplicateUrlMatch[1] : '';
            
            // Log للتحقق من duplicateUrl
            if (workId) {
              if (duplicateUrl) {
                console.log(`✅ تم العثور على duplicateUrl للتصميم ${workId}: ${duplicateUrl}`);
              } else {
                console.log(`⚠️ لم يتم العثور على duplicateUrl للتصميم ${workId} (editUrl: ${editUrl})`);
              }
            }
            
            // استخراج tags
            const tagsMatch = match.match(/tags:\s*'([^']+)'/);
            const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()) : [];
            
            // استخراج stats - استخراج كل حقل بشكل منفصل
            const commentsMatch = match.match(/comments:\s*(-?\d+)/);
            const salesMatch = match.match(/sales:\s*(-?\d+)/);
            const favoritesMatch = match.match(/favorites:\s*(-?\d+)/);
            const stats = {
              comments: commentsMatch ? parseInt(commentsMatch[1]) || 0 : 0,
              sales: salesMatch ? parseInt(salesMatch[1]) || 0 : 0,
              favorites: favoritesMatch ? parseInt(favoritesMatch[1]) || 0 : 0
            };
            
            // استخراج thumbnail URL من workBlock - هذا هو الأهم!
            // workBlock يحتوي على: <img ... src="https://ih0.redbubble.net/image.{workId}.{variantId}/flat,220x200,075,t.jpg" ... />
            const workBlockMatch = match.match(/workBlock:\s*'([^']+)'/);
            let thumbnailUrl = '';
            
            if (workBlockMatch) {
              const workBlock = workBlockMatch[1];
              // استخراج src من img tag
              const imgSrcMatch = workBlock.match(/src="(https?:\/\/ih\d+\.redbubble\.net\/image\.\d+\.\d+\/[^"]+)"/);
              if (imgSrcMatch) {
                thumbnailUrl = imgSrcMatch[1];
              }
            }
            
            // إذا لم نجد من workBlock، جرب البحث في DOM
            if (!thumbnailUrl) {
              const imgTags = doc.querySelectorAll(`img[src*="image.${workId}"]`);
              if (imgTags.length > 0) {
                thumbnailUrl = imgTags[0].getAttribute('src') || '';
              }
            }
            
            const workData = {
              workId: workId.toString(),
              title: title,
              url: url,
              editUrl: editUrl,
              duplicateUrl: duplicateUrl,
              stats: stats,
              thumbnailUrl: thumbnailUrl,
              tags: tags,
              description: '', // سيتم جلبها لاحقاً من صفحة التصميم
              totalQuantity: stats.sales || 0,
              totalMargin: 0,
              totalTax: 0,
              netProfit: 0,
              productsSold: [],
              lastUpdated: new Date().toISOString()
            };
            
            // Log للتحقق من duplicateUrl قبل الإضافة
            if (duplicateUrl) {
              console.log(`✅ [offscreen.js] إضافة التصميم ${workId} مع duplicateUrl: ${duplicateUrl}`);
            } else {
              console.log(`⚠️ [offscreen.js] إضافة التصميم ${workId} بدون duplicateUrl`);
            }
            
            works.push(workData);
          } catch (e) {
            console.error('خطأ في استخراج Work:', e);
          }
        });
      }
    }
  });
  
  return works;
}

// استخراج Followers و Favorites من header
function extractArtistMetricsFromDOM(doc) {
  try {
    // البحث عن Followers
    const followersElement = doc.querySelector('.artist-followers-metric.artist-metric');
    let followers = 0;
    if (followersElement) {
      const followersText = followersElement.textContent || '';
      // استخراج الرقم من النص (مثل "2" من "2")
      const followersMatch = followersText.match(/(\d+)/);
      if (followersMatch) {
        followers = parseInt(followersMatch[1]) || 0;
      }
    }

    // البحث عن Favorites
    const favoritesElement = doc.querySelector('.artist-favorites-metric.artist-metric');
    let favorites = 0;
    if (favoritesElement) {
      const favoritesText = favoritesElement.textContent || '';
      // استخراج الرقم من النص (مثل "313" من "313")
      const favoritesMatch = favoritesText.match(/(\d+)/);
      if (favoritesMatch) {
        favorites = parseInt(favoritesMatch[1]) || 0;
      }
    }

    // إرجاع القيم حتى لو كانت 0 (لأن المستخدم قد يكون لديه 0 followers أو favorites)
    console.log(`✅ [offscreen.js] تم استخراج Artist Metrics: Followers=${followers}, Favorites=${favorites}`);
    return { followers, favorites };
  } catch (error) {
    console.error('❌ [offscreen.js] خطأ في استخراج Artist Metrics:', error);
    return null;
  }
}

// Helper functions
function parseDate(dateText) {
  const parts = dateText.trim().split(' ');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const monthMap = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
      'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    const month = monthMap[parts[1]] || '01';
    const year = '20' + parts[2];
    return `${year}-${month}-${day}`;
  }
  return new Date().toISOString().split('T')[0];
}

function extractWorkIdFromUrl(url) {
  const match = url.match(/\/portfolio\/images\/(\d+)-/);
  return match ? match[1] : '';
}

function extractWorkIdFromUrlForShop(url) {
  const shopMatch = url.match(/\/shop\/ap\/(\d+)/);
  if (shopMatch) return shopMatch[1];
  
  const editMatch = url.match(/\/portfolio\/images\/(\d+)-/);
  return editMatch ? editMatch[1] : '';
}

function parseCurrency(text) {
  const match = text.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

// جلب HTML فقط
async function fetchHTML(url) {
  try {
    console.log('📥 جلب HTML من:', url);
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    if (!html || html.length === 0) {
      throw new Error('Empty response from server');
    }
    
    return html;
  } catch (error) {
    console.error('❌ خطأ في fetchHTML:', error);
    throw error;
  }
}

// جلب واستخراج Product Pricing
async function fetchAndExtractPricing(url) {
  try {
    console.log('📥 جلب Product Pricing من:', url);
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    if (!html || html.length === 0) {
      throw new Error('Empty response from server');
    }
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const pricing = extractProductPricingFromDOM(doc);
    console.log(`✅ تم استخراج ${pricing.length} منتج pricing`);
    return pricing;
  } catch (error) {
    console.error('❌ خطأ في fetchAndExtractPricing:', error);
    throw error;
  }
}

// استخراج Product Pricing من DOM
function extractProductPricingFromDOM(doc) {
  const pricing = [];
  const form = doc.querySelector('form#edit_user_markups_4439387, form[id^="edit_user_markups"]');
  
  if (!form) return pricing;
  
  // Try multiple selectors to find all markup inputs
  let inputs = form.querySelectorAll('input.markup-percentage[data-product]');
  
  // If no inputs found with first selector, try alternative selectors
  if (inputs.length === 0) {
    inputs = form.querySelectorAll('input[data-product][type="text"]');
  }
  
  // If still no inputs, try finding by name pattern
  if (inputs.length === 0) {
    inputs = form.querySelectorAll('input[name^="user_markups["]');
  }
  
  inputs.forEach((input) => {
    try {
      // Try to get product name from data-product attribute first
      let productName = input.getAttribute('data-product') || '';
      
      // If no data-product, try to extract from name attribute
      if (!productName) {
        const nameAttr = input.getAttribute('name') || '';
        const match = nameAttr.match(/user_markups\[([^\]]+)\]/);
        if (match) {
          productName = match[1];
        }
      }
      
      const markupValue = parseFloat(input.value) || 0;
      
      if (productName) {
        pricing.push({
          productName: productName,
          markup: markupValue,
          timestamp: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error('خطأ في استخراج pricing:', e);
    }
  });
  
  return pricing;
}

// جلب واستخراج Tier
async function fetchAndExtractTier(url) {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const html = await response.text();
  if (!html || html.length === 0) {
    throw new Error('Empty response from server');
  }
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  return extractTierFromDOM(doc);
}

// استخراج Tier من DOM
function extractTierFromDOM(doc) {
  const calloutDiv = doc.querySelector('.artist-account-tiers-callout');
  if (calloutDiv) {
    const calloutText = calloutDiv.textContent || '';
    
    if (calloutText.match(/Standardkonto|Standard\s+account|Standard\s+konto|compte.*Standard/i)) {
      return 'Standard';
    }
    if (calloutText.match(/Premiumkonto|Premium\s+account|Premium\s+konto|compte.*Premium/i)) {
      return 'Premium';
    }
    if (calloutText.match(/Prokonto|Pro\s+account|Pro\s+konto|compte.*Pro/i)) {
      return 'Pro';
    }
    
    const boldTag = calloutDiv.querySelector('b');
    if (boldTag) {
      const boldText = boldTag.textContent || '';
      if (boldText.match(/Standard/i)) {
        return 'Standard';
      }
      if (boldText.match(/Premium/i)) {
        return 'Premium';
      }
      if (boldText.match(/Pro/i) && !boldText.match(/Premium|Standard/i)) {
        return 'Pro';
      }
    }
  }
  
  const tierTable = doc.querySelector('table.tier-table');
  if (tierTable) {
    const tableClass = tierTable.className || '';
    if (tableClass.includes('standard')) {
      return 'Standard';
    }
    if (tableClass.includes('premium')) {
      return 'Premium';
    }
    if (tableClass.includes('pro')) {
      return 'Pro';
    }
  }
  
  return 'Unknown';
}
