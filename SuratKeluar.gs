/**
 * ============================================================================
 * SURAT KELUAR SERVICE (Final: kolom camelCase + upload scan + sync placeholder)
 * ============================================================================
 */
var SuratKeluar = (function() {
  'use strict';
  var PREFIX_SCHEMA = 'KLR:';

  var DEFAULT_JENIS = [
    { id: 'IZIN_TEMPAT', nama: 'Surat Izin Peminjaman Tempat', mode: 'TEMPLATE' },
    { id: 'IZIN_BARANG', nama: 'Surat Izin Peminjaman Barang', mode: 'TEMPLATE' },
    { id: 'SURAT_JALAN', nama: 'Surat Jalan', mode: 'TEMPLATE' },
    { id: 'SURAT_EDARAN', nama: 'Surat Edaran', mode: 'CATAT' },
    { id: 'SURAT_TUGAS', nama: 'Surat Tugas', mode: 'CATAT' },
    { id: 'PENGUMUMAN', nama: 'Pengumuman', mode: 'CATAT' },
    { id: 'LAINNYA', nama: 'Lainnya', mode: 'CATAT' }
  ];

  function _seedJikaKosong() {
    try {
      var rows = Storage.read('jenis_keluar');
      if (!rows || rows.length === 0) {
        DEFAULT_JENIS.forEach(function(j){
          Storage.save('jenis_keluar', { id_jenis: j.id, nama: j.nama, mode: j.mode, aktif: true, created_at: new Date() });
        });
      }
    } catch (e) {}
  }

  /* ============ MASTER JENIS ============ */
  function getDaftarJenis(includeInactive) {
    _seedJikaKosong();
    var rows = Storage.read('jenis_keluar') || [];
    return rows
      .filter(function(r){ return includeInactive ? true : !(r.aktif === false || r.aktif === 'false'); })
      .map(function(r){ return { id: r.id_jenis, nama: r.nama, mode: r.mode || 'CATAT', aktif: !(r.aktif===false||r.aktif==='false') }; });
  }
  function simpanJenis(data, user) {
    if (!data.nama) throw new Error('Nama jenis wajib diisi.');
    var id = data.id || '';
    if (!id) {
      var base = String(data.nama).toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,24) || ('JNS-'+Date.now());
      id = base; var ex = Storage.read('jenis_keluar')||[]; var n=2;
      while (ex.some(function(r){ return r.id_jenis===id; })) { id = base+'-'+n; n++; }
    }
    var ok = Storage.save('jenis_keluar', { id_jenis:id, nama:data.nama, mode:data.mode||'CATAT', aktif:true, created_at:new Date() });
    return ok ? { success:true, id:id, message:'Jenis "'+data.nama+'" tersimpan.' } : { success:false, message:'Gagal menyimpan jenis.' };
  }
  function nonaktifJenis(id) {
    var ok = Storage.update('jenis_keluar', { id_jenis:id }, { aktif:false });
    return ok ? { success:true, message:'Jenis dinonaktifkan.' } : { success:false, message:'Jenis tidak ditemukan.' };
  }

  /* ============ SCHEMA MANDIRI ============ */
  function getSchemaJenis(idJenis){ return Storage.find('form_schema', { id_kategori: PREFIX_SCHEMA+idJenis }) || []; }
  function simpanFieldJenis(params){
    var label = params.label||''; if(!label) throw new Error('Label field wajib diisi.');
    var fieldKey = params.fieldKey || String(label).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
    var rec = { id_field: params.idField||('FLD-KLR-'+Date.now()), id_kategori: PREFIX_SCHEMA+params.idJenis, field_key: fieldKey,
      label: label, tipe: params.tipe||'text', opsi: params.opsi||'', required:!!params.required, placeholder: params.placeholder||'',
      urutan: parseInt(params.urutan,10)||0, aktif:true, sumber_data: params.sumberData||'', grup:'KELUAR-MANDIRI' };
    var ok = Storage.save('form_schema', rec);
    return ok ? { success:true, message:'Field "'+label+'" tersimpan.', fieldKey:fieldKey } : { success:false, message:'Gagal menyimpan field.' };
  }
  function hapusFieldJenis(idField){
    var ok = Storage.remove('form_schema', { id_field:idField });
    return ok ? { success:true, message:'Field dihapus.' } : { success:false, message:'Field tidak ditemukan.' };
  }

  /* ============ CRUD SURAT KELUAR (kolom camelCase sesuai sheet) ============ */
  /* Date/objek → string, agar aman melewati google.script.run */
  function _ser(v){
    if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    if (v && typeof v === 'object') return String(v);
    return v;
  }
  function getDaftar(){
    var rows=[]; try{ rows=Storage.read('surat_keluar')||[]; }catch(e){ return []; }
    var jenisMap={}; try{ (Storage.read('jenis_keluar')||[]).forEach(function(j){ jenisMap[j.id_jenis]=j.nama; }); }catch(e){}
    return rows.map(function(r){
      var o={};
      for (var k in r) o[k] = _ser(r[k]);
      o.jenis_nama = o.jenis_nama || (o.jenisKeluar ? (jenisMap[o.jenisKeluar]||'') : '');
      return o;
    });
  }
  function simpan(data){
    var rec = {
      idKeluar: 'SK-' + new Date().getTime(),
      idSuratInduk: data.idSuratInduk || '',
      asal: data.asal || (data.idSuratInduk ? 'BALASAN' : 'MANDIRI'),
      jenisKeluar: data.jenisKeluar || '',
      nomorKeluar: data.nomorKeluar || '',
      tglKeluar: data.tglKeluar || new Date(),
      tujuan: data.tujuan || '',
      perihal: data.perihal || '',
      penandatangan: data.penandatangan || '',
      urlDokumen: data.urlDokumen || '',
      urlScan: '',
      status: data.status || 'TERCATAT'
    };

    /* BALASAN = satu catatan per induk: buat ulang → GANTIKAN yang lama */
    if (rec.asal === 'BALASAN' && rec.idSuratInduk) {
      var rows = []; try { rows = Storage.read('surat_keluar') || []; } catch (e) {}
      var existing = null;
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i].idSuratInduk) === String(rec.idSuratInduk)) { existing = rows[i]; break; }
      }
      if (existing && existing.idKeluar) {
        rec.idKeluar = existing.idKeluar;   /* upsert → baris lama diperbarui, bukan bertambah */
        /* rapikan Drive: buang dokumen lama bila diganti */
        if (existing.urlDokumen && existing.urlDokumen !== rec.urlDokumen) {
          try { Storage.deleteFileFromDrive(existing.urlDokumen); } catch (e) {}
        }
      }
    }

    var ok = Storage.save('surat_keluar', rec);
    if (ok) {
      if (rec.asal === 'BALASAN' && rec.idSuratInduk) {
        try { Ekspedisi.catat(rec.idSuratInduk, 'balasan', 'Balasan dibuat', rec.nomorKeluar || '', 'Sistem'); } catch (e) {}
      }
      return { success: true, id: rec.idKeluar,
        message: (rec.asal === 'BALASAN' ? 'Surat balasan tersimpan (catatan induk diperbarui).' : 'Surat keluar berhasil dicatat.') };
    }
    throw new Error('Gagal menyimpan ke database.');
  }
  function updateFinal(id, fileScan, user, alasan){
    var p = { status:'FINAL' };
    var hasFile = false;
    if (fileScan && typeof fileScan === 'object' && fileScan.base64) {
      try {
        var url = Storage.saveFileToDrive({ base64: fileScan.base64, fileName: fileScan.fileName, mimeType: fileScan.mimeType }, 'SK');
        if (url) { p.urlScan = url; hasFile = true; }
      } catch (e) { console.error('[SuratKeluar] saveFile gagal:', e); }
    } else if (typeof fileScan === 'string' && fileScan) {
      p.urlScan = fileScan; hasFile = true;
    }
    if (!hasFile && !(alasan || '').trim()) throw new Error('Upload scan atau isi alasan terlebih dahulu.');

    var ok = Storage.update('surat_keluar', { idKeluar:id }, p);
    if (ok) {
      var row = null, rows = []; try { rows = Storage.read('surat_keluar') || []; } catch (e) {}
      for (var i = 0; i < rows.length; i++) if (String(rows[i].idKeluar) === String(id)) { row = rows[i]; break; }
      if (row && row.idSuratInduk) {
        try {
          Ekspedisi.catat(row.idSuratInduk, 'tertanda',
            hasFile ? 'Surat tertanda diunggah (FINAL)' : 'FINAL tanpa scan',
            hasFile ? '' : ('Alasan: ' + alasan), (user && user.fullName) || 'Sistem');
        } catch (e) {}
      }
      return { success:true, message: hasFile ? 'Scan tersimpan & status FINAL.' : 'FINAL tercatat dengan alasan.' };
    }
    throw new Error('ID surat tidak ditemukan.');
  }
  function getDetail(id){ var l=getDaftar(); for(var i=0;i<l.length;i++) if(String(l[i].idKeluar)===String(id)) return l[i]; return null; }
  function hapus(id){ var ok=Storage.remove('surat_keluar',{idKeluar:id}); return ok?{success:true,message:'Surat keluar dihapus.'}:{success:false,message:'ID tidak ditemukan.'}; }

  /* ============ TEMPLATE + FLAG BALASAN + HAPUS ============ */
  function _getBalasanSet(){
    var set={}; var kats=[]; try{ kats=Storage.read('kategori_surat')||[]; }catch(e){}
    kats.forEach(function(k){ var b=k.balasanDefault||k.balasan_default||''; if(b) set[b]=true; });
    return set;
  }
  function getDaftarTemplate(){
    var jenis = getDaftarJenis(true);
    var templates=[]; try{ templates=Storage.read('template_surat')||[]; }catch(e){}
    var balasanSet = _getBalasanSet();
    return jenis.map(function(j){
      var tpl = templates.find(function(t){ return String(t.jenis)===String(j.id) && t.aktif!==false; });
      return { id:j.id, nama:j.nama, mode:j.mode, aktif:j.aktif,
        templateId: tpl?tpl.doc_id:'', namaTemplate: tpl?tpl.nama_template:'',
        siap: !!(tpl&&tpl.doc_id&&String(tpl.doc_id).length>10),
        isBalasan: !!(balasanSet[j.id]||balasanSet[j.nama]) };
    });
  }
  function simpanTemplate(jenis, templateId, namaTemplate, user){
    var guard=0; try{ while(guard<10 && Storage.find('template_surat',{jenis:jenis}).length>0){ Storage.remove('template_surat',{jenis:jenis}); guard++; } }catch(e){}
    var rec = { id_template:'TPL-'+jenis, nama_template:namaTemplate||jenis, jenis:jenis, doc_id:templateId, aktif:true, created_at:new Date() };
    var ok = Storage.save('template_surat', rec);
    if (ok) return { success:true, message:'Template '+jenis+' berhasil disimpan.' };
    throw new Error('Gagal menyimpan template.');
  }
  function hapusTemplate(jenis){
    var guard=0, removed=0;
    try{ while(guard<10 && Storage.find('template_surat',{jenis:jenis}).length>0){ Storage.remove('template_surat',{jenis:jenis}); removed++; guard++; } }catch(e){}
    return { success:true, message: removed>0?'Template dihapus.':'Tidak ada template untuk jenis ini.' };
  }

  /* ============ FIELD KEYS + SYNC PLACEHOLDER ============ */
  function getAvailableFieldKeys(){
    var base=[
      {key:'nomorKeluar',label:'Keluar: Nomor Surat'},{key:'tglKeluar',label:'Keluar: Tanggal (format otomatis)'},
      {key:'tujuan',label:'Keluar: Tujuan'},{key:'perihal',label:'Keluar: Perihal'},{key:'penandatangan',label:'Keluar: Penandatangan'},
      {key:'pemohon',label:'Keluar: Pemohon / Pengirim Induk'},{key:'jenisKeluar',label:'Keluar: Nama Jenis'}
    ];
    var masuk=[
      {key:'deskripsi',label:'Masuk: Deskripsi'},{key:'pengirim',label:'Masuk: Pengirim'},{key:'nomorSurat',label:'Masuk: Nomor Surat'},
      {key:'agendaNomor',label:'Masuk: No. Agenda'},{key:'tglSuratMasuk',label:'Masuk: Tgl Surat'},{key:'pic',label:'Masuk: PIC'},
      {key:'kontak',label:'Masuk: Kontak'},{key:'penanggungJawab',label:'Masuk: Penanggung Jawab'},
      {key:'tempatKegiatan',label:'Masuk: Tempat Kegiatan'},{key:'tglKegiatan',label:'Masuk: Tanggal Kegiatan'},{key:'waktuKegiatan',label:'Masuk: Waktu Kegiatan (WIB otomatis)'}
    ];
    var custom=[]; try{
      var sch=Storage.read('form_schema')||[]; var seen={};
      sch.forEach(function(f){ if(f.field_key&&!seen[f.field_key]){ seen[f.field_key]=true;
        var isK=String(f.id_kategori||'').indexOf(PREFIX_SCHEMA)===0;
        custom.push({key:f.field_key,label:(isK?'Form Mandiri: ':'Form Masuk: ')+(f.label||f.field_key)}); } });
    }catch(e){}
    return base.concat(masuk).concat(custom);
  }
  function syncPlaceholders(){
    var avail=getAvailableFieldKeys(); var existing=[]; try{ existing=Storage.read('placeholder_surat')||[]; }catch(e){}
    var have={}; existing.forEach(function(r){ have[String(r.fieldKey||'').toLowerCase()]=true; });
    var added=0;
    avail.forEach(function(f){
      var fk=String(f.key||''); if(!fk) return;
      if(have[fk.toLowerCase()]) return;
      var key=fk.replace(/[^a-zA-Z0-9]+/g,'_').toUpperCase();
      Storage.save('placeholder_surat', { key:key, label:f.label, fieldKey:fk, contoh:'' });
      added++;
    });
    return { success:true, message: added>0 ? (added+' placeholder baru ditambahkan.') : 'Semua placeholder sudah sinkron.' };
  }

  /* ============ GENERATE ============ */
  function generateDokumen(data, user){
    var tplList=getDaftarTemplate(); var tpl=tplList.find(function(t){ return t.id===data.jenisKeluar; });
    if(!tpl||!tpl.siap) return { success:false, message:'Template untuk jenis surat ini belum disiapkan oleh admin.' };
    var fileName=(data.nomorKeluar||'SK')+' - '+(data.perihal||'Surat Keluar');
    var result=Storage.generateDocumentFromTemplate(tpl.templateId, data, fileName);
    if(result.success) return { success:true, docId:result.docId, url:result.docUrl, message:'Dokumen berhasil dibuat dan disimpan di folder LetterCore.' };
    throw new Error(result.message||'Gagal membuat dokumen.');
  }

  return { getDaftarJenis:getDaftarJenis, simpanJenis:simpanJenis, nonaktifJenis:nonaktifJenis,
    getSchemaJenis:getSchemaJenis, simpanFieldJenis:simpanFieldJenis, hapusFieldJenis:hapusFieldJenis,
    getDaftar:getDaftar, simpan:simpan, updateFinal:updateFinal, getDetail:getDetail, hapus:hapus,
    getDaftarTemplate:getDaftarTemplate, simpanTemplate:simpanTemplate, hapusTemplate:hapusTemplate,
    getAvailableFieldKeys:getAvailableFieldKeys, syncPlaceholders:syncPlaceholders, generateDokumen:generateDokumen };
})();


