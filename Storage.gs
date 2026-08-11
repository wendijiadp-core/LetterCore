/**
 * ============================================================================
 * LETTERCORE - STORAGE (Spreadsheet CRUD + Schema Registry + Drive Files)
 * ============================================================================
 * File: Storage.gs
 * PENTING: Ganti ID Spreadsheet LetterCore di fungsi _getSpreadsheet()
 * ============================================================================
 */
var Storage = (function () {
  'use strict';

  var _schemas = {};

  // ==========================================
  // ⚠️ KONFIGURASI SPREADSHEET LETTERCORE ️
  // ==========================================
  // Ganti ID di bawah ini dengan ID Spreadsheet LETTERCORE (Database Surat Masuk)
  // Bukan ID LoginCore! Ini adalah tempat data surat disimpan.
  var LETTER_CORE_SPREADSHEET_ID = '1nXmfXEE5k8zyyrWNtA7cnNxPL2wcstLkA_f-icCyjos';

  /* ================= CORE FUNCTIONS ================= */

  function _getSpreadsheet() {
    // Jika ID sudah diisi, paksa buka spreadsheet tersebut
    if (LETTER_CORE_SPREADSHEET_ID && LETTER_CORE_SPREADSHEET_ID.trim() !== '' && LETTER_CORE_SPREADSHEET_ID !== 'MASUKKAN_ID_SPREADSHEET_LETTERCORE_DISINI') {
      try {
        return SpreadsheetApp.openById(LETTER_CORE_SPREADSHEET_ID);
      } catch (e) {
        console.error('[Storage] Gagal membuka Spreadsheet LetterCore. Cek ID apakah benar dan akses izin.', e);
        throw new Error('Database LetterCore tidak dapat diakses.');
      }
    }
    
    // Fallback (hanya jika ID belum diisi, tapi sebaiknya jangan mengandalkan ini di Standalone)
    return SpreadsheetApp.getActiveSpreadsheet();
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
      if (schema && schema.headers.length > 0) {
        sheet.appendRow(schema.headers);
        sheet.setFrozenRows(1);
        // Atur format kolom tanggal jika perlu
      }
    }
    return sheet;
  }

  function _normalizeKey(str) {
    return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function _mapRowToRecord(headers, rowValues) {
    var record = {};
    for (var i = 0; i < headers.length; i++) {
      var headerKey = String(headers[i] || '').trim();
      if (headerKey) {
        record[headerKey] = rowValues[i] !== undefined ? rowValues[i] : '';
      }
    }
    return record;
  }

  function _mapRecordToRow(headers, record) {
    var row = [];
    var normRecord = {};
    for (var k in record) {
      if (record.hasOwnProperty(k)) normRecord[_normalizeKey(k)] = record[k];
    }
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

  /* ================= PUBLIC API ================= */

  return {
    defineSchema: defineSchema,

    read: function (entity) {
      try {
        var sheet = _getOrCreateSheet(entity);
        var data = sheet.getDataRange().getValues();
        if (!data || data.length < 2) return [];
        var headers = data[0];
        var records = [];
        for (var i = 1; i < data.length; i++) {
          records.push(_mapRowToRecord(headers, data[i]));
        }
        return records;
      } catch (e) {
        console.log('[Storage.read Error]', e.message);
        return [];
      }
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
            if (_normalizeKey(prop) === normKey) {
              itemVal = String(item[prop] || '').toLowerCase().trim();
              break;
            }
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

        if (headers.length === 0) {
          headers = Object.keys(record);
          sheet.appendRow(headers);
        }

        var primaryKeyField = (_schemas[entity] && _schemas[entity].primaryKey) || '';
        var existingRowIndex = -1;

        if (primaryKeyField && data.length > 1) {
          var normPk = _normalizeKey(primaryKeyField);
          var pkColIndex = -1;
          for (var h = 0; h < headers.length; h++) {
            if (_normalizeKey(headers[h]) === normPk) { pkColIndex = h; break; }
          }
          if (pkColIndex !== -1) {
            var recordPkVal = String(record[primaryKeyField] || record.id || '').toLowerCase().trim();
            if (recordPkVal) {
              for (var r = 1; r < data.length; r++) {
                if (String(data[r][pkColIndex] || '').toLowerCase().trim() === recordPkVal) {
                  existingRowIndex = r + 1;
                  break;
                }
              }
            }
          }
        }

        var rowArray = _mapRecordToRow(headers, record);
        if (existingRowIndex > 0) {
          sheet.getRange(existingRowIndex, 1, 1, rowArray.length).setValues([rowArray]);
        } else {
          sheet.appendRow(rowArray);
        }
        return true;
      } catch (e) {
        console.log('[Storage.save Error]', e.message);
        return false;
      }
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
              if (_normalizeKey(prop) === normKey) {
                itemVal = String(record[prop] || '').toLowerCase().trim();
                break;
              }
            }
            if (itemVal !== String(query[queryKeys[k]] || '').toLowerCase().trim()) { match = false; break; }
          }
          if (match) { sheet.deleteRow(i + 1); return true; }
        }
        return false;
      } catch (e) {
        console.log('[Storage.remove Error]', e.message);
        return false;
      }
    },

    /* ============ DRIVE FILE HELPERS ============ */

    saveFileToDrive: function (fileObj, namePrefix) {
      try {
        if (!fileObj || !fileObj.base64) return '';
        var folderId = (typeof ConfigService !== 'undefined') ? ConfigService.get('DRIVE_FOLDER_ID') : '';
        if (!folderId) throw new Error('Folder ID belum dikonfigurasi');
        
        var folder = DriveApp.getFolderById(folderId);
        var raw = String(fileObj.base64);
        var base64Data = raw.indexOf(',') !== -1 ? raw.split(',')[1] : raw;
        var blob = Utilities.newBlob(
          Utilities.base64Decode(base64Data),
          fileObj.mimeType || 'application/pdf',
          (namePrefix || 'FILE') + '_' + (fileObj.fileName || 'scan.pdf')
        );
        var file = folder.createFile(blob);
        try {
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (errSharing) {
          console.log('[Storage] setSharing publik gagal (restrict domain?): ' + errSharing.toString());
        }
        return file.getUrl();
      } catch (e) {
        throw new Error('Gagal mengunggah berkas ke Google Drive: ' + e.toString());
      }
    },

    deleteFileFromDrive: function (fileUrl) {
      if (!fileUrl || typeof fileUrl !== 'string' || fileUrl.indexOf('drive.google.com') === -1) return;
      try {
        var match = fileUrl.match(/[-\w]{25,}/);
        if (match && match[0]) DriveApp.getFileById(match[0]).setTrashed(true);
      } catch (e) {
        console.log('[Storage] Gagal hapus file Drive: ' + e.toString());
      }
    },

    deleteDriveFileById: function (fileId) {
      if (!fileId) return;
      try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) {}
    }
  };
})();

