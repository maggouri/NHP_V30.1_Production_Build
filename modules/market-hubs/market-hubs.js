const STORAGE_KEYS = [
  'savedDesignQueue',
  'ap_accounts',
  'localSalesData',
  'localWorksData',
  'accountTier',
  'amazonToolsEnabled'
];

const HUBS = {
  redbubble: {
    prefix: 'rbh',
    uploaderUrl: 'modules/merchghost/uploader.html?platform=redbubble',
    platformUrl: 'https://www.redbubble.com/portfolio/images',
    readinessBase: 20,
    name: 'Redbubble'
  },
  amazon: {
    prefix: 'amh',
    uploaderUrl: 'modules/merchghost/uploader.html?platform=amazon',
    platformUrl: 'https://merch.amazon.com/designs/new',
    readinessBase: 25,
    name: 'Amazon'
  }
};

const hubState = {
  redbubble: { activeId: null, syncing: false, initialized: false, queueFp: '', statsFp: '' },
  amazon: { activeId: null, syncing: false, initialized: false, queueFp: '', statsFp: '' }
};
const isLowSpecModeEnabled = () => !!window.NHP_IS_LIGHT_MODE || !!window.NHP_LOW_SPEC_MODE;
const HUB_QUEUE_CAP_LOW = 80;
const HUB_QUEUE_CAP_DEFAULT = 120;

function isHubPanelActive(platform) {
  return !!document.getElementById(`panel-${platform}`)?.classList.contains('active');
}

function buildHubQueueFingerprint(platform, queue, activeId) {
  const capped = (Array.isArray(queue) ? queue : []).slice(0, 48);
  return [
    platform,
    capped.length,
    activeId || '',
    capped.map((item) => `${item.id}:${item.status || ''}`).join('|')
  ].join('::');
}

function buildHubStatsFingerprint(platform, data) {
  if (platform === 'redbubble') {
    const accounts = getAccountsForPlatform(data.ap_accounts, 'redbubble').length;
    const queueCount = (data.savedDesignQueue || []).length;
    const worksCount = (data.localWorksData || []).length;
    const salesCount = (data.localSalesData || []).length;
    return `${accounts}|${queueCount}|${worksCount}|${salesCount}|${data.accountTier || ''}`;
  }
  const accounts = getAccountsForPlatform(data.ap_accounts, 'amazon').length;
  const queueCount = (data.savedDesignQueue || []).length;
  return `${accounts}|${queueCount}|${data.amazonToolsEnabled !== false ? 1 : 0}`;
}

const formatCount = (value) => new Intl.NumberFormat('ar-MA').format(Number(value || 0));

function normalizePlatform(platform) {
  return String(platform || '').trim().toLowerCase();
}

