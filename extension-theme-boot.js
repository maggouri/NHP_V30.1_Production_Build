/**
 * Global UI theme bootstrap for NHP extension pages.
 * Sync key: chrome.storage.sync "theme" → "default" | "neon-gamer"
 * Mirrors to localStorage for fastest first paint on next open.
 */
(function () {
    var SYNC_KEY = 'theme';
    var LS_KEY = 'nhp_extension_theme_v1';

    function normalize(v) {
        return v === 'neon-gamer' ? 'neon-gamer' : 'default';
    }

    function applyDom(theme) {
        var t = normalize(theme);
        if (t === 'neon-gamer') {
            document.documentElement.setAttribute('data-theme', 'neon-gamer');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }

    function persist(theme, cb) {
        var t = normalize(theme);
        try {
            localStorage.setItem(LS_KEY, t);
        } catch (_) {}
        applyDom(t);
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set({ theme: t }, function () {
                if (typeof cb === 'function') cb(t);
            });
        } else if (typeof cb === 'function') {
            cb(t);
        }
    }

    try {
        var cached = localStorage.getItem(LS_KEY);
        if (cached) applyDom(cached);
    } catch (_) {}

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get([SYNC_KEY], function (r) {
            var th = normalize(r && r[SYNC_KEY]);
            applyDom(th);
            try {
                localStorage.setItem(LS_KEY, th);
            } catch (_) {}
        });
        chrome.storage.onChanged.addListener(function (changes, area) {
            if (area !== 'sync' || !changes[SYNC_KEY]) return;
            var th = normalize(changes[SYNC_KEY].newValue);
            applyDom(th);
            try {
                localStorage.setItem(LS_KEY, th);
            } catch (_) {}
        });
    }

    window.NHP_EXTENSION_THEME = {
        SYNC_KEY: SYNC_KEY,
        LS_KEY: LS_KEY,
        normalize: normalize,
        applyDom: applyDom,
        persist: persist
    };
})();
