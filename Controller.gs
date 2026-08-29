/**
 * ============================================================================
 * LETTERCORE - API CONTROLLER (Performance Edition: cache + warm + split + autosync)
 * + apiEnsureDisposisi (pengaman bila trigger terlambat)
 * UPDATE: Tambah API kegiatan, API ruang SpaceCore (cached), API cek bentrok, update apiBoot
 * ============================================================================
 */
var DesignService = (typeof DesignService !== 'undefined') ? DesignService : (function () {
  return {
    success: function (data, message) { return { success: true, data: data, message: message || 'OK' }; },
    error: function (message, code) { return { success: false, message: message || 'Error', code: code || 500 }; }
  };
})();

function _actorFrom(user) {
  if (!user) return 'Sistem';
  return (user.fullName || user.username || 'Sistem') + ' (@' + (user.username || '-') + ')';
}

/* ================= CACHE SERVER ================= */
var _CACHE_TTL = 600;
function _cached(key, fn) {
  try {
    var c = CacheService.getScriptCache();
    var v = c.get(key);
    if (v) return JSON.parse(v);
    var r = fn();
    try { c.put(key, JSON.stringify(r), _CACHE_TTL); } catch (e) {}
    return r;
  } catch (e) { return fn(); }
}
function _invalidateCache() {
  try { CacheService.getScriptCache().removeAll(['lc_kategori', 'lc_master_aset', 'lc_master_orang', 'lc_ruang_spacecore']); } catch (e) {}
}

/* ================= WARM-UP ================= */
function keepWarm() { return 'warm'; }
function installWarmupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'keepWarm') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('keepWarm').timeBased().everyMinutes(15).create();
  return 'Trigger warm-up aktif (tiap 15 menit).';
}

/* ================= LOAD TERPISAH ================= */
function apiLoadCore(params) {
  try {
    return DesignService.success({
      surat: SuratMasuk.getDaftarSurat(),
      kategori: _cached('lc_kategori', function () { return SuratMasuk.getKategoriList(); }),
      ekspedisi: Ekspedisi.getSemua()
    });
  } catch (e) { return DesignService.error('Gagal memuat inti: ' + e.message, 500); }
}

function apiLoadMaster(params) {
  try {
    return DesignService.success({
      masterAset: _cached('lc_master_aset', function () { return Master.getAset(''); }),
      masterOrang: _cached('lc_master_orang', function () { return Master.getOrang(); })
    });
  } catch (e) { return DesignService.error('Gagal memuat master: ' + e.message, 500); }
}

/* ================= AUTH ================= */
function apiLogout(params) {
  var user = (params && params.user) || {};
  if (typeof destroySession === 'function') destroySession(user.username);
  return DesignService.success({ redirectUrl: ConfigService.get('LAUNCHER_PORTAL_URL') }, 'Logout berhasil.');
}

/* ================= SURAT MASUK ================= */
function apiGetSuratMasuk(params) {
  try { return DesignService.success(SuratMasuk.getDaftarSurat()); }
  catch (e) { return DesignService.error('Gagal mengambil data: ' + e.message, 500); }
}

function apiSimpanSuratMasuk(params) {
  try {
    var data = params.data || {};
    data.pemroses = _actorFrom(params.user);
    var r = SuratMasuk.simpanSurat(data);
    Storage.bumpVersion();
    return r;
  } catch (e) { return DesignService.error('Gagal menyimpan: ' + e.message, 500); }
}

function apiHapusSurat(params) {
  try {
    var r = SuratMasuk.hapusSurat(params.id || params);
    Storage.bumpVersion();
    return r;
  }
  catch (e) { return DesignService.error('Gagal menghapus: ' + e.message, 500); }
}

function apiGetEnumList(params) {
  try { return DesignService.success(SuratMasuk.getEnumList()); }
  catch (e) { return DesignService.error('Gagal mengambil enum: ' + e.message, 500); }
}