function getAccountsForPlatform(accounts, platform) {
  return (accounts || []).filter((account) => normalizePlatform(account.platform) === platform);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setWidth(id, value) {
  const element = document.getElementById(id);
  if (element) element.style.width = `${value}%`;
}

function attachButton(id, handler) {
  const element = document.getElementById(id);
  if (!element || element.dataset.bound === '1') return;
  element.dataset.bound = '1';
  element.addEventListener('click', handler);
}

function openExtensionTab(url) {
  chrome.tabs.create({ url: chrome.runtime.getURL(url) });
}

function openExternalTab(url) {
  chrome.tabs.create({ url });
}

function getSelectors(prefix) {
  return {
    queueContainer: document.getElementById(`${prefix}-queue-container`),
    queue: document.getElementById(`${prefix}-queue`),
    sharedQueueCount: document.getElementById(`${prefix}-shared-queue-count`),
    previewPanel: document.getElementById(`${prefix}-seo-preview`),
    previewImg: document.getElementById(`${prefix}-img-preview`),
    previewFilename: document.getElementById(`${prefix}-current-filename`),
    title: document.getElementById(`${prefix}-seo-title`),
    mainTag: document.getElementById(`${prefix}-seo-main-tag`),
    tags: document.getElementById(`${prefix}-seo-tags`),
    desc: document.getElementById(`${prefix}-seo-desc`)
  };
}

function getQueueItemFileName(item) {
  return item?.file?.name || 'design.png';
}

function getQueueItemImage(item) {
  if (!item) return 'icon.png';
  return item.thumbnail || (item.base64 ? `data:image/png;base64,${item.base64}` : 'icon.png');
}

function getMetaFromInputs(selectors) {
  return {
    title: selectors.title?.value?.trim() || '',
    main_tag: selectors.mainTag?.value?.trim() || '',
    tags: (selectors.tags?.value || '').split(',').map((tag) => tag.trim()).filter(Boolean),
    description: selectors.desc?.value?.trim() || '',
    score: '100',
    risk: 'Low'
  };
}

function renderSharedQueue(platform, context, options = {}) {
  const { prefix } = HUBS[platform];
  const state = hubState[platform];
  const selectors = getSelectors(prefix);
  const queue = context.getDesignQueue();
  const cap = isLowSpecModeEnabled() ? HUB_QUEUE_CAP_LOW : HUB_QUEUE_CAP_DEFAULT;
  const visibleQueue = queue.slice(0, cap);

  if (!selectors.queue) return;

  const countEl = document.getElementById(`${prefix}-shared-queue-count`);
  if (countEl) countEl.textContent = `${queue.length} ملفات`;

  if (!isHubPanelActive(platform) && !options.force) return;

  const fp = buildHubQueueFingerprint(platform, visibleQueue, state.activeId);
  if (!options.force && fp === state.queueFp) return;
  state.queueFp = fp;

  if (queue.length === 0) {
    selectors.queue.innerHTML = '';
    selectors.queueContainer?.classList.add('hidden');
    selectors.previewPanel?.classList.add('hidden');
    state.activeId = null;
    return;
  }

  selectors.queueContainer?.classList.remove('hidden');

  if (!state.activeId || !visibleQueue.some((item) => item.id === state.activeId)) {
    state.activeId = visibleQueue[0].id;
  }

  selectors.queue.innerHTML = visibleQueue.map((item) => `
    <div class="queue-item ${item.status === 'done' ? 'done' : ''} ${item.status === 'synced' ? 'synced' : ''} ${item.status === 'loading' ? 'loading' : ''} ${item.id === state.activeId ? 'active' : ''}"
         data-id="${item.id}" title="${getQueueItemFileName(item)}">
      <img src="${getQueueItemImage(item)}" loading="lazy">
      ${item.status === 'loading' ? '<div class="absolute inset-0 flex items-center justify-center bg-black/40"><div class="spinner-small" style="width:12px; height:12px;"></div></div>' : ' '}
      <button data-remove-id="${item.id}" class="remove-btn"
              style="position:absolute; top:0; left:0; background:rgba(239, 68, 68, 0.8); color:white; border:none; width:14px; height:14px; font-size:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; border-radius:0 0 4px 0;">✕</button>
    </div>
  `).join('');

  updateSharedPreview(platform, context);
}

function updateSharedPreview(platform, context) {
  const { prefix } = HUBS[platform];
  const state = hubState[platform];
  const selectors = getSelectors(prefix);
  const queue = context.getDesignQueue();
  const visibleQueue = isLowSpecModeEnabled() ? queue.slice(0, 120) : queue;
  const item = visibleQueue.find((entry) => entry.id === state.activeId);

  if (!item) {
    selectors.previewPanel?.classList.add('hidden');
    return;
  }

  state.syncing = true;

  if (selectors.previewImg) selectors.previewImg.src = getQueueItemImage(item);
  if (selectors.previewFilename) selectors.previewFilename.textContent = getQueueItemFileName(item);
  if (selectors.title) selectors.title.value = item.meta?.title || '';
  if (selectors.mainTag) selectors.mainTag.value = item.meta?.main_tag || '';
  if (selectors.tags) selectors.tags.value = Array.isArray(item.meta?.tags) ? item.meta.tags.join(', ') : (item.meta?.tags || '');
  if (selectors.desc) selectors.desc.value = item.meta?.description || '';
  selectors.previewPanel?.classList.remove('hidden');

  state.syncing = false;
}

function saveSharedMeta(platform, context, { applyToAll = false } = {}) {
  const { prefix, name } = HUBS[platform];
  const state = hubState[platform];
  const selectors = getSelectors(prefix);

  if (state.syncing) return;

  const queue = context.getDesignQueue();
  if (!queue.length) return;

  const meta = getMetaFromInputs(selectors);
  if (!meta.title) return;

  if (applyToAll) {
    queue.forEach((item) => {
      item.meta = { ...meta };
      item.status = 'done';
    });
    context.renderQueue();
    context.saveQueueToStorage();
    context.showToast(`تم نسخ SEO إلى كل تصاميم ${name}`);
    renderSharedQueue(platform, context);
    return;
  }

  const item = queue.find((entry) => entry.id === state.activeId);
  if (!item) return;

  item.meta = { ...meta };
  item.status = 'done';
  context.renderQueue();
  context.saveQueueToStorage();
}

function bindQueueInteractions(platform, context) {
  const { prefix, name } = HUBS[platform];
  const state = hubState[platform];
  const selectors = getSelectors(prefix);

  if (selectors.queue && selectors.queue.dataset.bound !== '1') {
    selectors.queue.dataset.bound = '1';
    selectors.queue.addEventListener('click', (event) => {
      const removeButton = event.target.closest('.remove-btn');
      if (removeButton) {
        event.stopPropagation();
        const removeId = removeButton.getAttribute('data-remove-id');
        if (!removeId) return;

        if (typeof context.removeFromQueue === 'function') {
          context.removeFromQueue(removeId);
        } else {
          const nextQueue = context.getDesignQueue().filter((item) => item.id !== removeId);
          context.setDesignQueue(nextQueue);
          context.renderQueue();
          context.saveQueueToStorage(true);
        }

        if (state.activeId === removeId) {
          const nextItem = context.getDesignQueue()[0];
          state.activeId = nextItem ? nextItem.id : null;
        }

        renderSharedQueue(platform, context);
        context.showToast(`تم حذف التصميم من طابور ${name}`);
        return;
      }

      const queueItem = event.target.closest('.queue-item');
      if (!queueItem) return;
      const id = queueItem.getAttribute('data-id');
      if (!id) return;
      state.activeId = id;
      renderSharedQueue(platform, context);
      if (typeof context.showDesignPreview === 'function') {
        context.showDesignPreview(id);
      }
    });
  }

  [selectors.title, selectors.mainTag, selectors.tags, selectors.desc].forEach((field) => {
    if (!field || field.dataset.bound === '1') return;
    field.dataset.bound = '1';
    field.addEventListener('input', () => saveSharedMeta(platform, context));
  });

  attachButton(`${prefix}-apply-all`, () => saveSharedMeta(platform, context, { applyToAll: true }));

  attachButton(`${prefix}-open-seo`, () => {
    context.switchTab('seo');
    context.showToast(`تم فتح SEO لمتابعة تحرير بيانات ${name}`);
  });

  attachButton(`${prefix}-clear-queue-btn`, () => {
    if (!confirm('هل تريد فعلاً مسح طابور التصاميم المشترك؟')) return;
    context.setDesignQueue([]);
    context.renderQueue();
    context.saveQueueToStorage(true);
    renderSharedQueue(platform, context);
    context.showToast('تم مسح الطابور المشترك');
  });
}

function openAutopilotForPlatform(platform, switchTab, showToast) {
  chrome.storage.local.set({ active_platform: platform }, () => {
    switchTab('autopilot');
    setTimeout(() => {
      const select = document.getElementById('ap-platform-select');
      if (select) {
        select.value = platform;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, 250);
    showToast(`تم فتح Autopilot على ${platform === 'redbubble' ? 'Redbubble' : 'Amazon'}`);
  });
}

function bindHubActions(platform, context) {
  const { prefix, uploaderUrl, platformUrl, name } = HUBS[platform];
  const { showToast, switchTab } = context;

  attachButton(`${prefix}-open-uploader`, () => {
    openExtensionTab(uploaderUrl);
    showToast(`تم فتح مدير الرفع الخاص بـ ${name}`);
  });

  attachButton(`${prefix}-open-platform`, () => {
    openExternalTab(platformUrl);
    showToast(`تم فتح صفحة ${name}`);
  });

  attachButton(`${prefix}-open-autopilot`, () => {
    openAutopilotForPlatform(platform, switchTab, showToast);
  });
}

function updateRedbubbleHub(data, options = {}) {
  if (!isHubPanelActive('redbubble') && !options.force) return;
  const fp = buildHubStatsFingerprint('redbubble', data);
  if (!options.force && fp === hubState.redbubble.statsFp) return;
  hubState.redbubble.statsFp = fp;

  const accounts = getAccountsForPlatform(data.ap_accounts, 'redbubble').length;
  const queueCount = (data.savedDesignQueue || []).length;
  const worksCount = (data.localWorksData || []).length;
  const salesCount = (data.localSalesData || []).length;
  const tier = data.accountTier || 'Standard';
  const readiness = Math.min(100, HUBS.redbubble.readinessBase + (accounts > 0 ? 35 : 0) + (queueCount > 0 ? 35 : 0) + (worksCount > 0 || salesCount > 0 ? 10 : 0));

  setText('rbh-accounts-count', formatCount(accounts));
  setText('rbh-queue-count', formatCount(queueCount));
  setText('rbh-works-count', formatCount(worksCount));
  setText('rbh-sales-count', formatCount(salesCount));
  setText('rbh-current-badge', `${formatCount(accounts)} حسابات`);
  setText('rbh-readiness-label', `${readiness}%`);
  setWidth('rbh-readiness-fill', readiness);
  setText('rbh-tier', `Tier: ${tier}`);
}

function updateAmazonHub(data, options = {}) {
  if (!isHubPanelActive('amazon') && !options.force) return;
  const fp = buildHubStatsFingerprint('amazon', data);
  if (!options.force && fp === hubState.amazon.statsFp) return;
  hubState.amazon.statsFp = fp;

  const accounts = getAccountsForPlatform(data.ap_accounts, 'amazon').length;
  const queueCount = (data.savedDesignQueue || []).length;
  const toolsEnabled = data.amazonToolsEnabled !== false;
  const readiness = Math.min(100, HUBS.amazon.readinessBase + (accounts > 0 ? 35 : 0) + (queueCount > 0 ? 30 : 0) + (toolsEnabled ? 10 : 0));

  setText('amh-accounts-count', formatCount(accounts));
  setText('amh-queue-count', formatCount(queueCount));
  setText('amh-tools-state', toolsEnabled ? 'ON' : 'OFF');
  setText('amh-current-badge', `${formatCount(accounts)} حسابات`);
  setText('amh-readiness-label', `${readiness}%`);
  setWidth('amh-readiness-fill', readiness);
}

function refreshHubStats(platform, options = {}) {
  if (!isHubPanelActive(platform) && !options.force) return;
  chrome.storage.local.get(STORAGE_KEYS, (data) => {
    if (platform === 'redbubble') {
      updateRedbubbleHub(data, options);
      return;
    }
    updateAmazonHub(data, options);
  });
}

function bindSharedEvents(platform, context) {
  const state = hubState[platform];
  if (state.initialized) return;
  state.initialized = true;

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (!isHubPanelActive(platform)) return;
    if (!Object.keys(changes).some((key) => STORAGE_KEYS.includes(key))) return;
    refreshHubStats(platform);
    hubState[platform].queueFp = '';
    renderSharedQueue(platform, context);
  });

  window.addEventListener('nhp:queue-rendered', () => {
    if (!isHubPanelActive(platform)) return;
    hubState[platform].queueFp = '';
    renderSharedQueue(platform, context);
  });

  window.addEventListener('nhp:design-preview', (event) => {
    if (!isHubPanelActive(platform)) return;
    const previewId = event.detail?.id;
    if (!previewId) return;
    hubState[platform].activeId = previewId;
    updateSharedPreview(platform, context);
    hubState[platform].queueFp = '';
    renderSharedQueue(platform, context);
  });
}

function initHub(platform, context) {
  const panel = document.getElementById(`panel-${platform}`);
  if (!panel) return;

  bindHubActions(platform, context);
  bindQueueInteractions(platform, context);
  bindSharedEvents(platform, context);

  const activate = () => {
    hubState[platform].queueFp = '';
    hubState[platform].statsFp = '';
    refreshHubStats(platform, { force: true });
    renderSharedQueue(platform, context, { force: true });
  };

  if (platform === 'redbubble') {
    window.NHP_activateRedbubbleHubPanel = activate;
  } else {
    window.NHP_activateAmazonHubPanel = activate;
  }

  if (isHubPanelActive(platform)) activate();
}

export function initRedbubbleHubModule(context) {
  if (hubState.redbubble.initialized) {
    if (isHubPanelActive('redbubble') && typeof window.NHP_activateRedbubbleHubPanel === 'function') {
      window.NHP_activateRedbubbleHubPanel();
    }
    return;
  }
  initHub('redbubble', context);
}

export function initAmazonHubModule(context) {
  if (hubState.amazon.initialized) {
    if (isHubPanelActive('amazon') && typeof window.NHP_activateAmazonHubPanel === 'function') {
      window.NHP_activateAmazonHubPanel();
    }
    return;
  }
  initHub('amazon', context);
}
