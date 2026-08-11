/**
 * ============================================================================
 * LETTERCORE - DISPOSISI MODULE (Template + Keputusan + Status)
 * ============================================================================
 */
var Disposisi = (function () {
  'use strict';

  var SHEET = 'disposisi';
  function _ss() { return SpreadsheetApp.openById(ConfigService.get('LETTER_CORE_SPREADSHEET_ID')); }
  function _sheet() {
    var s = _ss().getSheetByName(SHEET);
    if (!s) { s = _ss().insertSheet(SHEET); s.appendRow(['id_disposisi','id_surat','doc_id','doc_url','created_at','updated_at','status_cetak','keputusan','perlu_balasan','jenis_balasan','tenggat','dicatat_oleh']); s.setFrozenRows(1); }
    return s;
  }
  function _h(sheet) { return sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getDisplayValues()[0]; }
  function _now() { return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss'); }
  function _actor(user) { return user && user.fullName ? user.fullName + ' (@' + (user.username || '-') + ')' : 'Sistem'; }

  return {
    generateOtomatis: function (suratData) {
      try {
        var TEMPLATE_ID = ConfigService.get('TEMPLATE_DISPOSISI_DOC_ID');
        var FOLDER_ID = ConfigService.get('DRIVE_FOLDER_ID');
        if (!TEMPLATE_ID || !FOLDER_ID) return null;
        var folder = DriveApp.getFolderById(FOLDER_ID);
        var docId = suratData.existingIdDisposisi || '';
        if (docId && docId !== '-') { try { DriveApp.getFileById(docId).setTrashed(true); } catch (e) {} }
        var newFile = DriveApp.getFileById(TEMPLATE_ID).makeCopy('Disposisi_' + String(suratData.agendaNomor || 'DRAFT').replace(/\//g, '-') + '_' + String(suratData.pengirim || 'Surat').replace(/[^a-zA-Z0-9]/g, ''), folder);
        docId = newFile.getId();
        var doc = DocumentApp.openById(docId);
        var body = doc.getBody();

        var tglK = '-', lok = '-';
        if (suratData.jadwalList && suratData.jadwalList.length) {
          var tA = [], lA = [];
          suratData.jadwalList.forEach(function (j) { if (j.tglMulai || j.tglKegiatan) tA.push(j.tglMulai || j.tglKegiatan); if (j.tempatKegiatan) lA.push(j.tempatKegiatan); });
          if (tA.length) tglK = tA.join(', ');
          if (lA.length) lok = lA.join(', ');
        }

        var rep = {
          NO_AGENDA: String(suratData.agendaNomor || '-').split('/').pop(),
          NOMOR_SURAT: suratData.nomorSurat || '-', TGL_SURAT: DateUtil.formatIndo(suratData.tglSurat),
          TGL_DITERIMA: DateUtil.formatIndo(suratData.tglDiterima), PENGIRIM: suratData.pengirim || '-',
          TUJUAN: suratData.tujuan || '-', PERIHAL: suratData.perihal || '-',
          NAMA_KEGIATAN: suratData.deskripsi || suratData.perihal || '-', TGL_KEGIATAN: tglK, LOKASI: lok,
          PENANGGUNG_JAWAB: suratData.penanggungJawab || '-',
          PIC_KONTAK: (suratData.pic || '-') + (suratData.kontak ? ' (' + suratData.kontak + ')' : ''),
          KETERANGAN: suratData.keterangan || '-'
        };
        for (var key in rep) {
          body.replaceText('\\{\\{\\s*' + key + '\\s*\\}\\}', String(rep[key]));
          body.replaceText('\\{\\s*' + key + '\\s*\\}', String(rep[key]));
        }
        doc.saveAndClose();
        try { newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}

        // Catat/refresh baris disposisi
        var s = _sheet(), h = _h(s), data = s.getDataRange().getValues();
        var found = -1;
        for (var i = 1; i < data.length; i++) if (String(data[i][h.indexOf('id_surat')]).trim() === String(suratData.idSurat).trim()) { found = i + 1; break; }
        if (found === -1) {
          s.appendRow(['DSP-' + Date.now(), suratData.idSurat, docId, newFile.getUrl(), _now(), _now(), '', '', '', '', '', '']);
        } else {
          s.getRange(found, h.indexOf('doc_id') + 1).setValue(docId);
          s.getRange(found, h.indexOf('doc_url') + 1).setValue(newFile.getUrl());
          s.getRange(found, h.indexOf('updated_at') + 1).setValue(_now());
        }
        return { docId: docId, docUrl: newFile.getUrl() };
      } catch (e) {
        console.error('[Disposisi] ' + e.toString());
        return null;
      }
    },

    /** Keputusan pimpinan setelah lembar kembali */
    catatKeputusan: function (p) {
      try {
        var s = _sheet(), h = _h(s), data = s.getDataRange().getValues();
        var row = -1;
        for (var i = 1; i < data.length; i++) if (String(data[i][h.indexOf('id_surat')]).trim() === String(p.idSurat).trim()) { row = i + 1; break; }
        if (row === -1) { s.appendRow(['DSP-' + Date.now(), p.idSurat, '', '', _now(), _now(), '', '', '', '', '', '']); data = s.getDataRange().getValues(); row = s.getLastRow(); }
        s.getRange(row, h.indexOf('keputusan') + 1).setValue(p.keputusan || '');
        s.getRange(row, h.indexOf('perlu_balasan') + 1).setValue(p.perluBalasan ? 'TRUE' : 'FALSE');
        s.getRange(row, h.indexOf('jenis_balasan') + 1).setValue(p.jenisBalasan || '');
        s.getRange(row, h.indexOf('tenggat') + 1).setValue("'" + (p.tenggat || ''));
        s.getRange(row, h.indexOf('dicatat_oleh') + 1).setValue(_actor(p.user));
        s.getRange(row, h.indexOf('updated_at') + 1).setValue(_now());
        Ekspedisi.catat(p.idSurat, 'keputusan', 'Keputusan pimpinan dicatat', (p.perluBalasan ? 'Perlu balasan: ' + (p.jenisBalasan || '-') : 'Tidak perlu balasan') + (p.keputusan ? ' — ' + p.keputusan : ''), _actor(p.user));
        return { success: true, message: 'Keputusan disposisi tersimpan.' };
      } catch (e) { return { success: false, message: e.toString() }; }
    },

    tandaiTercetak: function (p) {
      try {
        var s = _sheet(), h = _h(s), data = s.getDataRange().getValues();
        var row = -1;
        for (var i = 1; i < data.length; i++) if (String(data[i][h.indexOf('id_surat')]).trim() === String(p.idSurat).trim()) { row = i + 1; break; }
        if (row === -1) { s.appendRow(['DSP-' + Date.now(), p.idSurat, '', '', _now(), _now(), 'TRUE', '', '', '', '', '']); }
        else { s.getRange(row, h.indexOf('status_cetak') + 1).setValue('TRUE'); s.getRange(row, h.indexOf('updated_at') + 1).setValue(_now()); }
        Ekspedisi.catat(p.idSurat, 'tercetak', 'Lembar disposisi dicetak & diserahkan', '', _actor(p.user));
        return { success: true, message: 'Ditandai tercetak.' };
      } catch (e) { return { success: false, message: e.toString() }; }
    },

    tandaiDiterima: function (p) {
      Ekspedisi.catat(p.idSurat, 'diterima', 'Surat diterima pemohon', p.catatan || '', _actor(p.user));
      return { success: true, message: 'Ekspedisi selesai.' };
    },

    getBySurat: function (idSurat) {
      var s = _sheet(), h = _h(s), data = s.getDataRange().getDisplayValues();
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][h.indexOf('id_surat')]).trim() === String(idSurat).trim()) {
          var rec = {};
          for (var c = 0; c < h.length; c++) rec[h[c]] = data[i][c];
          return rec;
        }
      }
      return null;
    }
  };
})();

if (typeof AppCore !== 'undefined') AppCore.registerModule('Disposisi', Disposisi);