/* ================= KATEGORI & SCHEMA ================= */
function apiGetKategoriList(params) {
  try { return DesignService.success(SuratMasuk.getKategoriList()); }
  catch (e) { return DesignService.error('Gagal mengambil kategori: ' + e.message, 500); }
}

function apiGetFormSchema(params) {
  try { return DesignService.success(SuratMasuk.getFormSchema((params && params.idKategori) || '')); }
  catch (e) { return DesignService.error('Gagal mengambil schema: ' + e.message, 500); }
}

/* ================= MASTER DATA ================= */
function apiGetMasterAset(params) {
  try { return DesignService.success(Master.getAset((params && params.jenis) || '')); }
  catch (e) { return DesignService.error('Gagal mengambil master aset: ' + e.message, 500); }
}

function apiGetMasterOrang(params) {
  try { return DesignService.success(Master.getOrang()); }
  catch (e) { return DesignService.error('Gagal mengambil master orang: ' + e.message, 500); }
}

/* ================= DISPOSISI & EKSPEDISI ================= */
function apiCatatKeputusanDisposisi(params) {
  try {
    var r = Disposisi.catatKeputusan(params);
    Storage.bumpVersion();
    return r;
  }
  catch (e) { return DesignService.error('Gagal mencatat keputusan: ' + e.message, 500); }
}

function apiTandaiTercetak(params) {
  try {
    var r = Disposisi.tandaiTercetak(params);
    Storage.bumpVersion();
    return r;
  }
  catch (e) { return DesignService.error('Gagal menandai tercetak: ' + e.message, 500); }
}

function apiTandaiDiterimaPemohon(params) {
  try {
    var r = Disposisi.tandaiDiterima(params);
    Storage.bumpVersion();
    return r;
  }
  catch (e) { return DesignService.error('Gagal menandai diterima: ' + e.message, 500); }
}

function apiGetEkspedisi(params) {
  try { return DesignService.success(Ekspedisi.getRiwayat((params && params.idSurat) || '')); }
  catch (e) { return DesignService.error('Gagal mengambil ekspedisi: ' + e.message, 500); }
}

function apiGetDisposisiBySurat(params) {
  try { return DesignService.success(Disposisi.getBySurat((params && params.idSurat) || '')); }
  catch (e) { return DesignService.error('Gagal mengambil disposisi: ' + e.message, 500); }
}

function apiGetEkspedisiAll(params) {
  try { return DesignService.success(Ekspedisi.getSemua()); }
  catch (e) { return DesignService.error(e.message, 500); }
}

/* ===== MANAJEMEN KATEGORI ===== */
function apiSimpanKategori(params) {
  try {
    var r = Kategori.simpanKategori(params);
    _invalidateCache();
    Storage.bumpVersion();
    return r;
  } catch (e) { return DesignService.error(e.message, 500); }
}

function apiSimpanField(params) {
  try {
    var r = Kategori.simpanField(params);
    _invalidateCache();
    Storage.bumpVersion();
    return r;
  } catch (e) { return DesignService.error(e.message, 500); }
}

function apiHapusField(params) {
  try {
    var r = Kategori.hapusField(params.idField, params.idKategori);
    _invalidateCache();
    Storage.bumpVersion();
    return r;
  } catch (e) { return DesignService.error(e.message, 500); }
}

/* ===== STATUS: BATAL / AKTIFKAN ===== */
function apiBatalkanSurat(params) {
  try {
    var r = SuratMasuk.batalkanSurat(params.idSurat, params.catatan, params.user);
    Storage.bumpVersion();
    return r;
  } catch (e) { return DesignService.error(e.message, 500); }
}

function apiAktifkanSurat(params) {
  try {
    var r = SuratMasuk.aktifkanSurat(params.idSurat, params.user);
    Storage.bumpVersion();
    return r;
  } catch (e) { return DesignService.error(e.message, 500); }
}

