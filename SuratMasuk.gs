/**
 * ============================================================================
 * LETTERCORE - SURAT MASUK MODULE (Hardening + Status AKTIF/BATAL)
 * ============================================================================
 */
var SuratMasuk = (function () {
  'use strict';

  function _ss() { return SpreadsheetApp.openById(ConfigService.get('LETTER_CORE_SPREADSHEET_ID')); }
  function _sheet(name) {
    var s = _ss().getSheetByName(name);
    if (!s) {
      s = _ss().insertSheet(name);
      if (name === 'Surat_Masuk') s.appendRow(['ID Surat','No Agenda','Tgl Diterima','Tgl Surat','Pengirim','Tujuan','Nomor Surat','Perihal','Deskripsi','Penanggung Jawab','Dosen Pembimbing','PIC','Kontak','Keterangan','URL Scan','Created At','ID Disposisi','URL Disposisi','Kategori','Pemroses','Status']);
      if (name === 'Detail_Jadwal') s.appendRow(['ID Jadwal','ID Surat','Tempat Kegiatan','Tgl Mulai','Tgl Selesai','Waktu Mulai','Waktu Selesai']);
      if (name === 'surat_masuk_custom') s.appendRow(['id_surat','field_key','nilai']);
      s.setFrozenRows(1);
    }
    if (name === 'Surat_Masuk') { _ensureTextFormats(s); _ensureStatusCol(s); }
    return s;
  }

  function _ensureTextFormats(sheet) {
    try {
      var h = _h(sheet);
      ['ID Surat','No Agenda','Tgl Diterima','Tgl Surat','Created At'].forEach(function (n) {
        var i = h.indexOf(n);
        if (i > -1) sheet.getRange(1, i + 1, Math.max(sheet.getMaxRows(), 2), 1).setNumberFormat('@');
      });
    } catch (e) {}
  }
  function _ensureStatusCol(sheet) {
    try { var h = _h(sheet); if (h.indexOf('Status') === -1) sheet.getRange(1, sheet.getLastColumn() + 1).setValue('Status'); } catch (e) {}
  }

  function _h(sheet) { return sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getDisplayValues()[0]; }
  function _clean(v) { return String(v || '').replace(/^'/, '').trim(); }

  function _upsert(sheet, record, pk) {
    var headers = _h(sheet), data = sheet.getDataRange().getValues();
    var pkIdx = headers.indexOf(pk), pkVal = _clean(record[pk]);
    for (var i = 1; i < data.length; i++) {
      if (_clean(data[i][pkIdx]) === pkVal) {
        var row = [];
        for (var c = 0; c < headers.length; c++) row.push(record.hasOwnProperty(headers[c]) ? record[headers[c]] : data[i][c]);
        sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
        return i + 1;
      }
    }
    sheet.appendRow(headers.map(function (hh) { return record.hasOwnProperty(hh) ? record[hh] : ''; }));
    return sheet.getLastRow();
  }

  function _generateIdSurat() { return 'SRT-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd-HHmmss'); }
  function _generateIdJadwal() { return 'JDW-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd') + '-' + Math.floor(100 + Math.random() * 900); }

  return {

    /* ================= READ ================= */
    getDaftarSurat: function () {
      var sheetSurat = _sheet('Surat_Masuk');
      var sheetJadwal = _sheet('Detail_Jadwal');
      var sheetCustom = _sheet('surat_masuk_custom');

      var mapCustom = {};
      var dC = sheetCustom.getDataRange().getDisplayValues();
      for (var c = 1; c < dC.length; c++) {
        var sid = _clean(dC[c][0]), key = String(dC[c][1] || '').trim();
        if (!sid || !key) continue;
        if (!mapCustom[sid]) mapCustom[sid] = { kategoriId: '', customFields: {} };
        if (key === '__kategori') mapCustom[sid].kategoriId = String(dC[c][2] || '');
        else if (key !== '__req') mapCustom[sid].customFields[key] = String(dC[c][2] || '');
      }

      var hJ = _h(sheetJadwal);
      var jI = { id: hJ.indexOf('ID Jadwal'), surat: hJ.indexOf('ID Surat'), tempat: hJ.indexOf('Tempat Kegiatan'), t1: hJ.indexOf('Tgl Mulai'), t2: hJ.indexOf('Tgl Selesai'), w1: hJ.indexOf('Waktu Mulai'), w2: hJ.indexOf('Waktu Selesai') };
      var mapJadwal = {};
      var dJ = sheetJadwal.getDataRange().getDisplayValues();
      for (var j = 1; j < dJ.length; j++) {
        var idS = _clean(dJ[j][jI.surat]);
        if (!idS) continue;
        if (!mapJadwal[idS]) mapJadwal[idS] = [];
        mapJadwal[idS].push({
          idJadwal: _clean(dJ[j][jI.id]),
          tempatKegiatan: String(dJ[j][jI.tempat] || '-'),
          tglMulai: DateUtil.formatIndo(dJ[j][jI.t1]),
          tglSelesai: DateUtil.formatIndo(dJ[j][jI.t2]),
          waktuMulai: DateUtil.formatTime(dJ[j][jI.w1]),
          waktuSelesai: DateUtil.formatTime(dJ[j][jI.w2]),
          waktuKegiatan: (DateUtil.formatTime(dJ[j][jI.w1]) ? DateUtil.formatTime(dJ[j][jI.w1]) + ' - ' : '') + (DateUtil.formatTime(dJ[j][jI.w2]) || '-')
        });
      }

      var hS = _h(sheetSurat);
      var gi = function (n) { return hS.indexOf(n); };
      var idx = { id: gi('ID Surat'), agenda: gi('No Agenda'), t1: gi('Tgl Diterima'), t2: gi('Tgl Surat'), pengirim: gi('Pengirim'), tujuan: gi('Tujuan'), nomor: gi('Nomor Surat'), perihal: gi('Perihal'), desk: gi('Deskripsi'), pj: gi('Penanggung Jawab'), dosen: gi('Dosen Pembimbing'), pic: gi('PIC'), kontak: gi('Kontak'), ket: gi('Keterangan'), scan: gi('URL Scan'), created: gi('Created At'), dId: gi('ID Disposisi'), dUrl: gi('URL Disposisi'), kat: gi('Kategori'), pros: gi('Pemroses'), status: gi('Status') };
      var dS = sheetSurat.getDataRange().getDisplayValues();
      var result = [];
      for (var i = 1; i < dS.length; i++) {
        var r = dS[i], id = _clean(r[idx.id]);
        if (!id) continue;
        var cust = mapCustom[id] || { kategoriId: '', customFields: {} };
        result.push({
          idSurat: id,
          agendaNomor: String(r[idx.agenda] || ''),
          tglDiterima: DateUtil.formatIndo(r[idx.t1]),
          tglSurat: DateUtil.formatIndo(r[idx.t2]),
          pengirim: String(r[idx.pengirim] || ''),
          tujuan: String(r[idx.tujuan] || ''),
          nomorSurat: String(r[idx.nomor] || ''),
          perihal: String(r[idx.perihal] || ''),
          deskripsi: String(r[idx.desk] || ''),
          penanggungJawab: String(r[idx.pj] || ''),
          dosenPembimbing: String(r[idx.dosen] || ''),
          pic: String(r[idx.pic] || ''),
          kontak: String(r[idx.kontak] || ''),
          keterangan: String(r[idx.ket] || ''),
          urlScan: String(r[idx.scan] || ''),
          createdAt: String(r[idx.created] || ''),
          idDisposisi: String(r[idx.dId] || ''),
          urlDisposisi: String(r[idx.dUrl] || ''),
          kategoriId: String(r[idx.kat] || '') || cust.kategoriId,
          pemroses: String(r[idx.pros] || ''),
          status: String(r[idx.status] || 'AKTIF'),
          customFields: cust.customFields || {},
          jadwalList: mapJadwal[id] || []
        });
      }
      return result.reverse();
    },

    /* ================= SAVE ================= */
    simpanSurat: function (data) {
      var lock = LockService.getScriptLock();
      try {
        lock.tryLock(10000);
        var sheetSurat = _sheet('Surat_Masuk');
        var sheetJadwal = _sheet('Detail_Jadwal');
        var isEdit = data.idSurat && _clean(data.idSurat) !== '';
        var idSurat = isEdit ? _clean(data.idSurat) : _generateIdSurat();
        var requestId = String(data.requestId || '');

        if (!isEdit && requestId) {
          var dC0 = _sheet('surat_masuk_custom').getDataRange().getValues();
          for (var q = 1; q < dC0.length; q++) {
            if (String(dC0[q][1]) === '__req' && String(dC0[q][2]) === requestId) {
              return { success: true, message: 'Data sudah tersimpan (duplikat diabaikan).', agendaNomor: '', idSurat: _clean(dC0[q][0]) };
            }
          }
        }

        var isSisipan = (data.isSisipan === true || data.isSisipan === 'true');
        var agendaNomor = '';

        var hS = _h(sheetSurat);
        var cAgenda = hS.indexOf('No Agenda'), cTgl = hS.indexOf('Tgl Diterima'), cId = hS.indexOf('ID Surat');
        var raw = sheetSurat.getDataRange().getValues();
        if (isSisipan && (!isEdit || !/[a-z]$/i.test(data.agendaNomor || ''))) {
          var targetYMD = DateUtil.parseYMD(data.tglDiterima), yr = DateUtil.extractYear(data.tglDiterima);
          var lastOnDate = '', maxYear = 0;
          for (var k = 1; k < raw.length; k++) {
            if (isEdit && _clean(raw[k][cId]) === idSurat) continue;
            var ag = String(raw[k][cAgenda] || '').trim();
            if (DateUtil.parseYMD(raw[k][cTgl]) === targetYMD && ag) lastOnDate = ag;
            if (DateUtil.extractYear(raw[k][cTgl]) === yr) { var m1 = ag.match(/^(\d+)/); if (m1) maxYear = Math.max(maxYear, parseInt(m1[1], 10)); }
          }
          var base = lastOnDate ? ('000' + (lastOnDate.match(/^(\d+)/) || [0, maxYear])[1]).slice(-3) : ('000' + (maxYear > 0 ? maxYear : 1)).slice(-3);
          var lastCh = '';
          for (var n = 1; n < raw.length; n++) {
            if (isEdit && _clean(raw[n][cId]) === idSurat) continue;
            var ck = String(raw[n][cAgenda] || '').trim();
            if (ck.indexOf(base) === 0) { var sf = ck.substring(base.length).trim(); if (sf && sf > lastCh) lastCh = sf; }
          }
          agendaNomor = base + (!lastCh ? 'a' : String.fromCharCode(lastCh.charCodeAt(0) + 1));
        } else if (isEdit) {
          agendaNomor = data.agendaNomor;
        } else {
          var yr2 = DateUtil.extractYear(data.tglDiterima), max2 = 0;
          for (var m = 1; m < raw.length; m++) {
            if (DateUtil.extractYear(raw[m][cTgl]) === yr2) { var m2 = String(raw[m][cAgenda] || '').match(/^(\d+)/); if (m2) max2 = Math.max(max2, parseInt(m2[1], 10)); }
          }
          agendaNomor = ('000' + (max2 + 1)).slice(-3);
        }

        var urlScan = data.existingUrlScan || '';
        if (data.fileScan && data.fileScan.base64) urlScan = Storage.saveFileToDrive(data.fileScan, idSurat);

        var existingIdDisp = '', existingUrlDisp = '';
        if (isEdit) {
          var dOld = sheetSurat.getDataRange().getValues();
          for (var x = 1; x < dOld.length; x++) {
            if (_clean(dOld[x][cId]) === idSurat) {
              if (!data.fileScan && dOld[x][hS.indexOf('URL Scan')]) urlScan = dOld[x][hS.indexOf('URL Scan')];
              existingIdDisp = dOld[x][hS.indexOf('ID Disposisi')] || '';
              existingUrlDisp = dOld[x][hS.indexOf('URL Disposisi')] || '';
              break;
            }
          }
        }

        var record = {};
        record['ID Surat'] = "'" + idSurat;
        record['No Agenda'] = "'" + agendaNomor;
        record['Tgl Diterima'] = "'" + (data.tglDiterima || '');
        record['Tgl Surat'] = "'" + (data.tglSurat || '');
        record['Pengirim'] = data.pengirim || '';
        record['Tujuan'] = data.tujuan || '';
        record['Nomor Surat'] = data.nomorSurat || '';
        record['Perihal'] = data.perihal || '';
        record['Deskripsi'] = data.deskripsi || '';
        record['PIC'] = data.pic || '';
        record['Kontak'] = data.kontak || '';
        record['Keterangan'] = data.keterangan || '';
        record['URL Scan'] = urlScan;
        record['Created At'] = "'" + (data.createdAt || Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss'));
        record['Kategori'] = data.kategoriId || '';
        record['Pemroses'] = data.pemroses || '';
        if (!isEdit) record['Status'] = 'AKTIF';
        _upsert(sheetSurat, record, 'ID Surat');

        var hJ = _h(sheetJadwal);
        var cJSurat = hJ.indexOf('ID Surat');
        var dJ = sheetJadwal.getDataRange().getValues();
        for (var d = dJ.length - 1; d >= 1; d--) if (_clean(dJ[d][cJSurat]) === idSurat) sheetJadwal.deleteRow(d + 1);
        (data.jadwalList || []).forEach(function (jj) {
          sheetJadwal.appendRow(["'" + _generateIdJadwal(), "'" + idSurat, jj.tempatKegiatan || '-', "'" + (jj.tglMulai || jj.tglKegiatan || ''), "'" + (jj.tglSelesai || jj.tglKegiatan || ''), "'" + (jj.waktuMulai || ''), "'" + (jj.waktuSelesai || '')]);
        });

        var sheetCustom = _sheet('surat_masuk_custom');
        var dC = sheetCustom.getDataRange().getValues();
        for (var cc = dC.length - 1; cc >= 1; cc--) if (_clean(dC[cc][0]) === idSurat) sheetCustom.deleteRow(cc + 1);
        if (data.kategoriId) sheetCustom.appendRow(["'" + idSurat, '__kategori', data.kategoriId]);
        if (!isEdit && requestId) sheetCustom.appendRow(["'" + idSurat, '__req', requestId]);
        if (data.customFields) for (var fk in data.customFields) {
          if (data.customFields.hasOwnProperty(fk) && String(data.customFields[fk] || '').trim() !== '') sheetCustom.appendRow(["'" + idSurat, fk, data.customFields[fk]]);
        }

        if (!isEdit) Ekspedisi.catat(idSurat, 'diinput', 'Surat diterima & diinput', 'No. agenda ' + agendaNomor, data.pemroses || 'Sistem');
        if (typeof Disposisi !== 'undefined') {
          var resDisp = Disposisi.generateOtomatis({
            idSurat: idSurat, agendaNomor: agendaNomor, nomorSurat: data.nomorSurat, tglSurat: data.tglSurat, tglDiterima: data.tglDiterima,
            pengirim: data.pengirim, tujuan: data.tujuan, perihal: data.perihal, deskripsi: data.deskripsi,
            penanggungJawab: data.penanggungJawab, pic: data.pic, kontak: data.kontak, keterangan: data.keterangan,
            jadwalList: data.jadwalList, existingIdDisposisi: existingIdDisp, existingUrlDisposisi: existingUrlDisp
          });
          if (resDisp && resDisp.docId) {
            var rec2 = {}; rec2['ID Surat'] = "'" + idSurat; rec2['ID Disposisi'] = resDisp.docId; rec2['URL Disposisi'] = resDisp.docUrl;
            _upsert(sheetSurat, rec2, 'ID Surat');
            if (!isEdit || !existingIdDisp) Ekspedisi.catat(idSurat, 'disposisi_dibuat', 'Lembar disposisi dibuat', '', data.pemroses || 'Sistem');
          }
        }

        return { success: true, message: isEdit ? 'Data diperbarui!' : 'Disimpan! No. agenda: ' + agendaNomor, agendaNomor: agendaNomor, idSurat: idSurat };
      } catch (e) {
        return { success: false, message: e.toString() };
      } finally {
        try { lock.releaseLock(); } catch (e2) {}
      }
    },

    /* ================= STATUS: BATAL / AKTIFKAN ================= */
    batalkanSurat: function (idSurat, catatan, aktor) {
      try {
        idSurat = _clean(idSurat);
        var rec = {}; rec['ID Surat'] = "'" + idSurat; rec['Status'] = 'BATAL';
        _upsert(_sheet('Surat_Masuk'), rec, 'ID Surat');
        Ekspedisi.catat(idSurat, 'dibatalkan', 'Kegiatan/surat dibatalkan', catatan || '', aktor || 'Sistem');
        return { success: true, message: 'Surat ditandai DIBATALKAN. Dokumentasi tetap tersimpan.' };
      } catch (e) { return { success: false, message: e.toString() }; }
    },

    aktifkanSurat: function (idSurat, aktor) {
      try {
        idSurat = _clean(idSurat);
        var rec = {}; rec['ID Surat'] = "'" + idSurat; rec['Status'] = 'AKTIF';
        _upsert(_sheet('Surat_Masuk'), rec, 'ID Surat');
        Ekspedisi.catat(idSurat, 'diaktifkan_kembali', 'Surat diaktifkan kembali', '', aktor || 'Sistem');
        return { success: true, message: 'Surat kembali AKTIF.' };
      } catch (e) { return { success: false, message: e.toString() }; }
    },

    /* ================= RAPIKAN NOMOR LAMA ================= */
    rapikanAgenda: function () {
      try {
        var sheet = _sheet('Surat_Masuk');
        var h = _h(sheet), iA = h.indexOf('No Agenda');
        var data = sheet.getDataRange().getValues();
        var fixed = 0;
        for (var i = 1; i < data.length; i++) {
          var v = data[i][iA];
          if (typeof v === 'number') {
            sheet.getRange(i + 1, iA + 1).setValue("'" + ('000' + Math.round(v)).slice(-3));
            fixed++;
          }
        }
        return { success: true, message: fixed + ' nomor agenda dirapikan.' };
      } catch (e) { return { success: false, message: e.toString() }; }
    },

    /* ================= DELETE ================= */
    hapusSurat: function (idSurat) {
      try {
        idSurat = _clean(idSurat);
        var sheetSurat = _sheet('Surat_Masuk');
        var hS = _h(sheetSurat);
        var dS = sheetSurat.getDataRange().getValues();
        for (var i = 1; i < dS.length; i++) {
          if (_clean(dS[i][hS.indexOf('ID Surat')]) === idSurat) {
            var scan = dS[i][hS.indexOf('URL Scan')], docId = dS[i][hS.indexOf('ID Disposisi')];
            if (scan) Storage.deleteFileFromDrive(scan);
            if (docId) Storage.deleteDriveFileById(docId);
            sheetSurat.deleteRow(i + 1);
            break;
          }
        }
        var sheetJadwal = _sheet('Detail_Jadwal');
        var hJ = _h(sheetJadwal);
        var dJ = sheetJadwal.getDataRange().getValues();
        for (var j = dJ.length - 1; j >= 1; j--) if (_clean(dJ[j][hJ.indexOf('ID Surat')]) === idSurat) sheetJadwal.deleteRow(j + 1);
        var sheetCustom = _sheet('surat_masuk_custom');
        var dC = sheetCustom.getDataRange().getValues();
        for (var c = dC.length - 1; c >= 1; c--) if (_clean(dC[c][0]) === idSurat) sheetCustom.deleteRow(c + 1);
        return { success: true, message: 'Data berhasil dihapus.' };
      } catch (e) { return { success: false, message: e.toString() }; }
    },

    /* ================= ENUM & MASTER ================= */
    getEnumList: function () {
      try {
        var data = this.getDaftarSurat();
        var unique = function (arr, key) { var s = {}; arr.forEach(function (o) { if (o[key]) s[o[key]] = true; }); return Object.keys(s); };
        return {
          pengirim: unique(data, 'pengirim'), tujuan: unique(data, 'tujuan'), perihal: unique(data, 'perihal'),
          tempatKegiatan: (function () { var s = {}; data.forEach(function (dd) { (dd.jadwalList || []).forEach(function (jj) { if (jj.tempatKegiatan) s[jj.tempatKegiatan] = true; }); }); return Object.keys(s); })()
        };
      } catch (e) { return {}; }
    },

    getKategoriList: function () {
      var s = _ss().getSheetByName('kategori_surat');
      if (!s || s.getLastRow() < 2) return [];
      var data = s.getDataRange().getDisplayValues();
      var h = data[0], out = [];
      for (var i = 1; i < data.length; i++) {
        if (!data[i][h.indexOf('id_kategori')] || String(data[i][h.indexOf('aktif')] || '').toUpperCase() !== 'TRUE') continue;
        out.push({
          id: String(data[i][h.indexOf('id_kategori')]).trim(),
          nama: String(data[i][h.indexOf('nama_kategori')] || ''),
          deskripsi: String(data[i][h.indexOf('deskripsi')] || ''),
          tujuanDisposisi: String(data[i][h.indexOf('tujuan_disposisi_default')] || ''),
          balasanDefault: String(data[i][h.indexOf('balasan_default')] || ''),
          labelTahap2: String(data[i][h.indexOf('label_tahap2')] || ''),
          labelTahap3: String(data[i][h.indexOf('label_tahap3')] || ''),
          pakaiJadwal: String(data[i][h.indexOf('pakai_jadwal')] || '').toUpperCase() === 'TRUE',
          modeTempat: String(data[i][h.indexOf('mode_tempat')] || 'INPUT')
        });
      }
      return out;
    },

    getFormSchema: function (idKategori) {
      var s = _ss().getSheetByName('form_schema');
      if (!s || s.getLastRow() < 2) return [];
      var data = s.getDataRange().getDisplayValues();
      var h = data[0], out = [];
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][h.indexOf('id_kategori')] || '').trim() !== idKategori) continue;
        if (String(data[i][h.indexOf('aktif')] || '').toUpperCase() !== 'TRUE') continue;
        out.push({
          fieldKey: String(data[i][h.indexOf('field_key')] || ''),
          label: String(data[i][h.indexOf('label')] || ''),
          tipe: String(data[i][h.indexOf('tipe')] || 'text'),
          opsi: String(data[i][h.indexOf('opsi')] || ''),
          required: String(data[i][h.indexOf('required')] || '').toLowerCase() === 'true',
          placeholder: String(data[i][h.indexOf('placeholder')] || ''),
          urutan: parseInt(data[i][h.indexOf('urutan')] || 0, 10),
          grup: String(data[i][h.indexOf('grup')] || 'UMUM'),
          sumberData: String(data[i][h.indexOf('sumber_data')] || ''),
          opsional: String(data[i][h.indexOf('opsional')] || '').toUpperCase() === 'TRUE',
          tahap: parseInt(data[i][h.indexOf('tahap')] || 3, 10)
        });
      }
      out.sort(function (a, b) { return a.urutan - b.urutan; });
      return out;
    }
  };
})();

if (typeof AppCore !== 'undefined') AppCore.registerModule('SuratMasuk', SuratMasuk);