/**
 * ============================================================================
 * LETTERCORE - DISPOSISI MODULE (Template Dinamis + Queue Processing)
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

  /* ===== TEMPLATE PER KATEGORI (fallback: default → config global) ===== */
  function _getTemplateDocId(kategoriId) {
    var rows = []; try { rows = Storage.read('template_disposisi') || []; } catch (e) {}
    var act = rows.filter(function (r) { return !(r.aktif === false || r.aktif === 'false'); });
    if (kategoriId) {
      var hit = act.find(function (r) { return String(r.kategori_id) === String(kategoriId); });
      if (hit && hit.doc_id) return hit.doc_id;
    }
    var def = act.find(function (r) { return String(r.kategori_id) === 'default'; });
    if (def && def.doc_id) return def.doc_id;
    return ConfigService.get('TEMPLATE_DISPOSISI_DOC_ID') || '';
  }

  /* ===== DATA MAP untuk placeholder (termasuk alias) ===== */
  function _buildDataMap(s) {
    var tglK = '-', lok = '-';
    if (s.jadwalList && s.jadwalList.length) {
      var tA = [], lA = [];
      s.jadwalList.forEach(function (j) { if (j.tglMulai || j.tglKegiatan) tA.push(j.tglMulai || j.tglKegiatan); if (j.tempatKegiatan) lA.push(j.tempatKegiatan); });
      if (tA.length) tglK = tA.join(', ');
      if (lA.length) lok = lA.join(', ');
    }
    var map = {
      NO_AGENDA: String(s.agendaNomor || '-').split('/').pop(),
      NOMOR_SURAT: s.nomorSurat || '-', TGL_SURAT: DateUtil.formatIndo(s.tglSurat),
      TGL_DITERIMA: DateUtil.formatIndo(s.tglDiterima), PENGIRIM: s.pengirim || '-',
      PEMOHON: s.pengirim || '-', TUJUAN: s.tujuan || '-', PERIHAL: s.perihal || '-',
      DESKRIPSI: s.deskripsi || s.perihal || '-', NAMA_KEGIATAN: s.deskripsi || s.perihal || '-',
      TGL_KEGIATAN: tglK, LOKASI: lok, PENANGGUNG_JAWAB: s.penanggungJawab || '-',
      PIC: s.pic || '-', KONTAK: s.kontak || '-',
      PIC_KONTAK: (s.pic || '-') + (s.kontak ? ' (' + s.kontak + ')' : ''),
      KETERANGAN: s.keterangan || '-'
    };
    ['pengirim','tujuan','perihal','deskripsi','nomorSurat','agendaNomor','pic','kontak','penanggungJawab'].forEach(function (k) { if (s[k]) map[k] = s[k]; });
    if (s.customFields) for (var k in s.customFields) map[k] = s.customFields[k];

    /* B9: placeholder jadwal cerdas (multi-jadwal dipisah " ; ") */
    var tempatArr = [], tglArr = [], waktuArr = [];
    (s.jadwalList || []).forEach(function (j) {
      if (j.tempatKegiatan) tempatArr.push(j.tempatKegiatan);
      var t = j.tglMulai || j.tglKegiatan; if (t) tglArr.push(t);
      waktuArr.push(_smartWaktu(j.waktuMulai, j.waktuSelesai));
    });
    map.tempatKegiatan = tempatArr.join(' ; ') || '-';
    map.tglKegiatan = tglArr.join(' ; ') || '-';
    map.waktuKegiatan = waktuArr.join(' ; ') || '-';
    map.WAKTU = waktuArr.join(' ; ') || '-';
    if (tempatArr.length) map.LOKASI = tempatArr.join(' ; ');
    return map;
  }
  function _smartWaktu(wM, wS) {
    var f = function (v) { return String(v || '').replace(':', '.'); };
    var a = f(wM); if (!a) return '-';
    var b = String(wS || '').trim().toLowerCase();
    if (!b || b === 'selesai' || b === 's.d. selesai') return a + ' WIB s.d. selesai';
    return a + ' - ' + f(wS) + ' WIB';
  }

  /* ===== REPLACE DINAMIS: placeholder manager + key legacy ===== */
  function _replaceDynamic(body, dataMap) {
    /* 1) mulai dari legacy + field langsung */
    var merged = {};
    for (var k in dataMap) merged[k] = dataMap[k];
    /* 2) Kelola Placeholder MENIMPA legacy bila key sama */
    try {
      var ph = Storage.read('placeholder_surat') || [];
      ph.forEach(function (r) {
        var key = String(r.key || '').trim(), fk = String(r.fieldKey || '').trim();
        if (!key || !fk) return;
        var val = dataMap[fk] !== undefined ? dataMap[fk] : (dataMap[fk.toUpperCase()] !== undefined ? dataMap[fk.toUpperCase()] : '');
        merged[key] = String(val);
      });
    } catch (e) {}
    /* 2b) terapkan transformasi (ganti teks / format tanggal) */
    try { for (var mk in merged) merged[mk] = TransformasiPH.terapkan(mk, mk, merged[mk]); } catch (e) {}
    /* 3) SATU pass penggantian */
    for (var key in merged) {
      body.replaceText('\\{\\{\\s*' + key + '\\s*\\}\\}', String(merged[key]));
      body.replaceText('\\{\\s*' + key + '\\s*\\}', String(merged[key]));
    }
  }

  return {
    generateOtomatis: function (suratData) {
      try {
        /* kategori: dari payload, atau baca kolom Kategori di Surat_Masuk */
        var kategoriId = suratData.kategoriId || '';
        if (!kategoriId) {
          try {
            var ss = _ss().getSheetByName('Surat_Masuk');
            if (ss) {
              var hS = _h(ss), dS = ss.getDataRange().getValues();
              for (var a = 1; a < dS.length; a++) {
                if (String(dS[a][hS.indexOf('ID Surat')]).replace(/^'/, '').trim() === String(suratData.idSurat).trim()) {
                  kategoriId = String(dS[a][hS.indexOf('Kategori')] || ''); break;
                }
              }
            }
          } catch (e) {}
        }

        var TEMPLATE_ID = _getTemplateDocId(kategoriId);
        if (!TEMPLATE_ID) return null;

        /* subfolder Disposisi/ */
        var rootFolderId = ConfigService.get('DRIVE_FOLDER_ID');
        if (!rootFolderId || rootFolderId === 'MASUKKAN_ID_FOLDER_LETTERCORE_DISINI') return null;
        var rootFolder = DriveApp.getFolderById(rootFolderId);
        var dispFolders = rootFolder.getFoldersByName('Disposisi');
        var folder = dispFolders.hasNext() ? dispFolders.next() : rootFolder.createFolder('Disposisi');

        var docId = suratData.existingIdDisposisi || '';
        if (docId && docId !== '-') { try { DriveApp.getFileById(docId).setTrashed(true); } catch (e) {} }
        var newFile = DriveApp.getFileById(TEMPLATE_ID).makeCopy('Disposisi_' + String(suratData.agendaNomor || 'DRAFT').replace(/\//g, '-') + '_' + String(suratData.pengirim || 'Surat').replace(/[^a-zA-Z0-9]/g, ''), folder);
        docId = newFile.getId();
        var doc = DocumentApp.openById(docId);
        var body = doc.getBody();

        _replaceDynamic(body, _buildDataMap(suratData));
        doc.saveAndClose();
        try { newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}

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

    /* ===== KELOLA TEMPLATE DISPOSISI (registri per kategori) ===== */
    getDaftarTemplateDisposisi: function () {
      return Storage.read('template_disposisi') || [];
    },
    simpanTemplateDisposisi: function (p) {
      var kategoriId = p.kategoriId || 'default';
      var docId = String(p.docId || '').trim();
      var m = docId.match(/[-\w]{25,}/); if (m) docId = m[0];   /* terima URL atau ID */
      var rows = Storage.read('template_disposisi') || [];
      var existing = null;
      for (var i = 0; i < rows.length; i++) if (String(rows[i].kategori_id) === String(kategoriId)) { existing = rows[i]; break; }
      var rec = {
        id_template_disp: existing ? (existing.id_template_disp || ('TDP-' + Date.now())) : ('TDP-' + Date.now()),
        kategori_id: kategoriId, nama_template: p.namaTemplate || kategoriId,
        doc_id: docId, aktif: true, created_at: new Date()
      };
      var ok = Storage.save('template_disposisi', rec);
      return ok ? { success: true, message: 'Template disposisi tersimpan.' } : { success: false, message: 'Gagal menyimpan template.' };
    },
    hapusTemplateDisposisi: function (kategoriId) {
      var ok = Storage.remove('template_disposisi', { kategori_id: kategoriId });
      return { success: ok, message: ok ? 'Template disposisi dihapus.' : 'Template tidak ditemukan.' };
    },

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

        if (!p.perluBalasan) {
          Ekspedisi.catat(p.idSurat, 'selesai_tanpa_balasan', 'Proses selesai — tidak perlu balasan', '', _actor(p.user));
        }

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
    },

    /* ===== ANTREAN: proses semua surat di doc_queue ===== */
    processQueue: function () {
      var rows = []; try { rows = Storage.read('doc_queue') || []; } catch (e) { rows = []; }
      var processed = 0;
      rows.forEach(function (r) {
        try {
          var idSurat = String(r.id_surat || '').trim();
          if (!idSurat) return;
          var res = Disposisi.generateForSurat(idSurat);
          if (res && res.docId) {
            Storage.remove('doc_queue', { id_surat: idSurat });
            processed++;
          } else {
            /* gagal: naikkan attempts, biarkan retry */
            var att = parseInt(r.attempts || 0, 10) + 1;
            if (att >= 3) Storage.remove('doc_queue', { id_surat: idSurat });
            else Storage.save('doc_queue', { id_surat: idSurat, enqueued_at: r.enqueued_at, attempts: att });
          }
        } catch (e) { console.error('[Disposisi.processQueue] ' + e); }
      });
      return { success: true, message: processed + ' disposisi diproses.' };
    },

    /* ===== ON-DEMAND: generate untuk satu surat tertentu ===== */
    generateForSurat: function (idSurat) {
      try {
        idSurat = String(idSurat || '').replace(/^'/, '').trim();
        var sS = SpreadsheetApp.openById(ConfigService.get('LETTER_CORE_SPREADSHEET_ID')).getSheetByName('Surat_Masuk');
        var hS = sS.getRange(1, 1, 1, sS.getLastColumn()).getDisplayValues()[0];
        var dS = sS.getDataRange().getValues();
        var suratData = null;
        for (var i = 1; i < dS.length; i++) {
          if (String(dS[i][hS.indexOf('ID Surat')] || '').replace(/^'/, '').trim() === idSurat) {
            suratData = {
              idSurat: idSurat,
              agendaNomor: String(dS[i][hS.indexOf('No Agenda')] || ''),
              nomorSurat: String(dS[i][hS.indexOf('Nomor Surat')] || ''),
              tglSurat: String(dS[i][hS.indexOf('Tgl Surat')] || ''),
              tglDiterima: String(dS[i][hS.indexOf('Tgl Diterima')] || ''),
              pengirim: String(dS[i][hS.indexOf('Pengirim')] || ''),
              tujuan: String(dS[i][hS.indexOf('Tujuan')] || ''),
              perihal: String(dS[i][hS.indexOf('Perihal')] || ''),
              deskripsi: String(dS[i][hS.indexOf('Deskripsi')] || ''),
              penanggungJawab: String(dS[i][hS.indexOf('Penanggung Jawab')] || ''),
              pic: String(dS[i][hS.indexOf('PIC')] || ''),
              kontak: String(dS[i][hS.indexOf('Kontak')] || ''),
              keterangan: String(dS[i][hS.indexOf('Keterangan')] || ''),
              kategoriId: String(dS[i][hS.indexOf('Kategori')] || ''),
              existingIdDisposisi: String(dS[i][hS.indexOf('ID Disposisi')] || ''),
              existingUrlDisposisi: String(dS[i][hS.indexOf('URL Disposisi')] || '')
            };
            break;
          }
        }
        if (!suratData) return null;

        /* ambil jadwal & custom */
        try {
          var jS = SpreadsheetApp.openById(ConfigService.get('LETTER_CORE_SPREADSHEET_ID')).getSheetByName('Detail_Jadwal');
          var hJ = jS.getRange(1, 1, 1, jS.getLastColumn()).getDisplayValues()[0];
          var dJ = jS.getDataRange().getValues();
          suratData.jadwalList = [];
          for (var j = 1; j < dJ.length; j++) {
            if (String(dJ[j][hJ.indexOf('ID Surat')] || '').replace(/^'/, '').trim() === idSurat) {
              suratData.jadwalList.push({
                tempatKegiatan: String(dJ[j][hJ.indexOf('Tempat Kegiatan')] || '-'),
                tglMulai: String(dJ[j][hJ.indexOf('Tgl Mulai')] || ''),
                tglSelesai: String(dJ[j][hJ.indexOf('Tgl Selesai')] || ''),
                waktuMulai: String(dJ[j][hJ.indexOf('Waktu Mulai')] || ''),
                waktuSelesai: String(dJ[j][hJ.indexOf('Waktu Selesai')] || '')
              });
            }
          }
          var cS = SpreadsheetApp.openById(ConfigService.get('LETTER_CORE_SPREADSHEET_ID')).getSheetByName('surat_masuk_custom');
          var dC = cS.getDataRange().getValues();
          suratData.customFields = {};
          for (var c = 1; c < dC.length; c++) {
            if (String(dC[c][0]).replace(/^'/, '').trim() === idSurat) {
              var key = String(dC[c][1] || '').trim();
              if (key && key !== '__kategori' && key !== '__req') suratData.customFields[key] = String(dC[c][2] || '');
            }
          }
        } catch (e) { suratData.jadwalList = suratData.jadwalList || []; suratData.customFields = suratData.customFields || {}; }

        var res = Disposisi.generateOtomatis(suratData);
        if (res && res.docId) {
          var sS2 = SpreadsheetApp.openById(ConfigService.get('LETTER_CORE_SPREADSHEET_ID')).getSheetByName('Surat_Masuk');
          var hS2 = sS2.getRange(1, 1, 1, sS2.getLastColumn()).getDisplayValues()[0];
          var dS2 = sS2.getDataRange().getValues();
          for (var k = 1; k < dS2.length; k++) {
            if (String(dS2[k][hS2.indexOf('ID Surat')] || '').replace(/^'/, '').trim() === idSurat) {
              sS2.getRange(k + 1, hS2.indexOf('ID Disposisi') + 1).setValue(res.docId);
              sS2.getRange(k + 1, hS2.indexOf('URL Disposisi') + 1).setValue(res.docUrl);
              break;
            }
          }
          Ekspedisi.catat(idSurat, 'disposisi_dibuat', 'Lembar disposisi dibuat', '', 'Sistem');
        }
        return res;
      } catch (e) { console.error('[Disposisi.generateForSurat] ' + e); return null; }
    }
  };
})();

if (typeof AppCore !== 'undefined') AppCore.registerModule('Disposisi', Disposisi);