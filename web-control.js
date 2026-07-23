import { initTrendModule } from './modules/trend.js';
import { initNoteModule } from './modules/note/note.js';

function showToast(message) {
  const toast = document.getElementById('web-toast');
  if (!toast) return;
  toast.textContent = message || '';
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}

function noopSwitchTab() {}
let noteInitialized = false;

function syncViewportHeight() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--app-vh', `${vh}px`);
}

const SECTION_META = {
  'section-trend': {
    title: 'Trend Dashboard',
    sub: 'مربوط مباشرة بمنطق الإضافة الحالي'
  },
  'section-studio': {
    title: 'Studio (Coming Next)',
    sub: 'هيكل جاهز للربط التدريجي'
  },
  'section-tm-search': {
    title: 'TM SEARCH HUB',
    sub: 'TMHUNT + USPTO + ANALYSIS'
  },
  'section-note': {
    title: 'Note',
    sub: 'واجهة Note الداخلية'
  },
  'section-uspto': {
    title: 'USPTO',
    sub: 'واجهة ويب جاهزة للتفعيل'
  },
  'section-teepublic': {
    title: 'TeePublic',
    sub: 'واجهة ويب جاهزة للتفعيل'
  },
  'section-seo': {
    title: 'SEO',
    sub: 'واجهة ويب جاهزة للتفعيل'
  },
  'section-autopilot': {
    title: 'Autopilot',
    sub: 'واجهة ويب جاهزة للتفعيل'
  },
  'section-social': {
    title: 'Social+',
    sub: 'واجهة ويب جاهزة للتفعيل'
  }
};

function activateSection(sectionId) {
  const sections = document.querySelectorAll('.section');
  sections.forEach((section) => {
    section.classList.toggle('active', section.id === sectionId);
  });

  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.section === sectionId);
  });

  const titleEl = document.getElementById('active-section-title');
  const subEl = document.getElementById('active-section-sub');
  const meta = SECTION_META[sectionId] || SECTION_META['section-trend'];
  if (titleEl) titleEl.textContent = meta.title;
  if (subEl) subEl.textContent = meta.sub;

  if (sectionId === 'section-note') {
    initRealNoteSection();
  }
}

function initSectionNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const sectionId = btn.dataset.section;
      activateSection(sectionId);
      if (sectionId !== 'section-trend') {
        showToast('هذا القسم جاهز للربط وسنفعله تدريجيًا.');
      }
    });
  });
}

function loadTMSearchInternal(tabName, label) {
  const allowed = ['tmh', 'uspto', 'teepublic'];
  if (!allowed.includes(tabName)) return;
  const frame = document.getElementById('tm-search-frame');
  const placeholder = document.getElementById('tm-embedded-placeholder');
  if (!frame) return;

  const target = chrome.runtime.getURL(`popup.html?mode=tab&tab=${tabName}`);
  frame.src = target;
  frame.classList.remove('hidden');
  if (placeholder) placeholder.classList.add('hidden');

  chrome.storage.local.set({ activeTab: tabName });
  showToast(`تم تحميل ${label} داخل TM SEARCH.`);
}

function initTMSearchActions() {
  const map = [
    ['tm-open-tmhunt', 'tmh', 'TMHUNT'],
    ['tm-open-uspto', 'uspto', 'USPTO'],
    ['tm-open-analysis', 'teepublic', 'ANALYSIS']
  ];

  map.forEach(([id, tabName, label]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', () => {
      loadTMSearchInternal(tabName, label);
    });
  });
}

function initRealNoteSection() {
  if (typeof initNoteModule !== 'function') {
    showToast('تعذر تحميل وحدة Note.');
    return;
  }

  initNoteModule({
    showToast,
    switchTab: (tabName) => {
      if (tabName === 'lab') {
        showToast('قسم Lab سيتم نقله لاحقًا، تم حفظ الطلب.');
      }
    }
  });

  chrome.storage.local.set({ activeTab: 'note' });
  if (!noteInitialized) {
    showToast('تم نقل Note نقلا حقيقيا داخل صفحة الويب.');
    noteInitialized = true;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  syncViewportHeight();
  window.addEventListener('resize', syncViewportHeight, { passive: true });

  initSectionNavigation();
  initTMSearchActions();
  const hash = (window.location.hash || '').replace('#', '');
  if (hash && document.getElementById(hash)) {
    activateSection(hash);
  } else {
    activateSection('section-trend');
  }

  if (typeof initTrendModule !== 'function') {
    showToast('تعذر تحميل وحدة Trend.');
    return;
  }

  initTrendModule(showToast, noopSwitchTab);
  showToast('تم ربط واجهة الويب بالإضافة بنجاح.');
});
