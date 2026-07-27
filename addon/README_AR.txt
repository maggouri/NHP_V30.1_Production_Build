================================================================================
  NHP addon — دليل المجلدات (عربي)
================================================================================

ترتيب الاستخدام الموصى به:
  1) 00_Register_Native_Messaging   — مرة واحدة لكل جهاز (Native Messaging)
  2) 01_Start_All                   — تشغيل كل السيرفرات (8)
  3) servers\...                    — تشغيل/إيقاف سيرفر واحد عند الحاجة
  4) 02_Stop_All / 03_Restart_All   — إيقاف الكل أو إعادة التشغيل

--------------------------------------------------------------------------------
المجلدات (ملف تشغيل واحد لكل مجلد مرقّم)
--------------------------------------------------------------------------------
  00_Register_Native_Messaging\
      Register_NHP_Native_Messaging_User.cmd   << نقر مزدوج مرة واحدة

  01_Start_All\
      NHP_Start_All_Servers.cmd                << تشغيل الكل (نافذة مرئية)

  02_Stop_All\
      NHP_Stop_All_Servers.cmd                 << إيقاف الكل

  03_Restart_All\
      NHP_Restart_All_Servers.cmd              << إعادة تشغيل الكل

  servers\
      teepublic_ghost_3019\     TeePublic Ghost        :3019
      creaty_signup_3020\       Creaty Signup          :3020
      redbubble_ghost_3021\     Redbubble Ghost        :3021
      amazon_ghost_3022\        Amazon Ghost           :3022
      pinterest_ghost_3023\     Pinterest Ghost        :3023
      creaty_workflow_3024\     Creaty Workflow Ghost  :3024
      ai_bridge_3031\           AI Bridge              :3031
      cliproxy_8317\            CLIProxyAPI Local      :8317

  _shared\                      مساعدات داخلية (SilentCore / Hidden / Init)
  cliproxyapi-local\            ثنائي وإعدادات CLIProxy

--------------------------------------------------------------------------------
مسارات النقر المزدوج
--------------------------------------------------------------------------------
  Register:
    addon\00_Register_Native_Messaging\Register_NHP_Native_Messaging_User.cmd

  Start All:
    addon\01_Start_All\NHP_Start_All_Servers.cmd

  Stop All:
    addon\02_Stop_All\NHP_Stop_All_Servers.cmd

  Restart All:
    addon\03_Restart_All\NHP_Restart_All_Servers.cmd

  للإضافة (صامت):
    addon\_shared\NHP_Start_All_Servers_SilentCore.cmd
    addon\_shared\NHP_Stop_All_Servers_SilentCore.cmd
    addon\_shared\NHP_Restart_All_Servers_SilentCore.cmd

  ملاحظة: اختصارات بنفس الأسماء في جذر المشروع (خارج addon\)
  ما زالت تعمل للتوافق مع الروابط القديمة.

--------------------------------------------------------------------------------
البيانات المحمولة (مسارات نسبية — لا تعتمد على C:\Users\...)
--------------------------------------------------------------------------------
  App Root  = مجلد المشروع (والد addon\ — يُحسب من موقع السكربت عبر %~dp0)
  Data Root = شقيق App Root باسم NHP_DATA (سجلات، tmp، ...) — أو NHP_DATA_ROOT
  بعد نقل المجلد بالكامل: شغّل 00_Register_Native_Messaging مرة، أو Start All
  (Portable Init يعيد كتابة مسار Native Messaging للجهاز الحالي).
  cliproxy: auth-dir=./auths و tls.cert/key نسبية داخل cliproxyapi-local\

--------------------------------------------------------------------------------
Node.js requirement / exigence Node.js
--------------------------------------------------------------------------------
  EN: Install Node.js LTS from https://nodejs.org/  OR place portable:
      runtime\node\node.exe
  FR: Installez Node.js LTS https://nodejs.org/  OU placez un Node portable:
      runtime\node\node.exe
  Copy the FULL extension folder (not only addon\).
  Data stays beside App Root in NHP_DATA\ (settings preserved across moves).
