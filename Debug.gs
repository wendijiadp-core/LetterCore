/**
 * ============================================================================
 * LETTERCORE - DEBUG TOOLS (jalankan dari Editor)
 * ============================================================================ */

function debugTestDatabase() {
  var id = ConfigService.get('LETTER_CORE_SPREADSHEET_ID');
  if (!id || String(id).indexOf('MASUKKAN') !== -1) throw new Error('LETTER_CORE_SPREADSHEET_ID belum diisi!');
  var ss = SpreadsheetApp.openById(id);
  return 'OK terhubung ke: ' + ss.getName();
}

function debugTestSimpan() {
  var res = SuratMasuk.simpanSurat({
    tglDiterima: '2026-08-09', tglSurat: '2026-08-09',
    pengirim: 'UJI COBA', tujuan: 'Administrasi Umum',
    nomorSurat: '001/UJI/2026', perihal: 'Surat Uji Coba',
    deskripsi: 'Test dari Debug.gs',
    pemroses: 'Sistem (@debug)',
    kategoriId: '', customFields: {},
    jadwalList: [{ tglMulai: '2026-08-10', tglSelesai: '2026-08-10', waktuMulai: '09:00', waktuSelesai: '11:00', tempatKegiatan: 'Ruang Rapat' }]
  });
  console.log(JSON.stringify(res));
  return res;
}

function debugCekEkspedisi() {
  var data = SuratMasuk.getDaftarSurat();
  if (!data.length) return 'Belum ada surat.';
  return Ekspedisi.getRiwayat(data[0].idSurat);
}

function debugRapikanAgenda() {
  var res = SuratMasuk.rapikanAgenda();
  console.log(JSON.stringify(res));
  return res;
}