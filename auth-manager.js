const FIREBASE_API_KEY = 'AIzaSyDtC8mbZy9cYSyTcoWYuwcqGy1cm7yrpzs';

export const AuthManager = {
    config: {
        apiKey: FIREBASE_API_KEY
    },

    /**
     * تسجيل الدخول بالاسم المستعار فقط
     * يتحقق من عدم تكرار الاسم في السجل العالمي
     */
    loginWithNickname: async function (nickname, password = null) {
        if (!nickname || nickname.length < 3) {
            throw new Error('يرجى إعطاء اسم مستعار مكون من 3 أحرف على الأقل');
        }

        const cleanNickname = nickname.trim();

        // 1. جلب السجل العالمي للتحقق
        let members = [];
        if (window.GitHubSync) {
            try {
                members = await window.GitHubSync.getAllRegisteredUsers();
            } catch (e) {
                console.error('Error fetching members:', e);
            }
        }

        // 2. البحث عن العضو
        const found = members.find(m => m.nickname && m.nickname.toLowerCase() === cleanNickname.toLowerCase());

        if (found) {
            // إذا كان لللحساب كلمة مرور، يجب التحقق منها
            if (found.password) {
                if (!password) {
                    throw new Error('REQUIRED_PASSWORD'); // رمز لإظهار حقل كلمة المرور في الواجهة
                }
                if (found.password !== password) {
                    throw new Error('كلمة المرور غير صحيحة، هذا الاسم محمي');
                }
            } else if (password) {
                // إذا لم يكن هناك كلمة مرور ولكن المستخدم أدخل واحدة، نقوم بتعيينها له (حماية لأول مرة)
                try {
                    await window.GitHubSync.registerUserGlobal(found.email, found.uid, found.nickname, password);
                } catch (e) { console.error('Set password error:', e); }
            }

            // نجاح الدخول - حفظ البيانات محلياً للمزامنة
            const userData = {
                localId: found.uid,
                email: found.email,
                nickname: found.nickname,
                password: password || found.password
            };
            await this.saveUser(userData);
            return userData;
        }

        // 3. إذا كان الاسم جديداً، نقوم بالتسجيل لأول مرة مع كلمة مرور
        if (!password) {
            throw new Error('NEW_USER_PASSWORD_REQUIRED'); // طلب تعيين كلمة مرور للمستخدم الجديد
        }

        const newUid = 'nick_' + Math.random().toString(36).substr(2, 9);
        const userData = {
            localId: newUid,
            email: cleanNickname + '@nichehunter.internal',
            nickname: cleanNickname,
            password: password
        };

        await this.saveUser(userData);

        if (window.GitHubSync) {
            try {
                await window.GitHubSync.registerUserGlobal(userData.email, userData.localId, cleanNickname, password);
            } catch (e) {
                console.error('Global Registration Error:', e);
            }
        }

        return userData;
    },

    /**
     * حفظ بيانات الجلسة
     */
    saveUser: async function (userData) {
        return new Promise(resolve => {
            chrome.storage.local.set({
                user: {
                    uid: userData.localId,
                    email: userData.email,
                    nickname: userData.nickname || userData.email.split('@')[0],
                    password: userData.password,
                    token: 'nickname_auth_token',
                    expiresAt: Date.now() + (3600 * 24 * 365 * 10 * 1000) // 10 سنوات
                }
            }, resolve);
        });
    },

    /**
     * الحصول على المستخدم الحالي
     */
    getCurrentUser: async function () {
        return new Promise(resolve => {
            chrome.storage.local.get(['user'], (res) => {
                if (res.user && res.user.expiresAt > Date.now()) {
                    resolve(res.user);
                } else {
                    resolve(null);
                }
            });
        });
    },

    /**
     * تسجيل الخروج
     */
    logout: async function () {
        return new Promise(resolve => {
            chrome.storage.local.remove(['user'], resolve);
        });
    }
};

window.AuthManager = AuthManager;
