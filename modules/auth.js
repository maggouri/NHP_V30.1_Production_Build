// ══════════════════════════════════════════════════════
//  ████████  AUTH MODULE (VERSION 2.0 - MODULAR)  ████████
// ══════════════════════════════════════════════════════

let AuthS = {};

export function initAuthModule(helpers) {
    const { refreshLibrary, autoSyncCloudData, refreshAdminUsers, refreshLocalLibrary, showToast } = helpers;

    AuthS = {
        btnLogin: document.getElementById('btnLogin'),
        btnSignUp: document.getElementById('btnSignUp'),
        btnLogout: document.getElementById('btnLogout'),
        loginForm: document.getElementById('loginForm'),
        userInfo: document.getElementById('userInfo'),
        authStatus: document.getElementById('authStatus'),
        userEmailDisplay: document.getElementById('userEmailDisplay'),
        authNickname: document.getElementById('authNickname'),
        authPassword: document.getElementById('authPassword')
    };

    if (AuthS.btnLogin) {
        AuthS.btnLogin.addEventListener('click', async () => {
            const nickname = AuthS.authNickname.value.trim();
            const password = AuthS.authPassword.value.trim();

            if (!nickname) return showToast('⚠️ يرجى إدخال اسم مستعار');

            AuthS.authStatus.style.display = 'block';
            AuthS.authStatus.style.background = 'rgba(108, 99, 255, 0.1)';
            AuthS.authStatus.style.color = 'var(--primary)';
            AuthS.authStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التحقق من الحساب...';

            try {
                await AuthManager.loginWithNickname(nickname, password);
                showToast(`✨ مرحباً بك ${nickname}! تم الدخول بنجاح`);
                AuthS.authPassword.value = '';
                updateAuthUI(helpers);
            } catch (e) {
                AuthS.authStatus.style.background = 'rgba(239, 68, 68, 0.1)';
                AuthS.authStatus.style.color = 'var(--banned)';

                if (e.message === 'REQUIRED_PASSWORD') {
                    AuthS.authStatus.innerHTML = `⚠️ هذا الاسم محمي، يرجى إدخال كلمة المرور للمتابعة`;
                    AuthS.authPassword.focus();
                } else if (e.message === 'NEW_USER_PASSWORD_REQUIRED') {
                    AuthS.authStatus.innerHTML = `🔑 اسم جديد! يرجى تعيين كلمة مرور لحماية اسمك مستقبلاً`;
                    AuthS.authPassword.focus();
                } else {
                    AuthS.authStatus.innerHTML = `❌ خطأ في الدخول: ${e.message}`;
                }
            }
        });
    }

    if (AuthS.btnLogout) {
        AuthS.btnLogout.addEventListener('click', async () => {
            if (confirm('هل أنت متأكد من تسجيل الخروج؟ سيتم إيقاف المزامنة السحابية.')) {
                await AuthManager.logout();
                showToast('👋 تم تسجيل الخروج بنجاح');
                updateAuthUI(helpers);
            }
        });
    }
}

export async function updateAuthUI(helpers) {
    if (typeof AuthManager === 'undefined') return;
    const user = await AuthManager.getCurrentUser();
    const authBox = document.getElementById('authBox');
    const userInfoHeader = document.getElementById('userInfoHeader');
    const userInfoAdmin = document.getElementById('userInfo');
    const userEmailDisplayAdmin = document.getElementById('userEmailDisplay');

    // Restricted Admin Elements
    const adminTitle = document.querySelector('#admin-panel h3');
    const adminList = document.getElementById('admin-users-list');
    const adminMailInput = document.getElementById('admin-target-email');
    const adminSendBtn = document.getElementById('btn-admin-send-queue');

    if (user) {
        if (authBox) authBox.style.display = 'none';

        if (userInfoHeader) {
            userInfoHeader.style.display = 'flex';
            userInfoHeader.style.background = '#10b981';
            userInfoHeader.style.boxShadow = '0 0 8px #10b981';
            userInfoHeader.title = `متصل سحابياً: ${user.nickname || user.email}`;
        }

        if (userInfoAdmin) {
            userInfoAdmin.style.display = 'block';
            if (userEmailDisplayAdmin) userEmailDisplayAdmin.textContent = user.nickname || user.email;
        }

        const isOwner = (user.email === 'khalid.maggouri.97@gmail.com' || user.nickname === 'maggouri');
        [adminTitle, adminList, adminMailInput, adminSendBtn].forEach(el => {
            if (el) el.style.display = isOwner ? (el.tagName === 'H3' ? 'flex' : 'block') : 'none';
        });

        if (helpers.refreshLibrary) helpers.refreshLibrary();
        if (helpers.autoSyncCloudData) helpers.autoSyncCloudData();

        if (window.GitHubSync) {
            window.GitHubSync.registerUserGlobal(user.email, user.uid, user.nickname).catch(e => console.error('Auto Registry Error:', e));
        }
        if (isOwner && helpers.refreshAdminUsers) helpers.refreshAdminUsers();
        if (helpers.refreshLocalLibrary) helpers.refreshLocalLibrary();

    } else {
        if (authBox) authBox.style.display = 'block';

        if (userInfoHeader) {
            userInfoHeader.style.display = 'flex';
            userInfoHeader.style.background = '#ef4444';
            userInfoHeader.style.boxShadow = '0 0 8px #ef4444';
            userInfoHeader.title = 'غير متصل بالسحابة';
        }

        if (userInfoAdmin) userInfoAdmin.style.display = 'none';

        [adminTitle, adminList, adminMailInput, adminSendBtn].forEach(el => {
            if (el) el.style.display = 'none';
        });
    }
}
