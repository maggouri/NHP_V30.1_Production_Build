================================================================================
  NHP addon — دليل المجلدات (عربي)
================================================================================

ترتيب الاستخدام الموصى به:
  1) 00_Register_Native_Messaging   — مرة واحدة لكل جهاز (Native Messaging)
  2) 01_Start_All                   — تشغيل كل السيرفرات (8)
  3) servers\...                    — تشغيل/إيقاف سيرفر واحد عند الحاجة
  4) 02_Stop_All / 03_Restart_All   — إيقاف الكل أو إعادة التشغيل

--------------------------------------------------------------------------------
المجلدات
--------------------------------------------------------------------------------
  00_Register_Native_Messaging\
      Register_NHP_Native_Messaging_User.bat   << الأولوية الأولى (نقر مزدوج)

  01_Start_All\
      NHP_Start_All_Servers.bat                << تشغيل الكل (نافذة مرئية)
      NHP_Start_All_Servers_SilentCore.bat     << تشغيل الكل (صامت / للإضافة)

  02_Stop_All\
      NHP_Stop_All_Servers.bat

  03_Restart_All\
      NHP_Restart_All_Servers.bat

  servers\
      teepublic_ghost_3019\     TeePublic Ghost        :3019
      creaty_signup_3020\       Creaty Signup          :3020
      redbubble_ghost_3021\     Redbubble Ghost        :3021
      amazon_ghost_3022\        Amazon Ghost           :3022
      pinterest_ghost_3023\     Pinterest Ghost        :3023
      creaty_workflow_3024\     Creaty Workflow Ghost  :3024
      ai_bridge_3031\           AI Bridge              :3031
      cliproxy_8317\            CLIProxyAPI Local      :8317

  _shared\                      مساعدات داخلية (لا تنقرها عادة)
  cliproxyapi-local\            ثنائي وإعدادات CLIProxy

--------------------------------------------------------------------------------
مسارات النقر المزدوج المهمة
--------------------------------------------------------------------------------
  Register:
    addon\00_Register_Native_Messaging\Register_NHP_Native_Messaging_User.bat

  Start All:
    addon\01_Start_All\NHP_Start_All_Servers.bat

  ملاحظة: توجد اختصارات (stubs) بنفس الأسماء القديمة في جذر addon\
  حتى لا تنكسر الروابط القديمة.

--------------------------------------------------------------------------------
البيانات المحمولة
--------------------------------------------------------------------------------
  App Root  = مجلد الإضافة (Desktop\NHP_V30.1_Production_Build)
  Data Root = Desktop\NHP_DATA (سجلات، tmp، ...)