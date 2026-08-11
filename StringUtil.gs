/**
 * ============================================================================
 * LETTERCORE - STRING UTILITIES
 * ============================================================================
 * File: StringUtil.gs
 * Basis: StringUtil.gs LoginCore (Copy 1:1)
 * ============================================================================
 */
var StringUtil = (function () {
  'use strict';

  function slugify(text) {
    if (!text) return '';
    return text.toString().toLowerCase().trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-');
  }

  function truncate(str, maxLength) {
    if (!str || typeof str !== 'string') return '';
    var max = maxLength || 0;
    if (str.length <= max) return str;
    if (max <= 3) return str.substring(0, max);
    return str.substring(0, max - 3) + '...';
  }

  function generateRandomId(length) {
    var len = length || 8;
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var result = '';
    for (var i = 0; i < len; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  function generateUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  return {
    slugify: slugify,
    truncate: truncate,
    generateRandomId: generateRandomId,
    generateUuid: generateUuid
  };
})();

if (typeof AppCore !== 'undefined') {
  AppCore.registerModule('StringUtil', StringUtil);
}