/**
 * ============================================================================
 * LETTERCORE - MIGRASI & SEED (Batch 1)
 * ============================================================================
 * Cara pakai: Jalankan fungsi jalankanMigrasi() SEKALI dari Editor
 * (akan memicu otorisasi Sheets). Aman dijalankan ulang (idempotent).
 * ============================================================================
 */

function _ssMigrasi() {
  var id = ConfigService.get('LETTER_CORE_SPREADSHEET_ID');
  if (!id || String(id).indexOf('MASUKKAN') !== -1) {
    throw new Error('Isi LETTER_CORE_SPREADSHEET_ID di Config.gs terlebih dahulu.');
  }
  return SpreadsheetApp.openById(id);
}

/* ================= TARGET SKEMA (Blueprint Final) ================= */
var TARGET_SCHEMA = {
  'Surat_Masuk': ['ID Surat','No Agenda','Tgl Diterima','Tgl Surat','Pengirim','Tujuan','Nomor Surat','Perihal','Deskripsi','Penanggung Jawab','Dosen Pembimbing','PIC','Kontak','Keterangan','URL Scan','Created At','ID Disposisi','URL Disposisi','Kategori','Pemroses'],
  'Detail_Jadwal': ['ID Jadwal','ID Surat','Tempat Kegiatan','Tgl Mulai','Tgl Selesai','Waktu Mulai','Waktu Selesai'],
  'kategori_surat': ['id_kategori','nama_kategori','deskripsi','wajib_balasan','urutan','aktif','created_at','tujuan_disposisi_default','balasan_default'],
  'form_schema': ['id_field','id_kategori','field_key','label','tipe','opsi','required','placeholder','urutan','aktif','grup','sumber_data','opsional'],
  'surat_masuk_custom': ['id_surat','field_key','nilai'],
  'disposisi': ['id_disposisi','id_surat','doc_id','doc_url','created_at','updated_at','status_cetak','keputusan','perlu_balasan','jenis_balasan','tenggat','dicatat_oleh'],
  'surat_ekspedisi': ['id_log','id_surat','tahap','judul','catatan','aktor','timestamp'],
  'master_aset': ['id_aset','jenis','nama','deskripsi','foto_url','aktif'],
  'master_orang': ['id_orang','nama','nip','jabatan','aktif']
};

/* ================= HELPER: PASTIKAN HEADER ================= */
function _ensureHeaders(sheet, headers) {
  var lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    return headers.length;
  }
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var existing = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var missing = [];
  headers.forEach(function (h) { if (existing.indexOf(h) === -1) missing.push(h); });
  if (missing.length > 0) {
    sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
  }
  sheet.setFrozenRows(1);
  return missing.length;
}

