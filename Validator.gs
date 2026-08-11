/**
 * ============================================================================
 * LETTERCORE - VALIDATOR
 * ============================================================================
 * File: Validator.gs
 * Basis: Validator.gs LoginCore (Copy 1:1)
 * ============================================================================
 */
var Validator = (function () {
  'use strict';

  function isEmpty(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    if (value instanceof Date) return false;
    if (typeof value === 'object') {
      return Object.keys(value).length === 0 && value.constructor === Object;
    }
    return false;
  }

  function isEmail(email) {
    if (isEmpty(email)) return false;
    var regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(String(email).toLowerCase().trim());
  }

  function isValidUsername(username) {
    if (isEmpty(username)) return false;
    var regex = /^[a-zA-Z0-9_]{3,20}$/;
    return regex.test(String(username).trim());
  }

  function isValidPassword(password, minLength) {
    var min = minLength || 8;
    if (isEmpty(password)) return false;
    return typeof password === 'string' && password.length >= min;
  }

  function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str.trim().replace(/[<>]/g, '');
  }

  function isNumeric(value) {
    if (typeof value === 'number') return !isNaN(value);
    if (typeof value !== 'string') return false;
    return !isNaN(value) && !isNaN(parseFloat(value)) && value.trim() !== '';
  }

  function isValidJson(str) {
    if (typeof str !== 'string' || isEmpty(str)) return false;
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  }

  return {
    isEmpty: isEmpty,
    isEmail: isEmail,
    isValidUsername: isValidUsername,
    isValidPassword: isValidPassword,
    sanitizeString: sanitizeString,
    isNumeric: isNumeric,
    isValidJson: isValidJson
  };
})();

if (typeof AppCore !== 'undefined') {
  AppCore.registerModule('Validator', Validator);
}