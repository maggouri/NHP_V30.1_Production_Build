/**
 * NICHE HUNTER PRO - AUTH UI MODULE
 * Handles authentication UI updates and login/signup flows.
 */

import { showToast } from '../utils.js';

export const AUTH_UI = {
    btnLogin: document.getElementById('btnLogin'),
    btnSignUp: document.getElementById('btnSignUp'),
    btnLogout: document.getElementById('btnLogout'),
    loginForm: document.getElementById('loginForm'),
    userInfo: document.getElementById('userInfo'),
    authStatus: document.getElementById('authStatus'),
    userEmailDisplay: document.getElementById('userEmailDisplay')
};

export async function updateAuthUI() {
    if (typeof AuthManager === 'undefined') return;
    const user = await AuthManager.getCurrentUser();
    const authBox = document.getElementById('authBox');
    const userInfoHeader = document.getElementById('userInfoHeader');

    if (user) {
        if (authBox) authBox.style.display = 'none';
        if (userInfoHeader) {
            userInfoHeader.style.display = 'flex';
            userInfoHeader.style.background = '#10b981';
            userInfoHeader.style.boxShadow = '0 0 8px #10b981';
            userInfoHeader.title = `متصل سحابياً: ${user.nickname || user.email}`;
        }
        if (AUTH_UI.userInfo) AUTH_UI.userInfo.style.display = 'block';
        if (AUTH_UI.userEmailDisplay) AUTH_UI.userEmailDisplay.textContent = user.nickname || user.email;

        const isOwner = (user.email === 'khalid.maggouri.97@gmail.com' || user.nickname === 'maggouri');
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = isOwner ? 'block' : 'none';
        });

        if (window.refreshLibrary) window.refreshLibrary();
        if (window.autoSyncCloudData) window.autoSyncCloudData();
    } else {
        if (authBox) authBox.style.display = 'block';
        if (userInfoHeader) {
            userInfoHeader.style.display = 'flex';
            userInfoHeader.style.background = '#ef4444';
            userInfoHeader.style.boxShadow = '0 0 8px #ef4444';
            userInfoHeader.title = 'غير متصل بالسحابة';
        }
    }
}

export function initAuthModule() {
    AUTH_UI.btnLogin?.addEventListener('click', async () => {
        const nickname = document.getElementById('authNickname').value.trim();
        const password = document.getElementById('authPassword').value.trim();
        if (!nickname || !password) return showToast('⚠️ أدخل البيانات');

        AUTH_UI.authStatus.style.display = 'block';
        const res = await AuthManager.login(nickname, password);
        AUTH_UI.authStatus.style.display = 'none';

        if (res.success) {
            showToast('✅ تم تسجيل الدخول');
            updateAuthUI();
        } else {
            showToast('❌ ' + res.error);
        }
    });

    AUTH_UI.btnLogout?.addEventListener('click', async () => {
        await AuthManager.logout();
        updateAuthUI();
        showToast('👋 تم تسجيل الخروج');
    });
}
