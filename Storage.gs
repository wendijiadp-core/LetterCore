/**
 * ============================================================================
 * LETTERCORE - STORAGE (Spreadsheet CRUD + Schema Registry + Drive Files)
 * FINAL: independen + ID Ruang di Detail_Jadwal
 * ============================================================================
 */
var Storage = (function () {
  'use strict';

  var _schemas = {};

  function _bumpVersion() {
    try {
      PropertiesService.getScriptProperties().setProperty('dataVersion', String(Date.now()));
    } catch (e) { /* silent */ }
  }

  var LETTER_CORE_SPREADSHEET_ID = ConfigService.get('LETTER_CORE_SPREADSHEET_ID') || '1nXmfXEE5k8zyyrWNtA7cnNxPL2wcstLkA_f-icCyjos';

  function _getSpreadsheet() {
    if (LETTER_CORE_SPREADSHEET_ID && LETTER_CORE_SPREADSHEET_ID.trim() !== '' && LETTER_CORE_SPREADSHEET_ID !== 'MASUKKAN_ID_SPREADSHEET_LETTERCORE_DISINI') {
      try { return SpreadsheetApp.openById(LETTER_CORE_SPREADSHEET_ID); }
      catch (e) { throw new Error('Database LetterCore tidak dapat diakses.'); }
    }
    return SpreadsheetApp.getActiveSpreadsheet();
  }

  function _getSubfolder(subfolderName) {
    var folderId = ConfigService.get('DRIVE_FOLDER_ID');
    if (!folderId || folderId === 'MASUKKAN_ID_FOLDER_LETTERCORE_DISINI') {
      throw new Error('DRIVE_FOLDER_ID belum dikonfigurasi di Config.gs');
    }
    var rootFolder = DriveApp.getFolderById(folderId);
    if (!subfolderName) return rootFolder;
    var folders = rootFolder.getFoldersByName(subfolderName);
    return folders.hasNext() ? folders.next() : rootFolder.createFolder(subfolderName);
  }

  function _getSuratKeluarFolder() {
    var suratKeluarFolder = _getSubfolder('SuratKeluar');
    var tahun = String(new Date().getFullYear());
    var tahunFolders = suratKeluarFolder.getFoldersByName(tahun);
    return tahunFolders.hasNext() ? tahunFolders.next() : suratKeluarFolder.createFolder(tahun);
  }

  function defineSchema(sheetName, headers, primaryKey) {
    _schemas[sheetName] = { headers: headers || [], primaryKey: primaryKey || '' };
  }

  function _getOrCreateSheet(sheetName) {
    var ss = _getSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      var schema = _schemas[sheetName];
      if (schema && schema.headers.length > 0) { sheet.appendRow(schema.headers); sheet.setFrozenRows(1); }
    }
    return sheet;
  }

  function _normalizeKey(str) { return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

  function _mapRowToRecord(headers, rowValues) {
    var record = {};
    for (var i = 0; i < headers.length; i++) {
      var headerKey = String(headers[i] || '').trim();
      if (headerKey) record[headerKey] = rowValues[i] !== undefined ? rowValues[i] : '';
    }
    return record;
  }

  function _mapRecordToRow(headers, record) {
    var row = [];
    var normRecord = {};
    for (var k in record) if (record.hasOwnProperty(k)) normRecord[_normalizeKey(k)] = record[k];
    for (var i = 0; i < headers.length; i++) {
      var rawHeader = String(headers[i] || '').trim();
      var normHeader = _normalizeKey(rawHeader);
      var val = '';
      if (record.hasOwnProperty(rawHeader)) val = record[rawHeader];
      else if (normRecord.hasOwnProperty(normHeader)) val = normRecord[normHeader];
      row.push(val !== undefined && val !== null ? val : '');
    }
    return row;
  }

  return {
    defineSchema: defineSchema,
    bumpVersion: _bumpVersion,

    read: function (entity) {
      try {
        var sheet = _getOrCreateSheet(entity);
        var data = sheet.getDataRange().getValues();
        if (!data || data.length < 2) return [];
        var headers = data[0];
        var records = [];
        for (var i = 1; i < data.length; i++) records.push(_mapRowToRecord(headers, data[i]));
        return records;
      } catch (e) { console.log('[Storage.read Error]', e.message); return []; }
    },

    find: function (entity, query) {
      var records = this.read(entity);
      if (!query || Object.keys(query).length === 0) return records;
      return records.filter(function (item) {
        for (var key in query) {
          if (!query.hasOwnProperty(key)) continue;
          var normKey = _normalizeKey(key);
          var itemVal = '';
          for (var prop in item) {
            if (_normalizeKey(prop) === normKey) { itemVal = String(item[prop] || '').toLowerCase().trim(); break; }
          }
          if (itemVal !== String(query[key] || '').toLowerCase().trim()) return false;
        }
        return true;
      });
    },

    save: function (entity, record) {
      try {
        var sheet = _getOrCreateSheet(entity);
        var data = sheet.getDataRange().getValues();
        var headers = data.length > 0 ? data[0] : [];
        if (headers.length === 0) { headers = Object.keys(record); sheet.appendRow(headers); }

        var primaryKeyField = (_schemas[entity] && _schemas[entity].primaryKey) || '';
        var existingRowIndex = -1;
        if (primaryKeyField && data.length > 1) {
          var normPk = _normalizeKey(primaryKeyField);
          var pkColIndex = -1;
          for (var h = 0; h < headers.length; h++) if (_normalizeKey(headers[h]) === normPk) { pkColIndex = h; break; }
          if (pkColIndex !== -1) {
            var recordPkVal = String(record[primaryKeyField] || record.id || '').toLowerCase().trim();
            if (recordPkVal) {
              for (var r = 1; r < data.length; r++) {
                if (String(data[r][pkColIndex] || '').toLowerCase().trim() === recordPkVal) { existingRowIndex = r + 1; break; }
              }
            }
          }
        }

        var rowArray = _mapRecordToRow(headers, record);
        if (existingRowIndex > 0) sheet.getRange(existingRowIndex, 1, 1, rowArray.length).setValues([rowArray]);
        else sheet.appendRow(rowArray);
        _bumpVersion();
        return true;
      } catch (e) { console.log('[Storage.save Error]', e.message); return false; }
    },

    update: function (entity, query, payload) {
      var records = this.find(entity, query);
      if (!records || records.length === 0) return false;
      var updatedRecord = Object.assign({}, records[0], payload);
      return this.save(entity, updatedRecord);
    },

    remove: function (entity, query) {
      try {
        var sheet = _getOrCreateSheet(entity);
        var data = sheet.getDataRange().getValues();
        if (data.length < 2) return false;
        var headers = data[0];
        var queryKeys = Object.keys(query);
        if (queryKeys.length === 0) return false;
        for (var i = 1; i < data.length; i++) {
          var record = _mapRowToRecord(headers, data[i]);
          var match = true;
          for (var k = 0; k < queryKeys.length; k++) {
            var normKey = _normalizeKey(queryKeys[k]);
            var itemVal = '';
            for (var prop in record) {
              if (_normalizeKey(prop) === normKey) { itemVal = String(record[prop] || '').toLowerCase().trim(); break; }
            }
            if (itemVal !== String(query[queryKeys[k]] || '').toLowerCase().trim()) { match = false; break; }
          }
          if (match) { sheet.deleteRow(i + 1); _bumpVersion(); return true; }
        }
        return false;
      } catch (e) { console.log('[Storage.remove Error]', e.message); return false; }
    },

    saveFileToDrive: function (fileObj, namePrefix, subfolder) {
      try {
        if (!fileObj || !fileObj.base64) return '';
        var folder = _getSubfolder(subfolder || 'Scan');
        var raw = String(fileObj.base64);
        var base64Data = raw.indexOf(',') !== -1 ? raw.split(',')[1] : raw;
        var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), fileObj.mimeType || 'application/pdf', (namePrefix || 'FILE') + '_' + (fileObj.fileName || 'scan.pdf'));
        var file = folder.createFile(blob);
        try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (errSharing) {}
        return file.getUrl();
      } catch (e) { throw new Error('Gagal mengunggah berkas ke Google Drive: ' + e.toString()); }
    },

    generateDocumentFromTemplate: function (templateId, data, fileName) {
      try {
        if (!templateId) throw new Error('ID Template tidak ditemukan.');
        var targetFolder = _getSuratKeluarFolder();
        var templateFile = DriveApp.getFileById(templateId);
        var newFile = templateFile.makeCopy(fileName, targetFolder);
        var newDoc = DocumentApp.openById(newFile.getId());
        var body = newDoc.getBody();

        var replacements = _getDynamicPlaceholders(data);
        for (var key in replacements) {
          if (replacements.hasOwnProperty(key)) body.replaceText(key, replacements[key]);
        }
        newDoc.saveAndClose();

        return { success: true, docId: newFile.getId(), docUrl: newFile.getUrl(), message: 'Dokumen berhasil dibuat di folder: ' + targetFolder.getName() };
      } catch (e) {
        console.error('[Storage.generateDocumentFromTemplate Error]', e);
        throw new Error('Gagal membuat dokumen: ' + e.toString());
      }
    },

    deleteFileFromDrive: function (fileUrl) {
      if (!fileUrl || typeof fileUrl !== 'string' || fileUrl.indexOf('drive.google.com') === -1) return;
      try {
        var match = fileUrl.match(/[-\w]{25,}/);
        if (match && match[0]) DriveApp.getFileById(match[0]).setTrashed(true);
      } catch (e) {}
    },

    deleteDriveFileById: function (fileId) {
      if (!fileId) return;
      try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) {}
    }
  };

  function _getDynamicPlaceholders(data) {
    var replacements = {};
    try {
      var sheet = _getSpreadsheet().getSheetByName('placeholder_surat');
      if (!sheet) return replacements;
      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        var key = String(values[i][0] || '').trim();
        var fieldKey = String(values[i][2] || '').trim();
        if (key && fieldKey) {
          var placeholder = '{{' + key + '}}';
          var val = '';
          var normFk = fieldKey.toLowerCase();
          if (normFk.indexOf('tgl') !== -1 || normFk.indexOf('tanggal') !== -1) {
            val = data[fieldKey] ? Utilities.formatDate(new Date(data[fieldKey]), Session.getScriptTimeZone(), "EEEE, d MMMM yyyy") : '';
          } else {
            val = data[fieldKey] !== undefined ? String(data[fieldKey]) : '';
          }
          try { val = TransformasiPH.terapkan(key, fieldKey, val); } catch (e) {}
          replacements[placeholder] = val;
        }
      }
    } catch (e) { console.error('[Storage] Gagal membaca placeholder dinamis:', e); }
    return replacements;
  }
})();