/* ===== TEMPLATE DISPOSISI DINAMIS ===== */
function apiGetTemplateDisposisi(params) {
  try {
    var kategoriId = params.kategoriId || '';
    var kategori = SuratMasuk.getKategoriList().find(function (k) { return k.id === kategoriId; });
    var templateKey = kategori ? (kategori.templateDisposisi || 'default') : 'default';

    var TEMPLATES = {
      'default': {
        subject: 'Disposisi Surat',
        body: 'Dengan hormat,\n\nMohon tindak lanjut surat dari {{PENGIRIM}} perihal {{PERIHAL}}.\n\nDemikian untuk menjadi perhatian.\n\nHormat kami,'
      },
      'peminjaman': {
        subject: 'Disposisi Peminjaman',
        body: 'Dengan hormat,\n\n{{PERIHAL}} dari {{PENGIRIM}} untuk kegiatan {{DESKRIPSI}}.\n\nMohon diproses sesuai ketentuan yang berlaku.\n\nHormat kami,'
      },
      'undangan': {
        subject: 'Disposisi Undangan',
        body: 'Dengan hormat,\n\nUndangan dari {{PENGIRIM}} perihal {{PERIHAL}}.\n\nMohon konfirmasi kehadiran.\n\nHormat kami,'
      }
    };

    var template = TEMPLATES[templateKey] || TEMPLATES['default'];
    return DesignService.success(template);
  } catch (e) { return DesignService.error(e.message, 500); }
}

function apiSimpanTemplateDisposisi(params) {
  try {
    var ss = SpreadsheetApp.openById(ConfigService.get('LETTER_CORE_SPREADSHEET_ID'));
    var s = ss.getSheetByName('kategori_surat');
    if (!s) return DesignService.error('Sheet kategori_surat tidak ditemukan', 404);

    var h = s.getRange(1, 1, 1, Math.max(s.getLastColumn(), 1)).getDisplayValues()[0];
    var iKat = h.indexOf('id_kategori'), iTpl = h.indexOf('template_disposisi');

    if (iTpl === -1) {
      iTpl = s.getLastColumn() + 1;
      s.getRange(1, iTpl).setValue('template_disposisi');
    } else {
      iTpl++;
    }

    var data = s.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][iKat]) === params.kategoriId) {
        s.getRange(i + 1, iTpl).setValue(params.templateKey || 'default');
        Storage.bumpVersion();
        return DesignService.success({ message: 'Template tersimpan' });
      }
    }
    return DesignService.error('Kategori tidak ditemukan', 404);
  } catch (e) { return DesignService.error(e.message, 500); }
}

/* ================= API SURAT KELUAR ================= */

function apiGetDaftarTemplateKeluar(params) {
  try { return DesignService.success(SuratKeluar.getDaftarTemplate()); }
  catch (e) { return DesignService.error('Gagal: ' + e.message, 500); }
}

function apiSimpanTemplateKeluar(params) {
  try {
    var r = SuratKeluar.simpanTemplate(params.jenis, params.templateId, params.namaTemplate, params.user);
    Storage.bumpVersion();
    return r;
  }
  catch (e) { return DesignService.error('Gagal: ' + e.message, 500); }
}

function apiGenerateDokumenKeluar(params) {
  try {
    var r = SuratKeluar.generateDokumen(params.data, params.user);
    Storage.bumpVersion();
    return r;
  }
  catch (e) { return DesignService.error('Gagal: ' + e.message, 500); }
}

function apiGetDaftarSuratKeluar(params) {
  try { return DesignService.success(SuratKeluar.getDaftar()); }
  catch (e) { return DesignService.error('Gagal mengambil data surat keluar: ' + e.message, 500); }
}

function apiGetSuratKeluar(params) {
  try { return DesignService.success(SuratKeluar.getDaftar()); }
  catch (e) { return DesignService.error('Gagal mengambil data surat keluar: ' + e.message, 500); }
}

