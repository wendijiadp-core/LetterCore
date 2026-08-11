/**
 * ============================================================================
 * LETTERCORE - DATE UTILITIES (LENGKAP)
 * ============================================================================
 */
var DateUtil = (function () {
  'use strict';
  var TZ = 'Asia/Jakarta';

  function isValidDate(d) { return d instanceof Date && !isNaN(d.getTime()); }

  /** Parse apapun -> "YYYY-MM-DD" */
  function parseYMD(dateVal) {
    if (!dateVal) return '';
    if (dateVal instanceof Date) return Utilities.formatDate(dateVal, TZ, 'yyyy-MM-dd');
    var str = String(dateVal).trim();
    if (!str) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
    var m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    var d = new Date(str);
    if (isValidDate(d)) return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
    return str;
  }

  /** Ambil tahun (number) dari tanggal apapun */
  function extractYear(dateVal) {
    var ymd = parseYMD(dateVal);
    if (ymd && ymd.length >= 4) {
      var y = parseInt(ymd.substring(0, 4), 10);
      if (!isNaN(y)) return y;
    }
    return new Date().getFullYear();
  }

  /** Format "YYYY-MM-DD" -> "Sabtu, 8 Agustus 2026" */
  function formatIndo(dateVal) {
    var ymd = parseYMD(dateVal);
    if (!ymd || ymd.length < 10) return String(dateVal || '-');
    var p = ymd.split('-');
    var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    if (!isValidDate(d)) return String(dateVal || '-');
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  /** Format waktu -> "HH:mm" */
  function formatTime(val) {
    if (!val) return '';
    if (val instanceof Date) return Utilities.formatDate(val, TZ, 'HH:mm');
    var m = String(val).match(/(\d{1,2}:\d{2})/);
    return m ? m[1] : String(val);
  }

  function format(dateObj, pattern) {
    return Utilities.formatDate(isValidDate(dateObj) ? dateObj : new Date(), TZ, pattern || 'yyyy-MM-dd HH:mm:ss');
  }

  return {
    isValidDate: isValidDate,
    parseYMD: parseYMD,
    extractYear: extractYear,
    formatIndo: formatIndo,
    formatTime: formatTime,
    format: format
  };
})();

if (typeof AppCore !== 'undefined') AppCore.registerModule('DateUtil', DateUtil);