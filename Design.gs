/**
 * ============================================================================
 * LETTERCORE - DESIGN SERVICE (Standard API Response)
 * ============================================================================
 * File: Design.gs
 * Basis: Design.gs LoginCore (Copy 1:1)
 * ============================================================================
 */
var DesignService = (function () {
  'use strict';

  function _createResponse(success, code, message, data) {
    return {
      success: success,
      code: code,
      message: message || (success ? 'Success' : 'Error'),
      data: data || null,
      meta: {
        timestamp: new Date().toISOString(),
        version: 'v2.0.0'
      }
    };
  }

  return {
    success: function (data, message) {
      return _createResponse(true, 200, message || 'Operation completed successfully.', data);
    },

    error: function (message, code, errorDetails) {
      var statusCode = code || 400;
      return _createResponse(false, statusCode, message || 'An error occurred.', errorDetails);
    }
  };
})();

if (typeof AppCore !== 'undefined') {
  AppCore.registerModule('Design', DesignService);
  AppCore.registerModule('DesignService', DesignService);
}