function apiSimpanSuratKeluar(params) {
  try {
    var r = SuratKeluar.simpan(params.data);
    Storage.bumpVersion();
    return r;
  }
  catch (e) { return DesignService.error('Gagal menyimpan surat keluar: ' + e.message, 500); }
}

function apiUpdateFinalSuratKeluar(params) {
  try {
    var r = SuratKeluar.updateFinal(params.id, params.fileScan, params.user, params.alasan);
    Storage.bumpVersion();
    return r;
  }
  catch (e) { return DesignService.error('Gagal memperbarui status: ' + e.message, 500); }
}

function apiFinalkanSuratKeluar(params) {
  try {
    var r = SuratKeluar.updateFinal(params.id, params.fileScan || params.urlScan, params.user);
    Storage.bumpVersion();
    return r;
  }
  catch (e) { return DesignService.error('Gagal memperbarui status: ' + e.message, 500); }
}

/* ================= API SURAT KELUAR (lanjutan) ================= */

function apiGetDaftarJenisKeluar(params) {
  try { return DesignService.success(SuratKeluar.getDaftarJenis()); }
  catch (e) { return DesignService.error('Gagal: ' + e.message, 500); }
}

function apiGetDetailSuratKeluar(params) {
  try { return DesignService.success(SuratKeluar.getDetail(params.id)); }
  catch (e) { return DesignService.error('Gagal: ' + e.message, 500); }
}

function apiHapusSuratKeluar(params) {
  try {
    var r = SuratKeluar.hapus(params.id);
    Storage.bumpVersion();
    return r;
  }
  catch (e) { return DesignService.error('Gagal: ' + e.message, 500); }
}

/* ================= API PLACEHOLDER & FIELD KEYS ================= */
function apiGetDaftarPlaceholder(params) {
  try { return DesignService.success(Storage.read('placeholder_surat')); }
  catch (e) { return DesignService.error('Gagal: ' + e.message, 500); }
}

function apiSimpanPlaceholder(params) {
  try {
    var r = { success: Storage.save('placeholder_surat', params.row), message: 'Placeholder tersimpan.' };
    Storage.bumpVersion();
    return r;
  }
  catch (e) { return DesignService.error('Gagal: ' + e.message, 500); }
}

function apiHapusPlaceholder(params) {
  try {
    var r = { success: Storage.remove('placeholder_surat', { key: params.key }), message: 'Placeholder dihapus.' };
    Storage.bumpVersion();
    return r;
  }
  catch (e) { return DesignService.error('Gagal: ' + e.message, 500); }
}

function apiGetAvailableFieldKeys(params) {
  try { return DesignService.success(SuratKeluar.getAvailableFieldKeys()); }
  catch (e) { return DesignService.error('Gagal: ' + e.message, 500); }
}

/* ================= API MASTER JENIS & SCHEMA KELUAR ================= */
function apiSimpanJenisKeluar(params) {
  try {
    var r = SuratKeluar.simpanJenis(params.data, params.user);
    Storage.bumpVersion();
    return r;
  }
  catch (e) { return DesignService.error('Gagal: ' + e.message, 500); }
}

function apiNonaktifkanJenisKeluar(params) {
  try {
    var r = SuratKeluar.nonaktifJenis(params.id);
    Storage.bumpVersion();
    return r;
  }
  catch (e) { return DesignService.error('Gagal: ' + e.message, 500); }
}

function apiGetSchemaJenisKeluar(params) {
  try { return DesignService.success(SuratKeluar.getSchemaJenis(params.idJenis)); }
  catch (e) { return DesignService.error('Gagal: ' + e.message, 500); }
}

function apiSimpanFieldJenisKeluar(params) {
  try {
    var r = SuratKeluar.simpanFieldJenis(params);
    Storage.bumpVersion();
    return r;
  }
  catch (e) { return DesignService.error('Gagal: ' + e.message, 500); }
}

