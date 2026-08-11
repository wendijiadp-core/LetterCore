/**
 * ============================================================================
 * LETTERCORE - EVENT SERVICE (Pub/Sub)
 * ============================================================================
 * File: Event.gs
 * Basis: Event.gs LoginCore (Copy 1:1)
 * ============================================================================
 */
var EventService = (function () {
  'use strict';

  var _listeners = {};

  return {
    on: function (eventName, callback) {
      if (typeof callback !== 'function') {
        throw new Error('[Event] Callback must be a function.');
      }
      if (!_listeners[eventName]) {
        _listeners[eventName] = [];
      }
      _listeners[eventName].push(callback);
    },

    emit: function (eventName, payload) {
      var logger = (typeof AppCore !== 'undefined' && AppCore.isReady && AppCore.isReady()) 
        ? AppCore.getModule('Logger') 
        : null;

      if (!_listeners[eventName] || _listeners[eventName].length === 0) {
        if (logger) logger.debug('Event emitted with zero subscribers:', { event: eventName });
        return;
      }

      if (logger) {
        logger.info('SYSTEM', 'Emitting Event: ' + eventName, { payload: payload, listenersCount: _listeners[eventName].length });
      }

      var handlers = _listeners[eventName];
      for (var i = 0; i < handlers.length; i++) {
        try {
          handlers[i](payload);
        } catch (err) {
          if (logger) logger.error('SYSTEM', 'Error executing event handler for: ' + eventName, err);
        }
      }
    },

    off: function (eventName) {
      if (_listeners[eventName]) {
        delete _listeners[eventName];
      }
    }
  };
})();

if (typeof AppCore !== 'undefined') {
  AppCore.registerModule('Event', EventService);
  AppCore.registerModule('EventService', EventService);
}