/* ================= SEED DATA ================= */
function _seedKategori(ss, report) {
  var sheet = ss.getSheetByName('kategori_surat');
  var now = new Date().toISOString();
  var rows = [
    ['KAT-IZIN',  'Permohonan Izin Kegiatan',          'Pengajuan izin pelaksanaan kegiatan',        'false', 1,  'TRUE', now, 'Wakil Dekan Bidang Kemahasiswaan dan Kemitraan', ''],
    ['KAT-TEMPAT','Peminjaman Tempat',                 'Peminjaman tempat/ruangan',                  'false', 2,  'TRUE', now, 'Wakil Dekan Bidang Sumber Daya dan Umum', 'Surat Peminjaman'],
    ['KAT-BARANG','Peminjaman Barang',                 'Peminjaman barang/inventaris',               'false', 3,  'TRUE', now, 'Wakil Dekan Bidang Sumber Daya dan Umum', 'Surat Peminjaman'],
    ['KAT-KEND',  'Peminjaman Kendaraan Dinas',        'Peminjaman kendaraan dinas',                 'false', 4,  'TRUE', now, 'Wakil Dekan Bidang Sumber Daya dan Umum', 'Surat Jalan'],
    ['KAT-LISTRIK','Penggunaan Listrik',               'Permohonan penggunaan listrik',              'false', 5,  'TRUE', now, 'Wakil Dekan Bidang Sumber Daya dan Umum', ''],
    ['KAT-BALIHO','Pemasangan Baliho',                 'Permohonan pemasangan baliho/spanduk',       'false', 6,  'TRUE', now, 'Wakil Dekan Bidang Sumber Daya dan Umum', ''],
    ['KAT-DINAS', 'Permohonan Surat Dinas ke Universitas','Pembuatan surat dinas peminjaman ke universitas','false',7,'TRUE', now, 'Wakil Dekan Bidang Sumber Daya dan Umum', 'Surat Dinas'],
    ['KAT-TUGAS', 'Permohonan Surat Tugas',            'Pembuatan surat tugas',                      'false', 8,  'TRUE', now, 'Dekan', 'Surat Tugas'],
    ['KAT-KUNJUNG','Permohonan Kunjungan',             'Kunjungan studi banding/audiensi',           'false', 9,  'TRUE', now, 'Dekan', ''],
    ['KAT-UND',   'Undangan (Informatif)',             'Surat undangan, tidak perlu balasan',        'false', 10, 'TRUE', now, 'Administrasi Umum', '']
  ];
  if (sheet.getLastRow() < 2) {
    rows.forEach(function (r) { sheet.appendRow(r); });
    report.push('kategori_surat: seed ' + rows.length + ' kategori');
  } else {
    // Backfill default disposisi/balasan untuk kategori yang kosong
    var data = sheet.getDataRange().getDisplayValues();
    var idxId = data[0].indexOf('id_kategori');
    var idxTujuan = data[0].indexOf('tujuan_disposisi_default');
    var idxBalasan = data[0].indexOf('balasan_default');
    var map = {};
    rows.forEach(function (r) { map[r[0]] = { tujuan: r[7], balasan: r[8] }; });
    for (var i = 1; i < data.length; i++) {
      var id = String(data[i][idxId] || '').trim();
      if (map[id]) {
        if (!String(data[i][idxTujuan] || '').trim()) sheet.getRange(i + 1, idxTujuan + 1).setValue(map[id].tujuan);
        if (!String(data[i][idxBalasan] || '').trim() && map[id].balasan) sheet.getRange(i + 1, idxBalasan + 1).setValue(map[id].balasan);
      }
    }
    report.push('kategori_surat: sudah ada, backfill default selesai');
  }
}

