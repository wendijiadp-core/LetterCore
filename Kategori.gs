/**
 * ============================================================================
 * LETTERCORE - KATEGORI MODULE (konfigurasi jenis surat + field per tahap)
 * ============================================================================
 */
var Kategori = (function () {
  'use strict';

  function _ss() { return SpreadsheetApp.openById(ConfigService.get('LETTER_CORE_SPREADSHEET_ID')); }
  function _h(s) { return s.getRange(1, 1, 1, Math.max(s.getLastColumn(), 1)).getDisplayValues()[0]; }

  function _upsert(sheet, record, pk) {
    var headers = _h(sheet), data = sheet.getDataRange().getValues();
    var pkIdx = headers.indexOf(pk), pkVal = String(record[pk] || '').trim();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][pkIdx] || '').trim() === pkVal) {
        var row = [];
        for (var c = 0; c < headers.length; c++) row.push(record.hasOwnProperty(headers[c]) ? record[headers[c]] : data[i][c]);
        sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
        return;
      }
    }
    sheet.appendRow(headers.map(function (h) { return record.hasOwnProperty(h) ? record[h] : ''; }));
  }

  return {
    simpanKategori: function (p) {
      try {
        var id = p.id || ('KAT-' + String(p.nama || 'BARU').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) + Date.now().toString().slice(-3));
        _upsert(_ss().getSheetByName('kategori_surat'), {
          id_kategori: id,
          nama_kategori: p.nama || '',
          deskripsi: p.deskripsi || '',
          wajib_balasan: 'false',
          urutan: p.urutan || 99,
          aktif: (p.aktif === false ? 'FALSE' : 'TRUE'),
          created_at: new Date().toISOString(),
          tujuan_disposisi_default: p.tujuanDisposisi || '',
          balasan_default: p.balasanDefault || '',
          label_tahap2: p.labelTahap2 || '',
          label_tahap3: p.labelTahap3 || '',
          pakai_jadwal: (p.pakaiJadwal ? 'TRUE' : 'FALSE'),
          mode_tempat: p.modeTempat || 'INPUT'
        }, 'id_kategori');
        return { success: true, message: 'Kategori tersimpan.', id: id };
      } catch (e) { return { success: false, message: e.toString() }; }
    },

    simpanField: function (p) {
      try {
        var id = p.idField || ('F-' + Date.now().toString().slice(-6));
        var key = p.fieldKey || String(p.label || 'field').toLowerCase().replace(/[^a-z0-9]+/g, '_');
        _upsert(_ss().getSheetByName('form_schema'), {
          id_field: id,
          id_kategori: p.idKategori,
          field_key: key,
          label: p.label || '',
          tipe: p.tipe || 'text',
          opsi: p.opsi || '',
          required: p.required ? 'true' : 'false',
          placeholder: p.placeholder || '',
          urutan: p.urutan || 1,
          aktif: 'TRUE',
          grup: p.grup || 'UMUM',
          sumber_data: p.sumberData || '',
          opsional: p.opsional ? 'TRUE' : 'FALSE',
          tahap: p.tahap || 3
        }, 'id_field');
        return { success: true, message: 'Field tersimpan.' };
      } catch (e) { return { success: false, message: e.toString() }; }
    },

    hapusField: function (idField) {
      try {
        var s = _ss().getSheetByName('form_schema'), h = _h(s), data = s.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) if (String(data[i][h.indexOf('id_field')] || '').trim() === idField) { s.getRange(i + 1, h.indexOf('aktif') + 1).setValue('FALSE'); break; }
        return { success: true, message: 'Field dinonaktifkan.' };
      } catch (e) { return { success: false, message: e.toString() }; }
    }
  };
})();

if (typeof AppCore !== 'undefined') AppCore.registerModule('Kategori', Kategori);