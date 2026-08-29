/**
 * ============================================================================
 * LETTERCORE - CONFIG (Environment Profiles + Konstanta Aplikasi)
 * ============================================================================
 * FINAL: independen (tanpa kegiatan) + integrasi SpaceCore
 * ============================================================================
 */
var ConfigService = (function () {
  'use strict';

  var _environments = {
    DEVELOPMENT: { env: 'DEVELOPMENT', debug: true,  logLevel: 'DEBUG', cacheTTL: 300  },
    STAGING:     { env: 'STAGING',     debug: true,  logLevel: 'INFO',  cacheTTL: 1800 },
    PRODUCTION:  { env: 'PRODUCTION',  debug: false, logLevel: 'ERROR', cacheTTL: 3600 }
  };

  var _app = {
    APP_NAME: 'LetterCore',
    VERSION: '2.1.0',

    BYPASS_SSO: true,
    DEV_MOCK_USER: {
      username: 'admin_dev',
      fullName: 'Administrator Development',
      role: 'ADMIN',
      email: 'admin.dev@lettercore.local'
    },

    SHARED_SPREADSHEET_ID: '17QyHHyEoQSu2gM_njE-FUnuwXTE5g6q5XJ2WYd1zLLk',
    LETTER_CORE_SPREADSHEET_ID: '1nXmfXEE5k8zyyrWNtA7cnNxPL2wcstLkA_f-icCyjos',
    SPACE_CORE_SPREADSHEET_ID: '12YGxzgr2t00U4HvMTb8wgQUj2-QzCKwuY1Y7i7HZXzo',

    LAUNCHER_PORTAL_URL: 'https://script.google.com/a/macros/upi.edu/s/AKfycbwYbsH_IYOZsNbtK2ThELvOejqi8sy72Hjv2mTsO_gZwAiZVd9ouYxF0Td58azx2k5m/exec',
    LOGIN_CORE_URL:      'https://script.google.com/a/macros/upi.edu/s/AKfycbwYbsH_IYOZsNbtK2ThELvOejqi8sy72Hjv2mTsO_gZwAiZVd9ouYxF0Td58azx2k5m/exec',

    SSO_TOKEN_SHEET: 'sso_tokens',
    SESSION_PREFIX: 'lettercore_session_',
    SESSION_DURATION_SECONDS: 28800,
    VALIDATION_METHOD: 'DIRECT_DB',
    ENABLE_ONE_TIME_TOKEN: true,

    DRIVE_FOLDER_ID: '1oZQ3jXUUmhUFq3-4GPsnDlj6UWXjUpiE',
    TEMPLATE_DISPOSISI_DOC_ID: '14TBW-8MzI8Y2BciUUHFuA-_R9pfRg3AECS90OuX0q38',

    SHEETS: {
      SURAT_MASUK:       'Surat_Masuk',
      DETAIL_JADWAL:     'Detail_Jadwal',
      KATEGORI_SURAT:    'kategori_surat',
      FORM_SCHEMA:       'form_schema',
      SURAT_MASUK_CUSTOM:'surat_masuk_custom',
      DISPOSISI:         'disposisi',
      SURAT_KELUAR:      'surat_keluar',
      TEMPLATE_SURAT:    'template_surat',
      APP_CONFIG:        'app_config',
      AGENDA:            'agenda',
      SYSTEM_LOGS:       'SystemLogs'
    }
  };

  return {
    getEnvironment: function (envName) {
      var selected = envName ? String(envName).toUpperCase() : 'DEVELOPMENT';
      if (!_environments[selected]) {
        console.warn('[Config] Environment "' + envName + '" tidak ditemukan. Fallback ke DEVELOPMENT.');
        return _environments.DEVELOPMENT;
      }
      return _environments[selected];
    },
    get: function (key) { return _app[key]; },
    sheet: function (key) { return _app.SHEETS[key] || key; },
    all: function () { return _app; },
    isBypassSSO: function () { return _app.BYPASS_SSO === true; },
    getMockUser: function () { return _app.DEV_MOCK_USER; }
  };
})();

if (typeof AppCore !== 'undefined') {
  AppCore.registerModule('Config', ConfigService);
  AppCore.registerModule('ConfigService', ConfigService);
}