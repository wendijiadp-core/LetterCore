/**
 * ============================================================================
 * LETTERCORE - CORE FOUNDATION (AppCore Registry)
 * ============================================================================
 * File: App.gs
 * Pola: IIFE + Dependency Registry (identik LoginCore, label digenerikkan)
 * ============================================================================
 */
var AppCore = (function () {
  'use strict';

  var _modules = {};
  var _config = {};
  var _isBootstrapped = false;

  return {
    /**
     * Memulai Runtime Engine dan memuat konfigurasi awal
     */
    init: function (options) {
      if (_isBootstrapped) {
        console.warn('[AppCore] Runtime sudah diinisialisasi.');
        return this;
      }
      _config = options || {};
      _isBootstrapped = true;
      console.log('[AppCore] Engine initialized. App: ' + (_config.appName || '-') + ' | Env: ' + (_config.env || 'DEVELOPMENT'));
      return this;
    },

    /**
     * Pendaftaran modul ke Core Registry
     */
    registerModule: function (name, moduleInstance) {
      if (_modules[name]) {
        console.warn('[AppCore] Modul "' + name + '" sudah terdaftar. Overwrite dengan instance baru.');
      }
      _modules[name] = moduleInstance;
    },

    /**
     * Ambil instance modul (dengan auto-discovery ke global scope)
     */
    getModule: function (name) {
      if (_modules[name]) return _modules[name];

      var globalScope = (typeof globalThis !== 'undefined') ? globalThis : this;
      if (typeof globalScope[name] !== 'undefined') {
        _modules[name] = globalScope[name];
        return _modules[name];
      }
      throw new Error('[AppCore] Modul "' + name + '" tidak ditemukan di registry.');
    },

    /**
     * Konfigurasi terpusat hasil init()
     */
    getConfig: function (key) {
      if (!key) return _config;
      return _config[key];
    },

    isReady: function () {
      return _isBootstrapped;
    }
  };
})();

// Bootstrap otomatis saat file dimuat
(function _bootstrapAppCore() {
  if (typeof AppCore !== 'undefined' && !AppCore.isReady()) {
    AppCore.init({
      appName: 'LetterCore',
      version: '2.0.0',
      env: 'PRODUCTION'
    });
  }
})();