function apiHapusFieldJenisKeluar(params) {
  try {
    var r = SuratKeluar.hapusFieldJenis(params.idField);
    Storage.bumpVersion();
    return r;
  }
  catch (e) { return DesignService.error('Gagal: ' + e.message, 500); }
}

/* ================= API PENGATURAN (sync/hapus) ================= */
function apiSyncPlaceholders(params) {
  try {
    var r = SuratKeluar.syncPlaceholders();
    Storage.bumpVersion();
    return r;
  }
  catch (e) { return DesignService.error('Gagal: ' + e.message, 500); }
}

function apiHapusTemplateKeluar(params) {
  try {
    var r = SuratKeluar.hapusTemplate(params.jenis);
    Storage.bumpVersion();
    return r;
  }
  catch (e) { return DesignService.error('Gagal: ' + e.message, 500); }
}

function apiHapusJenisKeluar(params) {
  try {
    var r = SuratKeluar.nonaktifJenis(params.id);
    Storage.bumpVersion();
    return r;
  }
  catch (e) { return DesignService.error('Gagal: ' + e.message, 500); }
}

/* ===== TEMPLATE DISPOSISI PER KATEGORI ===== */
function apiGetTemplateDisposisiList(params) {
  try { return DesignService.success(Disposisi.getDaftarTemplateDisposisi()); }
  catch (e) { return DesignService.error(e.message, 500); }
}

function apiSimpanTemplateDisposisiDoc(params) {
  try {
    var r = Disposisi.simpanTemplateDisposisi(params);
    Storage.bumpVersion();
    return r;
  }
  catch (e) { return DesignService.error(e.message, 500); }
}

function apiHapusTemplateDisposisiDoc(params) {
  try {
    var r = Disposisi.hapusTemplateDisposisi(params.kategoriId);
    Storage.bumpVersion();
    return r;
  }
  catch (e) { return DesignService.error(e.message, 500); }
}

/* ===== TRANSFORMASI PLACEHOLDER ===== */
function apiGetDaftarTransformasiPH(params) {
  try { return DesignService.success(TransformasiPH.daftar()); }
  catch (e) { return DesignService.error(e.message, 500); }
}

function apiSimpanTransformasiPH(params) {
  try {
    var r = TransformasiPH.simpan(params);
    Storage.bumpVersion();
    return r;
  } catch (e) { return DesignService.error(e.message, 500); }
}

function apiHapusTransformasiPH(params) {
  try {
    var r = TransformasiPH.hapus(params.id);
    Storage.bumpVersion();
    return r;
  } catch (e) { return DesignService.error(e.message, 500); }
}

/* ===== FLEKSIBILITAS: BUKA KEMBALI EKSPEDISI ===== */
function apiBukaKembaliEkspedisi(params) {
  try {
    Ekspedisi.catat(params.idSurat, 'dibuka_kembali', 'Ekspedisi dibuka kembali untuk revisi', params.alasan || '', _actorFrom(params.user));
    Storage.bumpVersion();
    return { success: true, message: 'Ekspedisi dibuka kembali.' };
  } catch (e) { return DesignService.error(e.message, 500); }
}

/* ===== LIBUR: otomatis (API, cache per tahun) + fallback offline ===== */
var SERVER_LIBUR_FB = {
  '2026': [
    {date:'2026-01-01',name:'Tahun Baru Masehi'},{date:'2026-02-17',name:'Tahun Baru Imlek 2577'},{date:'2026-03-19',name:'Hari Suci Nyepi'},
    {date:'2026-03-20',name:'Idul Fitri 1447 H'},{date:'2026-03-21',name:'Idul Fitri 1447 H'},{date:'2026-04-03',name:'Wafat Isa Almasih'},
    {date:'2026-05-01',name:'Hari Buruh Internasional'},{date:'2026-05-14',name:'Kenaikan Isa Almasih'},{date:'2026-05-27',name:'Idul Adha 1447 H'},
    {date:'2026-05-31',name:'Hari Raya Waisak'},{date:'2026-06-01',name:'Hari Lahir Pancasila'},{date:'2026-06-16',name:'Tahun Baru Islam 1448'},
    {date:'2026-08-17',name:'Hari Kemerdekaan RI'},{date:'2026-08-25',name:'Maulid Nabi Muhammad SAW'},{date:'2026-12-25',name:'Hari Raya Natal'}
  ]
};

