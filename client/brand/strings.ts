// English and Arabic for the starter's own UI (login, header, empty states). SYNAPSE-OWNED.
// An app keeps its own strings in its own catalogue: see defineStrings in ./i18n.ts.

const en = {
  signInTitle: 'Sign in with Noon',
  signInHint: 'Use your Noon staff account to continue.',
  signInButton: 'Sign in with Noon',
  signInNotStaff: "This account isn't a Noon staff account. Sign in with your Noon work email.",
  signInExpired: 'Sign-in expired or was interrupted. Please try again.',
  signInFailed: 'Sign-in failed. Please try again.',
  themeToDark: 'Switch to dark mode',
  themeToLight: 'Switch to light mode',
  languageSwitch: 'العربية',
  languageSwitchTitle: 'Change the language to Arabic',
  signInTab: 'Sign in',
  loading: 'Loading…',
  dataUnavailable: "This data isn't available right now. Reload the page to try again.",
  notConnected: "This isn't connected to Noon data yet.",
  loadFailed: "This couldn't load just now. Try again in a moment.",
  noDataYet: 'No data for this period yet.',
  chartUnavailable: "This chart isn't available right now. Reload the page to try again.",
  chartNotConnected: "This chart isn't connected to Noon data yet.",
  chartLoadFailed: "This chart couldn't load just now. Try again in a moment.",
  showNumbers: 'Show the numbers',
  updated: 'Updated {time}',
  truncated: 'Showing the first {count} rows.',
  appPages: 'App pages',
  notFound: "This page doesn't exist yet.",
  goHome: 'Go to the home page',
  notBuiltTitle: "This app hasn't been built yet",
  notBuiltIntro: "It's connected to Noon and ready to become something. Two steps get it there:",
  notBuiltStep1:
    'Open the Synapse console (the Run view in the Replit workspace) and finish its checklist.',
  notBuiltStep2:
    "Paste the kickoff prompt from the console's Home tab to tell the agent what to build.",
};

type StarterKey = keyof typeof en;

export const STARTER_STRINGS: { en: Record<StarterKey, string>; ar: Record<StarterKey, string> } = {
  en,
  ar: {
    signInTitle: 'تسجيل الدخول عبر نون',
    signInHint: 'استخدم حساب الموظف في نون للمتابعة.',
    signInButton: 'تسجيل الدخول عبر نون',
    signInNotStaff: 'هذا الحساب ليس حساب موظف في نون. سجّل الدخول ببريد العمل في نون.',
    signInExpired: 'انتهت مهلة تسجيل الدخول أو انقطع. حاول مرة أخرى.',
    signInFailed: 'تعذّر تسجيل الدخول. حاول مرة أخرى.',
    themeToDark: 'التبديل إلى الوضع الداكن',
    themeToLight: 'التبديل إلى الوضع الفاتح',
    languageSwitch: 'English',
    languageSwitchTitle: 'تغيير اللغة إلى الإنجليزية',
    signInTab: 'تسجيل الدخول',
    loading: 'جارٍ التحميل…',
    dataUnavailable: 'هذه البيانات غير متاحة الآن. أعد تحميل الصفحة للمحاولة مرة أخرى.',
    notConnected: 'لم يُربط هذا ببيانات نون بعد.',
    loadFailed: 'تعذّر التحميل الآن. حاول مرة أخرى بعد قليل.',
    noDataYet: 'لا توجد بيانات لهذه الفترة بعد.',
    chartUnavailable: 'هذا الرسم البياني غير متاح الآن. أعد تحميل الصفحة للمحاولة مرة أخرى.',
    chartNotConnected: 'لم يُربط هذا الرسم البياني ببيانات نون بعد.',
    chartLoadFailed: 'تعذّر تحميل هذا الرسم البياني الآن. حاول مرة أخرى بعد قليل.',
    showNumbers: 'عرض الأرقام',
    updated: 'آخر تحديث {time}',
    truncated: 'تُعرض الصفوف الأولى فقط ({count}).',
    appPages: 'صفحات التطبيق',
    notFound: 'هذه الصفحة غير موجودة بعد.',
    goHome: 'الذهاب إلى الصفحة الرئيسية',
    notBuiltTitle: 'لم يُبنَ هذا التطبيق بعد',
    notBuiltIntro: 'التطبيق متصل بنون وجاهز للبناء. تكفي خطوتان:',
    notBuiltStep1: 'افتح وحدة تحكم Synapse (شاشة Run في مساحة عمل Replit) وأكمل قائمة التحقق فيها.',
    notBuiltStep2:
      'الصق موجّه البدء (kickoff prompt) من تبويب Home في وحدة التحكم لتخبر الوكيل بما يبنيه.',
  },
};