function _seedSchema(ss, report) {
  var sheet = ss.getSheetByName('form_schema');
  if (sheet.getLastRow() >= 2) { report.push('form_schema: sudah terisi, seed dilewati'); return; }
  var R = function (id, kat, key, label, tipe, opsi, req, ph, ur, grup, sumber, opsional) {
    return [id, kat, key, label, tipe, opsi, req, ph, ur, 'TRUE', grup, sumber, opsional];
  };
  var rows = [
    // --- KENDARAAN (bahan Surat Jalan) ---
    R('F-KND-01','KAT-KEND','pj_nama','Nama Penanggung Jawab','text','','true','',1,'KENDARAAN','master_orang','FALSE'),
    R('F-KND-02','KAT-KEND','pj_nip','NIP','text','','true','',2,'KENDARAAN','','FALSE'),
    R('F-KND-03','KAT-KEND','pj_jabatan','Jabatan','text','','true','',3,'KENDARAAN','','FALSE'),
    R('F-KND-04','KAT-KEND','kendaraan_jenis','Jenis Kendaraan','text','','true','',4,'KENDARAAN','master_aset:kendaraan','FALSE'),
    R('F-KND-05','KAT-KEND','kendaraan_nopol','Nomor Polisi','text','','true','',5,'KENDARAAN','','FALSE'),
    R('F-KND-06','KAT-KEND','keperluan','Keperluan/Kegiatan','textarea','','true','',6,'KENDARAAN','','FALSE'),
    R('F-KND-07','KAT-KEND','tujuan_alamat','Kota/Alamat Tujuan','text','','true','',7,'KENDARAAN','','FALSE'),
    R('F-KND-08','KAT-KEND','sopir_nama','Nama Sopir','text','','false','',8,'KENDARAAN','master_orang','FALSE'),
    // --- BARANG (repeater) ---
    R('F-BRG-01','KAT-BARANG','daftar_barang','Daftar Barang','repeater','nama,jumlah,keterangan','true','',1,'DAFTAR_BARANG','master_aset:barang','FALSE'),
    // --- ORANG (repeater, utk Surat Tugas dll) ---
    R('F-ORG-01','KAT-TUGAS','daftar_orang','Orang yang Ditugaskan','repeater','nama,nip,jabatan','true','',1,'ORANG','master_orang','FALSE'),
    R('F-TGS-01','KAT-TUGAS','maksud_tugas','Maksud Tugas','textarea','','false','',2,'UMUM','','FALSE'),
    // --- Field lain per kategori ---
    R('F-IZN-01','KAT-IZIN','jenis_kegiatan','Jenis Kegiatan','text','','true','',1,'DETAIL_KEGIATAN','','FALSE'),
    R('F-IZN-02','KAT-IZIN','sifat_surat','Sifat Surat','select','Penting,Segera,Biasa','false','',2,'UMUM','','TRUE'),
    R('F-TMP-01','KAT-TEMPAT','peserta_perkiraan','Perkiraan Peserta','number','','false','',1,'DETAIL_KEGIATAN','','TRUE'),
    R('F-LST-01','KAT-LISTRIK','daya','Daya/Titik Listrik','text','','false','',1,'UMUM','','FALSE'),
    R('F-BLH-01','KAT-BALIHO','ukuran_baliho','Ukuran Baliho','text','','false','',1,'UMUM','','FALSE'),
    R('F-BLH-02','KAT-BALIHO','lokasi_baliho','Lokasi Pemasangan','text','','true','',2,'UMUM','master_aset:tempat','FALSE'),
    R('F-DNS-01','KAT-DINAS','keperluan_surat','Keperluan Surat','textarea','','true','',1,'UMUM','','FALSE'),
    R('F-KJG-01','KAT-KUNJUNG','asal_instansi','Asal Instansi','text','','true','',1,'UMUM','','FALSE'),
    R('F-KJG-02','KAT-KUNJUNG','jumlah_tamu','Jumlah Tamu','number','','false','',2,'UMUM','','FALSE'),
    R('F-UND-01','KAT-UND','nama_acara','Nama Acara','text','','false','',1,'DETAIL_KEGIATAN','','FALSE'),
    R('F-UND-02','KAT-UND','penyelenggara','Penyelenggara','text','','false','',2,'UMUM','','FALSE')
  ];
  rows.forEach(function (r) { sheet.appendRow(r); });
  report.push('form_schema: seed ' + rows.length + ' field');
}

function _seedMaster(ss, report) {
  var aset = ss.getSheetByName('master_aset');
  if (aset.getLastRow() < 2) {
    [
      ['AST-T01','tempat','Aula FPSD UPI','Kapasitas ±200 orang','','TRUE'],
      ['AST-T02','tempat','Ruang Rapat Lantai 2','Kapasitas ±30 orang','','TRUE'],
      ['AST-T03','tempat','Lapangan Parkir Timur','Area terbuka','','TRUE'],
      ['AST-B01','barang','Proyektor','Epson XGA','','TRUE'],
      ['AST-B02','barang','Sound System','Portable + 2 mic','','TRUE'],
      ['AST-B03','barang','Kursi Lipat','Satuan','','TRUE'],
      ['AST-K01','kendaraan','Toyota Avanza','D 1234 ABC — 7 kursi','','TRUE'],
      ['AST-K02','kendaraan','Isuzu Elf','D 5678 XYZ — 14 kursi','','TRUE']
    ].forEach(function (r) { aset.appendRow(r); });
    report.push('master_aset: seed 8 baris contoh');
  } else report.push('master_aset: sudah terisi');

  var orang = ss.getSheetByName('master_orang');
  if (orang.getLastRow() < 2) {
    [
      ['ORG-001','Dr. Contoh Nama, M.Pd.','197001012000121001','Dosen','TRUE'],
      ['ORG-002','Contoh Staf, S.E.','198001012010121002','Tenaga Kependidikan','TRUE']
    ].forEach(function (r) { orang.appendRow(r); });
    report.push('master_orang: seed 2 baris contoh');
  } else report.push('master_orang: sudah terisi');
}