function apiGetLiburTahun(params) {
  try {
    var tahun = String(params.tahun || new Date().getFullYear());
    var ss = SpreadsheetApp.openById(ConfigService.get('LETTER_CORE_SPREADSHEET_ID'));
    var sh = ss.getSheetByName('cache_libur');
    if (!sh) { sh = ss.insertSheet('cache_libur'); sh.appendRow(['tahun','json','updated_at']); }
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) if (String(data[i][0]) === tahun) return DesignService.success(JSON.parse(data[i][1]));

    var out = null;
    try {
      var resp = UrlFetchApp.fetch('https://date.nager.dev/api/v3/PublicHolidays/' + tahun + '/ID', { muteHttpExceptions: true });
      if (resp.getResponseCode() === 200) {
        var arr = JSON.parse(resp.getContentText());
        out = (arr || []).map(function (h) { return { date: h.date, name: h.localName || h.name }; });
      }
    } catch (e) { out = null; }

    if (out) {
      sh.appendRow([tahun, JSON.stringify(out), new Date()]);
      Storage.bumpVersion();
      return DesignService.success(out);
    }
    return DesignService.success(SERVER_LIBUR_FB[tahun] || []);
  } catch (e) { return DesignService.success([]); }
}

function apiGetLiburManual(params) {
  try { return DesignService.success(Storage.read('hari_libur') || []); }
  catch (e) { return DesignService.error(e.message, 500); }
}

function apiSimpanLiburManual(params) {
  try {
    var rec = { id_libur: params.id || ('LIB-' + Date.now()), tanggal: params.tanggal, nama: params.nama, jenis: 'manual' };
    var r = { success: Storage.save('hari_libur', rec), message: 'Libur manual tersimpan.' };
    Storage.bumpVersion();
    return r;
  } catch (e) { return DesignService.error(e.message, 500); }
}

function apiHapusLiburManual(params) {
  try {
    var r = { success: Storage.remove('hari_libur', { id_libur: params.id }), message: 'Dihapus.' };
    Storage.bumpVersion();
    return r;
  } catch (e) { return DesignService.error(e.message, 500); }
}

/* ===== KEGIATAN MANDIRI (tanpa surat masuk) ===== */
function apiGetDaftarAgenda(params) {
  try { return DesignService.success(Storage.read('agenda') || []); }
  catch (e) { return DesignService.error(e.message, 500); }
}

function apiSimpanAgenda(params) {
  try {
    var rec = { id_agenda: params.id || ('AGD-' + Date.now()), judul: params.judul, pemohon: params.pemohon || '',
      tgl_mulai: params.tglMulai, tgl_selesai: params.tglSelesai || params.tglMulai,
      waktu_mulai: params.waktuMulai || '', waktu_selesai: params.waktuSelesai || '',
      tempat: params.tempat || '', sumber: 'mandiri', created_at: new Date() };
    var ok = Storage.save('agenda', rec);
    Storage.bumpVersion();
    return ok ? { success: true, message: 'Kegiatan tersimpan.' } : { success: false, message: 'Gagal menyimpan.' };
  } catch (e) { return DesignService.error(e.message, 500); }
}

function apiHapusAgenda(params) {
  try {
    var r = { success: Storage.remove('agenda', { id_agenda: params.id }), message: 'Kegiatan dihapus.' };
    Storage.bumpVersion();
    return r;
  } catch (e) { return DesignService.error(e.message, 500); }
}

/* ===== RUANG SPACECORE (cached) ===== */
function apiGetDaftarRuangSpaceCore(params) {
  try {
    return DesignService.success(_cached('lc_ruang_spacecore', function () {
      return SuratMasuk.getDaftarRuangSpaceCore();
    }));
  } catch (e) { return DesignService.error(e.message, 500); }
}

