/**
 * ============================================================================
 * LETTERCORE - LOGGER (Centralized Logging)
 * ============================================================================
 * File: Logger.gs
 * Basis: Logger.gs LoginCore (adaptasi nama sheet via Config)
 * ============================================================================
 */
var LoggerService = (function () {
  'use strict';

  var _levels = { DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4 };
  var _currentLevel = 'INFO'; // Default level

  function _getSheet() {
    var sheetName = (typeof ConfigService !== 'undefined') ? ConfigService.sheet('SYSTEM_LOGS') : 'SystemLogs';
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(['log_id', 'timestamp', 'level', 'actor', 'action', 'target_id', 'details']);
      sheet.setFrozenRows(1);
    }
    return sheet;
  }

  function _writeLog(level, actor, action, targetId, details) {
    try {
      if (_levels[level] < _levels[_currentLevel]) return; // Skip jika level lebih rendah dari config

      var sheet = _getSheet();
      var logId = 'LOG-' + Utilities.getUuid().substring(0, 8);
      var timestamp = new Date().toISOString();
      
      // Sanitasi detail (max 50k char untuk cell Google Sheets)
      var safeDetails = typeof details === 'object' ? JSON.stringify(details) : String(details || '');
      if (safeDetails.length > 49000) safeDetails = safeDetails.substring(0, 49000) + '... [truncated]';

      sheet.appendRow([
        "'" + logId,
        "'" + timestamp,
        level,
        actor || 'SYSTEM',
        action,
        targetId || '-',
        safeDetails
      ]);
    } catch (e) {
      console.error('[Logger] Gagal menulis ke sheet: ' + e.toString());
    }
  }

  return {
    setLevel: function (level) {
      if (_levels[level]) _currentLevel = level;
    },

    debug: function (message, context) {
      console.log('[DEBUG] ' + message);
      _writeLog('DEBUG', 'SYSTEM', message, null, context);
    },

    info: function (actor, action, targetId, details) {
      console.log('[INFO] [' + actor + '] ' + action);
      _writeLog('INFO', actor, action, targetId, details);
    },

    warn: function (actor, action, reason) {
      console.warn('[WARN] [' + actor + '] ' + action + ': ' + reason);
      _writeLog('WARN', actor, action, null, { reason: reason });
    },

    error: function (actor, action, errorObj) {
      console.error('[ERROR] [' + actor + '] ' + action);
      var errDetails = errorObj ? (errorObj.stack || errorObj.message || String(errorObj)) : 'Unknown error';
      _writeLog('ERROR', actor, action, null, { error: errDetails });
    }
  };
})();

if (typeof AppCore !== 'undefined') {
  AppCore.registerModule('Logger', LoggerService);
}