/* ================= ENTRY POINT ================= */
function jalankanMigrasi() {
  var ss = _ssMigrasi();
  var report = [];

  // 1) Pastikan semua sheet + header
  for (var name in TARGET_SCHEMA) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    var added = _ensureHeaders(sheet, TARGET_SCHEMA[name]);
    report.push(name + ': ' + (added > 0 ? ('+' + added + ' kolom baru') : 'header lengkap'));
  }

  // 2) Seed
  _seedKategori(ss, report);
  _seedSchema(ss, report);
  _seedMaster(ss, report);

  console.log('=== LAPORAN MIGRASI ===\n' + report.join('\n'));
  return report.join('\n');
}


/* ============================================================================
 * MIGRASI V2 — Tahap 2-3 Custom (mandiri, idempoten, tidak menghapus data)
 * ========================================================================== */

function _ssV2() {
  var id = ConfigService.get('LETTER_CORE_SPREADSHEET_ID');
  if (!id || String(id).indexOf('MASUKKAN') !== -1) throw new Error('Isi LETTER_CORE_SPREADSHEET_ID di Config.gs terlebih dahulu.');
  return SpreadsheetApp.openById(id);
}

function _v2Headers() {
  var ss = _ssV2();

  var kat = ss.getSheetByName('kategori_surat');
  var hK = kat.getDataRange().getDisplayValues()[0];
  var addK = [];
  ['label_tahap2','label_tahap3','pakai_jadwal','mode_tempat'].forEach(function (c) { if (hK.indexOf(c) === -1) addK.push(c); });
  if (addK.length) kat.getRange(1, kat.getLastColumn() + 1, 1, addK.length).setValues([addK]);

  var sch = ss.getSheetByName('form_schema');
  var hS = sch.getDataRange().getDisplayValues()[0];
  if (hS.indexOf('tahap') === -1) sch.getRange(1, sch.getLastColumn() + 1).setValue('tahap');
}

function _v2BackfillKategori() {
  var ss = _ssV2();
  var s = ss.getSheetByName('kategori_surat');
  var data = s.getDataRange().getDisplayValues();
  var h = data[0];
  var iId = h.indexOf('id_kategori'), iL2 = h.indexOf('label_tahap2'), iL3 = h.indexOf('label_tahap3'), iJ = h.indexOf('pakai_jadwal'), iM = h.indexOf('mode_tempat');

  var CFG = {
    'KAT-IZIN':   ['Kegiatan','Detail','TRUE','INPUT'],
    'KAT-DANA':   ['Kegiatan','Detail','TRUE','INPUT'],
    'KAT-TEMPAT': ['Kegiatan','Detail','TRUE','INPUT'],
    'KAT-BARANG': ['Kegiatan','Detail','TRUE','INPUT'],
    'KAT-KEND':   ['Kendaraan','Detail','TRUE','FIELD:tujuan_alamat'],
    'KAT-LISTRIK':['','','FALSE','INPUT'],
    'KAT-BALIHO': ['','','FALSE','INPUT'],
    'KAT-DINAS':  ['','','FALSE','INPUT'],
    'KAT-TUGAS':  ['','','FALSE','INPUT'],
    'KAT-KUNJUNG':['','','FALSE','INPUT'],
    'KAT-UND':    ['','','FALSE','INPUT']
  };

  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][iId] || '').trim();
    var c = CFG[id]; if (!c) continue;
    if (!String(data[i][iL2] || '').trim()) s.getRange(i + 1, iL2 + 1).setValue(c[0]);
    if (!String(data[i][iL3] || '').trim()) s.getRange(i + 1, iL3 + 1).setValue(c[1]);
    if (!String(data[i][iJ]  || '').trim()) s.getRange(i + 1, iJ + 1).setValue(c[2]);
    if (!String(data[i][iM]  || '').trim()) s.getRange(i + 1, iM + 1).setValue(c[3]);
  }

  var exists = data.some(function (r) { return String(r[iId] || '').trim() === 'KAT-DANA'; });
  if (!exists) {
    s.appendRow(['KAT-DANA','Permohonan Bantuan Dana','Pengajuan bantuan/dukungan dana kegiatan','false',11,'TRUE',new Date().toISOString(),'Wakil Dekan Bidang Sumber Daya dan Umum','','Kegiatan','Detail','TRUE','INPUT']);
  }
}