/* ===== CEK BENTROK RUANG ===== */
function apiCekBentrokRuang(params) {
  try {
    return DesignService.success(SuratMasuk.cekBentrokRuang(
      params.ruangId, params.tglMulai, params.waktuMulai, params.waktuSelesai, params.excludeIdSurat
    ));
  } catch (e) { return DesignService.error(e.message, 500); }
}

/* ===== KEGIATAN (pengelompokan surat) — BARU ===== */
function apiGetDaftarKegiatan(params) {
  try { return DesignService.success(SuratMasuk.getDaftarKegiatan()); }
  catch (e) { return DesignService.error(e.message, 500); }
}

function apiSimpanKegiatan(params) {
  try {
    var r = SuratMasuk.simpanKegiatan(params.data || {}, params.user);
    Storage.bumpVersion();
    return r;
  } catch (e) { return DesignService.error(e.message, 500); }
}

function apiHapusKegiatan(params) {
  try {
    var r = SuratMasuk.hapusKegiatan(params.id);
    Storage.bumpVersion();
    return r;
  } catch (e) { return DesignService.error(e.message, 500); }
}

/* ===== RUANG SPACECORE (cached) — BARU ===== */
function apiGetDaftarRuangSpaceCore(params) {
  try {
    return DesignService.success(_cached('lc_ruang_spacecore', function () {
      return SuratMasuk.getDaftarRuangSpaceCore();
    }));
  } catch (e) { return DesignService.error(e.message, 500); }
}

/* ===== CEK BENTROK RUANG — BARU ===== */
function apiCekBentrokRuang(params) {
  try {
    return DesignService.success(SuratMasuk.cekBentrokRuang(
      params.ruangId, params.tglMulai, params.waktuMulai, params.waktuSelesai, params.excludeIdSurat
    ));
  } catch (e) { return DesignService.error(e.message, 500); }
}

/* ===== BOOT: semua data awal dalam satu panggilan (hemat cold-start) ===== */
function apiBoot(params) {
  var out = {};
  function safe(key, fn) { try { out[key] = fn(); } catch (e) { out[key] = (key === 'ekspedisi' || key === 'masterAset') ? {} : []; } }
  safe('surat', function () { return SuratMasuk.getDaftarSurat(); });
  safe('kategori', function () { return SuratMasuk.getKategoriList(); });
  safe('ekspedisi', function () { return Ekspedisi.getSemua(); });
  safe('masterAset', function () { return Master.getAset(''); });
  safe('masterOrang', function () { return Master.getOrang(); });
  safe('suratKeluar', function () { return SuratKeluar.getDaftar(); });
  safe('jenisKeluar', function () { return SuratKeluar.getDaftarJenis(); });
  safe('templates', function () { return SuratKeluar.getDaftarTemplate(); });
  safe('placeholders', function () { return Storage.read('placeholder_surat') || []; });
  safe('fieldKeys', function () { return SuratKeluar.getAvailableFieldKeys(); });
  safe('tplDisp', function () { return Disposisi.getDaftarTemplateDisposisi(); });
  safe('transforms', function () { return TransformasiPH.daftar(); });
  safe('liburManual', function () { return Storage.read('hari_libur') || []; });
  safe('ruangSpaceCore', function () { return SuratMasuk.getDaftarRuangSpaceCore(); });
  /* agenda: konversi Date → string agar aman diserialisasi */
  try {
    out.agenda = (Storage.read('agenda') || []).map(function (a) {
      var o = {}; for (var k in a) o[k] = (a[k] instanceof Date) ? Utilities.formatDate(a[k], Session.getScriptTimeZone(), 'yyyy-MM-dd') : a[k]; return o;
    });
  } catch (e) { out.agenda = []; }
  return DesignService.success(out);
}

