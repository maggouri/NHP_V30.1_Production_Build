export const GitHubSync = {
    // جعل الكائن متاحاً عالمياً
    init: function () {
        window.GitHubSync = this;
        this.loadTokenFromStorage();
    },

    // User must set GitHub PAT in Admin → Sync → GitHub Token (stored in chrome.storage.local.githubToken).
    // Never commit tokens to the repo.
    config: {
        token: '',
        owner: 'maggouri',
        repo: 'niche-hunter-assets',
        branch: 'main'
    },

    _tokenStorageKey: 'githubToken',
    _tokenLoadPromise: null,
    _loggedNoToken: false,

    _isPlaceholderToken(token) {
        const t = String(token || '').trim();
        return !t || t === 'YOUR_GITHUB_TOKEN';
    },

    hasValidToken() {
        return !this._isPlaceholderToken(this.config.token);
    },

    loadTokenFromStorage() {
        if (this._tokenLoadPromise) return this._tokenLoadPromise;
        this._tokenLoadPromise = new Promise((resolve) => {
            try {
                chrome.storage.local.get([this._tokenStorageKey, 'githubSyncToken'], (res) => {
                    const token = String(res[this._tokenStorageKey] || res.githubSyncToken || '').trim();
                    if (token && !this._isPlaceholderToken(token)) {
                        this.config.token = token;
                    } else {
                        this.config.token = '';
                    }
                    resolve(this.config.token);
                });
            } catch (_) {
                this.config.token = '';
                resolve('');
            }
        });
        return this._tokenLoadPromise;
    },

    async ensureToken() {
        await this.loadTokenFromStorage();
        if (!this.hasValidToken()) {
            if (!this._loggedNoToken) {
                console.info('[NHP] GitHub cloud sync skipped — set PAT in Admin → Sync → GitHub Token');
                this._loggedNoToken = true;
            }
            return false;
        }
        return true;
    },

    setToken(token) {
        const t = String(token || '').trim();
        this.config.token = this._isPlaceholderToken(t) ? '' : t;
        this._loggedNoToken = false;
        try {
            if (this.config.token) {
                chrome.storage.local.set({ [this._tokenStorageKey]: this.config.token });
            } else {
                chrome.storage.local.remove([this._tokenStorageKey]);
            }
        } catch (_) { /* ignore */ }
    },

    /**
     * الحصول على معرف المستخدم الفريد (من الحساب، كود التفعيل، أو عشوائي)
     */
    getUserId: async function () {
        // الأولوية 1: معرف المستخدم من نظام Firebase Auth (الحساب)
        if (typeof AuthManager !== 'undefined') {
            const user = await AuthManager.getCurrentUser();
            if (user && user.uid) return user.uid;
        }

        return new Promise((resolve) => {
            chrome.storage.local.get(['licenseKey', 'guestId'], (res) => {
                if (res.licenseKey) {
                    // إذا كان لديه كود تفعيل، نستخدمه وننظفه من الرموز الخاصة
                    resolve(res.licenseKey.replace(/[^a-zA-Z0-9]/g, ''));
                } else if (res.guestId) {
                    resolve(res.guestId);
                } else {
                    // توليد معرف عشوائي للجهاز إذا لم يكن هناك ترخيص
                    const newId = 'guest_' + Math.random().toString(36).substr(2, 9);
                    chrome.storage.local.set({ guestId: newId }, () => resolve(newId));
                }
            });
        });
    },

    /**
     * رفع صورة إلى GitHub (في مجلد المستخدم الخاص)
     */
    uploadImage: async function (base64Data, fileName) {
        if (!(await this.ensureToken())) {
            return { success: false, error: 'GitHub token not configured' };
        }
        const userId = await this.getUserId();
        const path = `assets/designs/${userId}/${Date.now()}_${fileName}`;
        const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;

        const body = {
            message: `Upload design for user: ${userId}`,
            content: base64Data,
            branch: this.config.branch
        };

        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.config.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            const data = await response.json();

            if (response.ok && data.content) {
                return {
                    success: true,
                    url: `https://raw.githubusercontent.com/${this.config.owner}/${this.config.repo}/${this.config.branch}/${path}`,
                    path: path,
                    sha: data.content.sha
                };
            } else {
                return { success: false, error: data.message || 'Upload Failed' };
            }
        } catch (err) {
            return { success: false, error: err.message };
        }
    },

    /**
     * حفظ ملف بيانات JSON (بصيغة اسم مرتبطة بالمستخدم)
     */
    syncData: async function (jsonData) {
        if (!(await this.ensureToken())) return null;
        const userId = await this.getUserId();
        const path = `sync/data_${userId}.json`;
        const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;

        // Optimization: Avoid full deep copy with JSON.parse(JSON.stringify(..))
        // Instead, only copy what's needed and strip heavy base64 strings
        const cleanData = { ...jsonData };
        if (cleanData.savedDesignQueue) {
            cleanData.savedDesignQueue = cleanData.savedDesignQueue.map(item => {
                const { base64, ...rest } = item; // Extract everything EXCEPT base64
                return rest;
            });
        }

        const jsonStr = JSON.stringify(cleanData);
        const base64Content = await this._encodeBase64Safe(jsonStr);

        const currentRes = await this._download(url);
        let sha = (currentRes && currentRes.success) ? currentRes.data.sha : null;

        const body = {
            message: `Sync Update for user: ${userId}`,
            content: base64Content,
            branch: this.config.branch
        };
        if (sha) body.sha = sha;

        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.config.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            const data = await response.json();
            if (response.ok) return data;
            else throw new Error(data.message || 'Sync Failed');
        } catch (err) {
            throw err;
        }
    },

    /**
     * استيراد البيانات من GitHub (الخاصة بالمستخدم)
     */
    getData: async function (specificUserId = null) {
        if (!(await this.ensureToken())) return null;
        const userId = specificUserId || await this.getUserId();
        const path = `sync/data_${userId}.json`;
        const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;

        const res = await this._download(url);
        if (res && res.success && res.data.content) {
            try {
                // إزالة فواصل الأسطر المحتملة من GitHub قبل فك التشفير
                const cleanContent = res.data.content.replace(/\s/g, '');
                const content = await this._decodeBase64Safe(cleanContent);
                return JSON.parse(content);
            } catch (e) {
                console.error('JSON Parse Error in getData:', e);
                return null;
            }
        }
        return null;
    },

    /**
     * جلب قائمة الصور من مكتبة المستخدم
     */
    fetchLibrary: async function () {
        if (!(await this.ensureToken())) return [];
        const userId = await this.getUserId();
        const path = `assets/designs/${userId}`;
        const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;

        const res = await this._download(url);
        if (res && res.success && Array.isArray(res.data)) {
            return res.data.filter(file => file.name.match(/\.(png|jpg|jpeg|webp)$/i));
        }
        return [];
    },

    /**
     * إرسال قائمة تصاميم لمستخدم آخر (للمدير فقط)
     * يدعم الآن البحث الذكي عن العضو في السجل المركزي ومعالجة الأحجام الضخمة
     */
    shareQueueToUser: async function (targetEmailOrUid, queueData) {
        if (!(await this.ensureToken())) {
            throw new Error('GitHub token not configured — Admin → Sync → GitHub Token');
        }
        let targetUid = targetEmailOrUid;

        // 1. تطهير البيانات لتقليل الحجم ومنع أخطاء JSON
        const sanitizedQueue = await Promise.all((queueData.savedDesignQueue || []).map(async item => {
            let b64 = item.base64;
            if (!b64 && window.NHPDatabase) {
                b64 = await window.NHPDatabase.getImage(item.id);
            }
            return {
                id: item.id,
                base64: b64,
                meta: item.meta,
                status: item.status,
                fileName: item.file?.name || 'design.png'
            };
        }));

        const cleanData = { savedDesignQueue: sanitizedQueue };
        const jsonStr = JSON.stringify(cleanData);

        // 2. التحقق من الحجم (GitHub API limit is 100MB)
        const sizeInMB = (jsonStr.length * 1.33) / (1024 * 1024); // تقريبي بعد التشفير
        if (sizeInMB > 95) {
            throw new Error(`حجم البيانات (${Math.round(sizeInMB)}MB) يتجاوز الحد المسموح (100MB). يرجى تقليل عدد التصاميم وإعادة المحاولة عبر إرسالهم على دفعات.`);
        }

        // 3. محاولة البحث عن العضو في السجل المركزي للحصول على الـ UID الحقيقي
        try {
            const members = await this.getAllRegisteredUsers();
            const found = members.find(m => m.email === targetEmailOrUid || m.uid === targetEmailOrUid);
            if (found) targetUid = found.uid;
            else if (targetEmailOrUid.includes('@')) {
                // صيغة احتياطية متوافقة مع Admin Bypass
                targetUid = 'owner_' + btoa(targetEmailOrUid).substring(0, 10);
            }
        } catch (e) {
            console.error('Search Registry Error:', e);
            if (targetEmailOrUid.includes('@')) {
                targetUid = 'owner_' + btoa(targetEmailOrUid).substring(0, 10);
            }
        }

        const path = `sync/data_${targetUid}.json`;
        const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;

        // Prepare base64 content
        const base64Content = await this._encodeBase64Safe(jsonStr);

        // Get SHAs if exists
        const currentRes = await this._download(url);
        let sha = (currentRes && currentRes.success) ? currentRes.data.sha : null;

        const body = {
            message: `Admin Share to: ${targetEmailOrUid}`,
            content: base64Content,
            branch: this.config.branch
        };
        if (sha) body.sha = sha;

        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.config.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `API Error: ${response.status}`);
            }

            return await response.json();
        } catch (err) {
            console.error('Share Fetch Error:', err);
            if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
                throw new Error('فشل في الاتصال بالسيرفر. قد يكون حجم البيانات ضخماً جداً (يتجاوز سعة المتصفح) أو هناك مشكلة في الإنترنت. حاول إرسال عدد أقل من التصاميم.');
            }
            throw err;
        }
    },

    /**
     * حذف ملف من GitHub
     */
    deleteFile: async function (path, sha) {
        if (!(await this.ensureToken())) {
            return { success: false, error: 'GitHub token not configured' };
        }
        const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;
        const body = {
            message: `Delete file: ${path}`,
            sha: sha,
            branch: this.config.branch
        };

        try {
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Authorization': `token ${this.config.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            if (response.ok) return { success: true };
            else {
                const data = await response.json();
                return { success: false, error: data.message || 'Delete Failed' };
            }
        } catch (err) {
            return { success: false, error: err.message };
        }
    },

    /**
     * جلب جميع الأعضاء المسجلين من السجل المركزي (للمدير فقط)
     */
    getAllRegisteredUsers: async function () {
        if (!(await this.ensureToken())) return [];
        const path = `admin/members.json`;
        const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;

        const res = await this._download(url);
        if (res && res.success && res.data.content) {
            try {
                const cleanContent = res.data.content.replace(/\s/g, '');
                const content = await this._decodeBase64Safe(cleanContent);
                return JSON.parse(content);
            } catch (e) {
                console.error('Registry Parse Error:', e);
                return [];
            }
        }
        return [];
    },

    /**
     * تسجيل مستخدم في قائمة الأعضاء المركزية
     */
    registerUserGlobal: async function (email, uid, nickname = null, password = null, forceUpdate = false) {
        if (!email) return;
        if (!(await this.ensureToken())) return;
        const path = `admin/members.json`;
        const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${path}?ref=${this.config.branch}&t=${Date.now()}`;

        // 1. جلب القائمة الحالية
        const res = await this._download(url);
        let members = [];
        let sha = null;

        if (res && res.success && res.data.content) {
            try {
                sha = res.data.sha;
                const cleanContent = res.data.content.replace(/\s/g, '');
                const content = await this._decodeBase64Safe(cleanContent);
                members = JSON.parse(content);
            } catch (e) {
                console.error('Error parsing members in registerUserGlobal:', e);
                members = [];
            }
        }

        // 2. التحقق من وجود المستخدم
        const existingMemberIndex = members.findIndex(m => m.email === email || (nickname && m.nickname === nickname));

        if (existingMemberIndex !== -1) {
            // إذا كان المستخدم موجوداً، نحدث كلمة المرور إذا كانت مفقودة أو إذا طلب المدير ذلك قسراً
            if (password && (!members[existingMemberIndex].password || forceUpdate)) {
                members[existingMemberIndex].password = password;
            } else {
                return; // لا تغيير مطلوب
            }
        } else {
            // 3. إضافة المستخدم الجديد
            members.push({
                email,
                uid,
                nickname: nickname || email.split('@')[0],
                password: password, // حفظ كلمة المرور
                registeredAt: new Date().toISOString()
            });
        }

        // 4. رفع القائمة المحدثة
        const jsonStr = JSON.stringify(members, null, 2);
        const base64Content = await this._encodeBase64Safe(jsonStr);
        const uploadUrl = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;

        const body = {
            message: `User Update: ${nickname || email}`,
            content: base64Content,
            branch: this.config.branch
        };
        if (sha) body.sha = sha;

        return fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${this.config.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
    },

    /**
     * هجرة الأعضاء القدامى من ملفات sync إلى السجل المركزي (للمدير فقط)
     */
    migrateLegacyUsers: async function () {
        if (!(await this.ensureToken())) {
            return { success: false, error: 'GitHub token not configured' };
        }
        try {
            // 1. جلب محتويات مجلد sync
            const syncPath = `sync`;
            const syncUrl = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${syncPath}`;

            const res = await this._download(syncUrl);

            // إذا كان المجلد غير موجود (404)، فهذا يعني ببساطة لا يوجد أعضاء قدامى
            if (res && res.data && res.data.message === 'Not Found') {
                return { success: true, count: 0, msg: 'No legacy users found' };
            }

            if (!res || !res.success) {
                return { success: false, error: res?.error || (res?.data?.message) || 'فشل الاتصال بمجلد المزامنة' };
            }

            if (!Array.isArray(res.data)) {
                return { success: true, count: 0, msg: 'Sync path is not a directory' };
            }

            // 2. جلب السجل الحالي
            let members = await this.getAllRegisteredUsers() || [];
            let changed = false;

            // 3. تحليل ملفات data_owner_
            for (const file of res.data) {
                if (file.name.startsWith('data_owner_') && file.name.endsWith('.json')) {
                    const uid = file.name.replace('data_', '').replace('.json', '');

                    // إذا لم يكن موجوداً، نقوم بإضافته
                    if (!members.find(m => m.uid === uid)) {
                        let inferredEmail = 'user_' + uid.substring(6, 12);
                        members.push({
                            email: inferredEmail,
                            uid: uid,
                            registeredAt: new Date().toISOString(),
                            legacyAt: 'Migrated'
                        });
                        changed = true;
                    }
                }
            }

            if (changed) {
                // تحديث السجل المركزي
                const path = `admin/members.json`;
                const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;

                const currentRes = await this._download(url);
                const sha = (currentRes && currentRes.success) ? currentRes.data.sha : null;

                const jsonStr = JSON.stringify(members, null, 2);
                const base64Content = await this._encodeBase64Safe(jsonStr);

                const updateRes = await fetch(url, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${this.config.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Migrated Legacy Users to Central Registry`,
                        content: base64Content,
                        sha: sha,
                        branch: this.config.branch
                    })
                });

                if (!updateRes.ok) {
                    const errData = await updateRes.json();
                    throw new Error(errData.message || 'فشل تحديث السجل المركزي');
                }

                return { success: true, count: members.length };
            }
            return { success: true, count: 0, msg: 'All up to date' };
        } catch (e) {
            console.error('Migration Error:', e);
            return { success: false, error: e.message };
        }
    },

    /**
     * جلب جميع الأعضاء الذين لديهم مجلدات مزامنة (طريقة بديلة)
     */
    fetchAllUsers: async function () {
        if (!(await this.ensureToken())) return [];
        const path = `sync`;
        const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;

        const res = await this._download(url);
        if (res && res.success && Array.isArray(res.data)) {
            // استخراج البريد الإلكتروني من اسم الملف (data_encodedEmail.json)
            const users = [];
            for (const file of res.data) {
                if (file.name.startsWith('data_owner_') && file.name.endsWith('.json')) {
                    // نحن نخزن المعرف كـ base64 مقصوص، لذا سنبحث عن اسم الملف الأصلي إذا توفر
                    // في هذا النظام، سنعرض المعرفات، أو إذا كان لدينا قائمة مسبقة
                    users.push({
                        id: file.name.replace('data_', '').replace('.json', ''),
                        fileName: file.name
                    });
                }
            }
            return users;
        }
        return [];
    },

    /**
     * تحويل النصوص الضخمة إلى Base64 بأمان باستخدام FileReader لتجنب انهيار الذاكرة
     */
    _encodeBase64Safe: async function (str) {
        return new Promise((resolve, reject) => {
            const blob = new Blob([str], { type: 'application/json' });
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    },

    /**
     * فك تشفير Base64 بآلية آمنة وسريعة عبر Fetch API بدلاً من الدوال القديمة
     */
    _decodeBase64Safe: async function (base64Str) {
        const response = await fetch(`data:application/json;base64,${base64Str}`);
        return await response.text();
    },

    /**
     * Helper for downloading from GitHub directly (bypasses 64MB limit)
     */
    _download: async function (url) {
        if (!(await this.ensureToken())) {
            return { success: false, skipped: true, error: 'no_token' };
        }
        try {
            const response = await fetch(url, {
                headers: { 'Authorization': `token ${this.config.token}` }
            });
            const data = await response.json();
            if (!response.ok && (response.status === 401 || data?.message === 'Bad credentials')) {
                return { success: false, error: 'Bad credentials', data };
            }
            return { success: response.ok, data };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }
};

GitHubSync.init();
