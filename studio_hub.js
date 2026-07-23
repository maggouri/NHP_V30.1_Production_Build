const HUB = {
    tabs: [],
    activeId: null,

    init() {
        const addBtn = document.getElementById('add-tab-btn');
        if (addBtn) addBtn.onclick = () => this.addTab();

        // Start with one tab
        this.addTab();
    },

    addTab() {
        const id = Date.now();
        const url = 'https://gemini.google.com/gem/6bc2d8e9f911';
        const tabCount = this.tabs.length + 1;
        const title = `Gemini Session ${tabCount}`;

        const tab = { id, title, url };
        this.tabs.push(tab);

        this.renderTabs();
        this.createIframe(id, url);
        this.activateTab(id);
    },

    activateTab(id) {
        this.activeId = id;
        this.renderTabs();
        document.querySelectorAll('iframe').forEach(f => {
            f.style.display = (f.dataset.id == id) ? 'block' : 'none';
        });
    },

    removeTab(id, e) {
        if (e) e.stopPropagation();
        this.tabs = this.tabs.filter(t => t.id !== id);
        const frame = document.querySelector(`iframe[data-id="${id}"]`);
        if (frame) frame.remove();

        if (this.tabs.length === 0) {
            this.addTab();
            return;
        }

        if (this.activeId === id) {
            this.activateTab(this.tabs[this.tabs.length - 1].id);
        } else {
            this.renderTabs();
        }
    },

    renderTabs() {
        const list = document.getElementById('tabs-list');
        if (!list) return;
        list.innerHTML = '';
        this.tabs.forEach(t => {
            const el = document.createElement('div');
            el.className = `tab ${t.id === this.activeId ? 'active' : ''}`;
            el.innerHTML = `
                <i class="fa-solid fa-microchip"></i>
                <span>${t.title}</span>
                <div class="tab-close" onclick="HUB.removeTab(${t.id}, event)"><i class="fa-solid fa-xmark"></i></div>
            `;
            el.onclick = () => this.activateTab(t.id);
            list.appendChild(el);
        });
    },

    createIframe(id, url) {
        const ifr = document.createElement('iframe');
        ifr.src = url;
        ifr.dataset.id = id;
        const viewport = document.getElementById('viewport');
        if (viewport) viewport.appendChild(ifr);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    HUB.init();
});
window.HUB = HUB;
