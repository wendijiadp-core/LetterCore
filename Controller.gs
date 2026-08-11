/**
 * ============================================================================
 * LETTERCORE - API CONTROLLER (Performance Edition: cache + warm + split)
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

/* ================= CACHE SERVER (master & kategori jarang berubah) ================= */
var _CACHE_TTL = 600; // 10 menit
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
  try { CacheService.getScriptCache().removeAll(['lc_kategori', 'lc_master_aset', 'lc_master_orang']); } catch (e) {}
}

/* ================= WARM-UP (anti cold start) ================= */
function keepWarm() { return 'warm'; }
function installWarmupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'keepWarm') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('keepWarm').timeBased().everyMinutes(15).create();
  return 'Trigger warm-up aktif (tiap 15 menit).';
}

/* ================= LOAD TERPISAH: CORE (cepat) vs MASTER (cache) ================= */
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
    return SuratMasuk.simpanSurat(data);
  } catch (e) { return DesignService.error('Gagal menyimpan: ' + e.message, 500); }
}

function apiHapusSurat(params) {
  try { return SuratMasuk.hapusSurat(params.id || params); }
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
  try { return Disposisi.catatKeputusan(params); }
  catch (e) { return DesignService.error('Gagal mencatat keputusan: ' + e.message, 500); }
}

function apiTandaiTercetak(params) {
  try { return Disposisi.tandaiTercetak(params); }
  catch (e) { return DesignService.error('Gagal menandai tercetak: ' + e.message, 500); }
}

function apiTandaiDiterimaPemohon(params) {
  try { return Disposisi.tandaiDiterima(params); }
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

/* ===== MANAJEMEN KATEGORI (invalidasi cache saat berubah) ===== */
function apiSimpanKategori(params) { try { var r = Kategori.simpanKategori(params); _invalidateCache(); return r; } catch (e) { return DesignService.error(e.message, 500); } }
function apiSimpanField(params) { try { var r = Kategori.simpanField(params); _invalidateCache(); return r; } catch (e) { return DesignService.error(e.message, 500); } }
function apiHapusField(params) { try { var r = Kategori.hapusField(params.idField); _invalidateCache(); return r; } catch (e) { return DesignService.error(e.message, 500); } }

/* ===== STATUS: BATAL / AKTIFKAN ===== */
function apiBatalkanSurat(params) { try { return SuratMasuk.batalkanSurat(params.idSurat, params.catatan, params.user); } catch (e) { return DesignService.error(e.message, 500); } }
function apiAktifkanSurat(params) { try { return SuratMasuk.aktifkanSurat(params.idSurat, params.user); } catch (e) { return DesignService.error(e.message, 500); } }