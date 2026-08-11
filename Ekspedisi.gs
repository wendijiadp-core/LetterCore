var Ekspedisi = (function () {
  'use strict';
  var SHEET = 'surat_ekspedisi';
  var HEADERS = ['id_log','id_surat','tahap','judul','catatan','aktor','timestamp'];
  function _sheet() {
    var ss = SpreadsheetApp.openById(ConfigService.get('LETTER_CORE_SPREADSHEET_ID'));
    var s = ss.getSheetByName(SHEET);
    if (!s) { s = ss.insertSheet(SHEET); s.appendRow(HEADERS); s.setFrozenRows(1); }
    return s;
  }
  function _now() { return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss'); }
  return {
    TAHAP: ['diinput','disposisi_dibuat','tercetak','keputusan','balasan','diterima','selesai_tanpa_balasan'],
    catat: function (idSurat, tahap, judul, catatan, aktor) {
      try { _sheet().appendRow(['LOG-' + Date.now() + '-' + Math.floor(100 + Math.random() * 900), idSurat, tahap, judul || '', catatan || '', aktor || 'Sistem', _now()]); return true; }
      catch (e) { return false; }
    },
    getRiwayat: function (idSurat) {
      var data = _sheet().getDataRange().getDisplayValues();
      var out = [];
      for (var i = 1; i < data.length; i++) if (String(data[i][1]).trim() === String(idSurat).trim()) out.push({ idLog: data[i][0], tahap: data[i][2], judul: data[i][3], catatan: data[i][4], aktor: data[i][5], timestamp: data[i][6] });
      out.sort(function (a, b) { return a.timestamp < b.timestamp ? -1 : 1; });
      return out;
    },
    getSemua: function () {
      var data = _sheet().getDataRange().getDisplayValues();
      var map = {};
      for (var i = 1; i < data.length; i++) {
        var id = String(data[i][1] || '').trim(); if (!id) continue;
        if (!map[id]) map[id] = { tahap: '', ts: '', riwayat: [] };
        var rec = { tahap: data[i][2], judul: data[i][3], catatan: data[i][4], aktor: data[i][5], timestamp: data[i][6] };
        map[id].riwayat.push(rec);
        if (rec.timestamp >= map[id].ts) { map[id].ts = rec.timestamp; map[id].tahap = rec.tahap; }
      }
      return map;
    }
  };
})();
if (typeof AppCore !== 'undefined') AppCore.registerModule('Ekspedisi', Ekspedisi);