/* ================= DEKLARASI SCHEMA SHEET LETTERCORE ================= */
(function _defineLetterCoreSchemas() {
  // Sheet LAMA dipertahankan persis
  Storage.defineSchema('Surat_Masuk',
    ['ID Surat','No Agenda','Tgl Diterima','Tgl Surat','Pengirim','Tujuan','Nomor Surat',
     'Perihal','Deskripsi','Penanggung Jawab','Dosen Pembimbing','PIC','Kontak','Keterangan',
     'URL Scan','Created At','ID Disposisi','URL Disposisi'],
    'ID Surat');
  
  Storage.defineSchema('Detail_Jadwal',
    ['ID Jadwal','ID Surat','Tempat Kegiatan','Tgl Mulai','Tgl Selesai','Waktu Mulai','Waktu Selesai'],
    'ID Jadwal');

  // Sheet BARU (metadata-driven)
  Storage.defineSchema('kategori_surat',
    ['id_kategori','nama_kategori','deskripsi','wajib_balasan','urutan','aktif','created_at'],
    'id_kategori');
  Storage.defineSchema('form_schema',
    ['id_field','id_kategori','field_key','label','tipe','opsi','required','placeholder','urutan','aktif'],
    'id_field');
  Storage.defineSchema('surat_masuk_custom',
    ['id_surat','field_key','nilai'],
    '');
  Storage.defineSchema('disposisi',
    ['id_disposisi','id_surat','doc_id','doc_url','created_at','updated_at'],
    'id_disposisi');
  Storage.defineSchema('surat_keluar',
    ['id_surat_keluar','id_surat_masuk','nomor_surat_keluar','tgl_surat','tujuan','perihal','doc_id','doc_url','status','created_at'],
    'id_surat_keluar');
  Storage.defineSchema('template_surat',
    ['id_template','nama_template','jenis','doc_id','aktif','created_at'],
    'id_template');
  Storage.defineSchema('app_config', ['key','value'], 'key');
  Storage.defineSchema('agenda',
    ['id_agenda','id_surat','id_jadwal','judul','tgl_mulai','tgl_selesai','waktu_mulai','waktu_selesai','tempat','sumber'],
    'id_agenda');
})();

if (typeof AppCore !== 'undefined') {
  AppCore.registerModule('Storage', Storage);
}