function _v2SeedSchema() {
  var ss = _ssV2();
  var s = ss.getSheetByName('form_schema');
  var data = s.getDataRange().getDisplayValues();
  var h = data[0];
  var iKat = h.indexOf('id_kategori'), iKey = h.indexOf('field_key'), iTahap = h.indexOf('tahap'), iAktif = h.indexOf('aktif');

  var hasMarker = data.some(function (r) { return String(r[iKey] || '') === '__migrasi_v2'; });
  if (hasMarker) return 'seed v2 dilewati (sudah pernah dijalankan)';

  var find = function (kat, key) {
    for (var i = 1; i < data.length; i++) if (String(data[i][iKat] || '').trim() === kat && String(data[i][iKey] || '').trim() === key) return i + 1;
    return -1;
  };

  /* 1) isi tahap untuk field yang sudah ada */
  var TAHAP_MAP = {
    'KAT-IZIN':   { jenis_kegiatan: 2 },
    'KAT-TEMPAT': { peserta_perkiraan: 2 },
    'KAT-BARANG': { daftar_barang: 3 },
    'KAT-KEND':   { pj_nama:2, pj_nip:2, pj_jabatan:2, kendaraan_jenis:2, kendaraan_nopol:2, keperluan:2, tujuan_alamat:2, sopir_nama:2 },
    'KAT-TUGAS':  { maksud_tugas:3, daftar_orang:3 }
  };
  for (var kat in TAHAP_MAP) for (var key in TAHAP_MAP[kat]) {
    var row = find(kat, key);
    if (row > -1) s.getRange(row, iTahap + 1).setValue(TAHAP_MAP[kat][key]);
  }

  /* 2) field baru: Penanggung Jawab & Daftar Pembimbing (repeater opsional) */
  var NEWROWS = [];
  ['KAT-IZIN','KAT-DANA','KAT-TEMPAT','KAT-BARANG'].forEach(function (k) {
    var suf = k.slice(4);
    if (find(k, 'penanggung_jawab') === -1) NEWROWS.push(['F-' + suf + '-PJ', k, 'penanggung_jawab', 'Penanggung Jawab', 'text', '', 'false', '', 1, 'TRUE', 'DETAIL_KEGIATAN', '', 'FALSE', 2]);
    if (find(k, 'daftar_pembimbing') === -1) NEWROWS.push(['F-' + suf + '-PMB', k, 'daftar_pembimbing', 'Dosen Pembimbing', 'repeater', 'nama,nip', 'false', '', 2, 'TRUE', 'DETAIL_KEGIATAN', 'master_orang', 'TRUE', 2]);
  });
  NEWROWS.forEach(function (r) { s.appendRow(r); });

  /* 3) kategori "lainnya" dikosongkan (field dinonaktifkan, bisa diaktifkan admin) */
  var OTHERS = ['KAT-LISTRIK','KAT-BALIHO','KAT-DINAS','KAT-TUGAS','KAT-KUNJUNG','KAT-UND'];
  for (var i = 1; i < data.length; i++) {
    var k2 = String(data[i][iKat] || '').trim();
    if (OTHERS.indexOf(k2) !== -1 && String(data[i][iAktif] || '').toUpperCase() === 'TRUE') {
      s.getRange(i + 1, iAktif + 1).setValue('FALSE');
    }
  }

  /* marker agar tidak dijalankan ulang */
  s.appendRow(['MIG-V2','__SYS','__migrasi_v2','marker sistem','','','','',99,'FALSE','UMUM','','','']);
  return 'seed v2 selesai: ' + NEWROWS.length + ' field baru dibuat';
}

function jalankanMigrasiV2() {
  _v2Headers();
  _v2BackfillKategori();
  var msg = _v2SeedSchema();
  console.log('=== MIGRASI V2 === ' + msg);
  return msg;
}