/* ================= SCHEMA ================= */
(function _defineLetterCoreSchemas() {
  Storage.defineSchema('Surat_Masuk',
    ['ID Surat','No Agenda','Tgl Diterima','Tgl Surat','Pengirim','Tujuan','Nomor Surat',
     'Perihal','Deskripsi','Penanggung Jawab','Dosen Pembimbing','PIC','Kontak','Keterangan',
     'URL Scan','Created At','ID Disposisi','URL Disposisi','Kategori','Pemroses','Status'], 'ID Surat');
  Storage.defineSchema('Detail_Jadwal',
    ['ID Jadwal','ID Surat','Tempat Kegiatan','Tgl Mulai','Tgl Selesai','Waktu Mulai','Waktu Selesai','ID Ruang'], 'ID Jadwal');
  Storage.defineSchema('kategori_surat',
    ['id_kategori','nama_kategori','deskripsi','wajib_balasan','urutan','aktif','created_at'], 'id_kategori');
  Storage.defineSchema('form_schema',
    ['id_field','id_kategori','field_key','label','tipe','opsi','required','placeholder','urutan','aktif','sumber_data','grup'],
    'id_field');
  Storage.defineSchema('jenis_keluar',
    ['id_jenis','nama','mode','aktif','created_at'],
    'id_jenis');
  Storage.defineSchema('surat_masuk_custom', ['id_surat','field_key','nilai'], '');
  Storage.defineSchema('disposisi',
    ['id_disposisi','id_surat','doc_id','doc_url','created_at','updated_at'], 'id_disposisi');
  Storage.defineSchema('surat_keluar',
    ['idKeluar','nomorKeluar','tglKeluar','jenisKeluar','perihal','tujuan','penandatangan','asal','idSuratInduk','urlDokumen','urlScan','status'], 'idKeluar');
  Storage.defineSchema('template_surat',
    ['id_template','nama_template','jenis','doc_id','aktif','created_at'], 'id_template');
  Storage.defineSchema('placeholder_surat', ['key','label','fieldKey','contoh'], 'key');
  Storage.defineSchema('app_config', ['key','value'], 'key');
  Storage.defineSchema('agenda',
    ['id_agenda','id_surat','id_jadwal','judul','tgl_mulai','tgl_selesai','waktu_mulai','waktu_selesai','tempat','sumber'], 'id_agenda');
})();

if (typeof AppCore !== 'undefined') AppCore.registerModule('Storage', Storage);

Storage.defineSchema('template_disposisi', ['id_template_disp','kategori_id','nama_template','doc_id','aktif','created_at'], 'id_template_disp');
Storage.defineSchema('transformasi_placeholder', ['id_transform','field_key','tipe','cari','ganti','format','aktif'], 'id_transform');

Storage.defineSchema('agenda', ['id_agenda','judul','pemohon','tgl_mulai','tgl_selesai','waktu_mulai','waktu_selesai','tempat','sumber','created_at'], 'id_agenda');
Storage.defineSchema('hari_libur', ['id_libur','tanggal','nama','jenis'], 'id_libur');
Storage.defineSchema('cache_libur', ['tahun','json','updated_at'], 'tahun');
Storage.defineSchema('doc_queue', ['id_surat','enqueued_at','attempts'], 'id_surat');