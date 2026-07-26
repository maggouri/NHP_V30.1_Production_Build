# NHP_V30.1_Production_Build — الإضافة + السيرفرات

## هذا المجلد هو إضافة Chrome الرئيسية

حمّل الإضافة من هذا المجلد مباشرة:

```
E:\NHP_V30.1_Production_Build\NHP_PLATFORM\02_Chrome_Extension
```

الاسم في Chrome: **Niche Hunter Pro - USPTO + TeePublic + AI**

تعليمات التحميل: راجع `LOAD_EXTENSION.txt`

## السيرفرات المحلية (نفس المجلد)

- Ghost Server — منفذ 3019 (TeePublic / Redbubble / Amazon)
- Creaty Server — منفذ 3020
- AI Bridge Server — منفذ 3031 (RENAME AI / SEO)

شغّل الكل عبر `NHP_Start_All_Servers.cmd` أو ملفات `Start_*_Server*.cmd`.

## نسخة بديلة (اختيارية)

`NHP_PLATFORM/01_EmailCore/` نسخة **EmailCore** الكاملة (git: `maggouri/emailcore`).
لا تستخدمها لتحميل الإضافة في Chrome — الإعداد الافتراضي: **02_Chrome_Extension**.

## ملاحظة

لا تحذف `manifest.json` من هذا المجلد — Chrome يحتاجه لتحميل الإضافة.
الملف `manifest.json.DO_NOT_LOAD_IN_CHROME` نسخة احتياطية فقط.