/* ===== VERSION CHECK: ringan untuk polling klien ===== */
function apiGetVersion(params) {
  try {
    var version = PropertiesService.getScriptProperties().getProperty('dataVersion') || '0';
    return DesignService.success({ version: version });
  } catch (e) {
    return DesignService.success({ version: '0' });
  }
}

/* ===== DISPOSISI ON-DEMAND (manual) ===== */
function apiGenerateDisposisi(params) {
  try {
    var r = Disposisi.generateForSurat(params.idSurat);
    Storage.bumpVersion();
    return r && r.docId ? { success: true, message: 'Disposisi dibuat.', data: r } : { success: false, message: 'Template disposisi belum dikonfigurasi.' };
  } catch (e) { return DesignService.error(e.message, 500); }
}

/* ===== PENGAMAN DISPOSISI: cek dan buat bila belum ada (dipanggil 4 detik pasca-save) ===== */
function apiEnsureDisposisi(params) {
  try {
    var idSurat = String(params.idSurat || '').replace(/^'/, '').trim();
    if (!idSurat) return DesignService.success({ created: false, reason: 'no_id' });

    var ss = SpreadsheetApp.openById(ConfigService.get('LETTER_CORE_SPREADSHEET_ID'));
    var s = ss.getSheetByName('Surat_Masuk');
    if (!s) return DesignService.success({ created: false, reason: 'no_sheet' });

    var h = s.getRange(1, 1, 1, Math.max(s.getLastColumn(), 1)).getDisplayValues()[0];
    var iId = h.indexOf('ID Surat');
    var iUrl = h.indexOf('URL Disposisi');
    if (iId === -1 || iUrl === -1) return DesignService.success({ created: false, reason: 'no_col' });

    var data = s.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var rowId = String(data[i][iId] || '').replace(/^'/, '').trim();
      if (rowId === idSurat) {
        var url = String(data[i][iUrl] || '').trim();
        if (url) {
          return DesignService.success({ created: false, reason: 'already_exists', url: url });
        }
        break;
      }
    }

    var r = Disposisi.generateForSurat(idSurat);

    try { Storage.remove('doc_queue', { id_surat: idSurat }); } catch (e) {}

    Storage.bumpVersion();
    return DesignService.success({
      created: !!(r && r.docId),
      docId: r && r.docId,
      docUrl: r && r.docUrl
    });
  } catch (e) {
    return DesignService.error(e.message, 500);
  }
}

/* ===== TRIGGER ANTREAN DISPOSISI (tiap 1 menit, safety net) ===== */
function processDocQueue() {
  try { Disposisi.processQueue(); } catch (e) { console.error('[processDocQueue] ' + e); }
}
function installDocQueueTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processDocQueue') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('processDocQueue').timeBased().everyMinutes(1).create();
  return 'Trigger antrean disposisi aktif (tiap 1 menit).';
}








function testBacaSpaceCore() {
  try {
    var spaceId = ConfigService.get('SPACE_CORE_SPREADSHEET_ID');
    Logger.log('SpaceCore ID: ' + spaceId);
    var ss = SpreadsheetApp.openById(spaceId);
    Logger.log('Spreadsheet opened: ' + ss.getName());
    var sh = ss.getSheetByName('sc_ruangan');
    if (!sh) { Logger.log('ERROR: Sheet sc_ruangan tidak ditemukan'); return; }
    var data = sh.getDataRange().getValues();
    Logger.log('Total baris: ' + data.length);
    Logger.log('Header: ' + JSON.stringify(data[0]));
    var aktif = data.filter(function(r, i) { return i > 0 && String(r[data[0].indexOf('status')]).toLowerCase() === 'aktif'; });
    Logger.log('Ruangan aktif: ' + aktif.length);
    if (aktif.length > 0) Logger.log('Contoh: ' + JSON.stringify(aktif[0]));
  } catch (e) {
    Logger.log('ERROR: ' + e.toString());
  }
}