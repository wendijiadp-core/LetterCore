/**
 * ============================================================================
 * LETTERCORE - MASTER DATA MODULE (Card Picker Sources)
 * ============================================================================
 */
var Master = (function () {
  'use strict';

  function _ss() { return SpreadsheetApp.openById(ConfigService.get('LETTER_CORE_SPREADSHEET_ID')); }

  function _read(sheetName) {
    var s = _ss().getSheetByName(sheetName);
    if (!s || s.getLastRow() < 2) return [];
    var data = s.getDataRange().getDisplayValues();
    var headers = data[0];
    var out = [];
    for (var i = 1; i < data.length; i++) {
      var rec = {};
      for (var c = 0; c < headers.length; c++) rec[headers[c]] = data[i][c];
      if (String(rec['aktif'] || '').toUpperCase() === 'TRUE') out.push(rec);
    }
    return out;
  }

  return {
    /** jenis: 'tempat' | 'barang' | 'kendaraan' */
    getAset: function (jenis) {
      return _read('master_aset').filter(function (a) {
        return !jenis || String(a['jenis'] || '').trim() === jenis;
      });
    },
    getOrang: function () { return _read('master_orang'); }
  };
})();

if (typeof AppCore !== 'undefined') AppCore.registerModule('Master', Master);