/* ===== TRANSFORMASI PLACEHOLDER (ganti teks & format tanggal) ===== */
var TransformasiPH = (function(){
  'use strict';
  var BULAN = ['januari','februari','maret','april','mei','juni','juli','agustus','september','oktober','november','desember'];
  function daftar(){ return Storage.read('transformasi_placeholder') || []; }
  function simpan(p){
    var rows = daftar(); var ex = null;
    for (var i=0;i<rows.length;i++) if (String(rows[i].id_transform) === String(p.id)) { ex = rows[i]; break; }
    if (!ex) for (var j=0;j<rows.length;j++) if (String(rows[j].field_key)===String(p.fieldKey) && String(rows[j].tipe)===String(p.tipe)) { ex = rows[j]; break; }
    var rec = { id_transform: (p.id || (ex ? ex.id_transform : ('TRF-'+Date.now()))), field_key: p.fieldKey||'', tipe: p.tipe||'teks',
      cari: p.cari||'', ganti: p.ganti||'', format: p.format||'', aktif: true };
    var ok = Storage.save('transformasi_placeholder', rec);
    return ok ? { success:true, message:'Transformasi tersimpan.' } : { success:false, message:'Gagal menyimpan.' };
  }
  function hapus(id){ var ok = Storage.remove('transformasi_placeholder', { id_transform:id }); return { success:ok, message: ok?'Transformasi dihapus.':'Tidak ditemukan.' }; }
  function _parseDate(v){
    if (v instanceof Date) return v;
    var s = String(v||'').trim(); if (!s) return null;
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return new Date(+m[1], +m[2]-1, +m[3]);
    var m2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/); if (m2) return new Date(+m2[3], +m2[2]-1, +m2[1]);
    var m3 = s.toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
    if (m3) { var bi = BULAN.indexOf(m3[2]); if (bi > -1) return new Date(+m3[3], bi, +m3[1]); }
    var t = Date.parse(s); return isNaN(t) ? null : new Date(t);
  }
  function _fmt(d, pattern){
    var p = String(pattern).replace(/DD/g,'dd').replace(/YYYY/g,'yyyy');
    try { return Utilities.formatDate(d, Session.getScriptTimeZone(), p); } catch(e){ return String(d); }
  }
  function terapkan(key, fk, value){
    var ts = daftar();
    for (var i=0;i<ts.length;i++){
      var t = ts[i];
      if (t.aktif===false || t.aktif==='false') continue;
      if (String(t.field_key)!==String(fk) && String(t.field_key)!==String(key)) continue;
      if (t.tipe==='teks' && t.cari) value = String(value).split(String(t.cari)).join(String(t.ganti||''));
      if (t.tipe==='tanggal' && t.format) { var d = _parseDate(value); if (d) value = _fmt(d, t.format); }
    }
    return value;
  }
  return { daftar:daftar, simpan:simpan, hapus:hapus, terapkan:terapkan };
})();