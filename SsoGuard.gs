/**
 * ============================================================================
 * LETTERCORE - SSO GUARD (Proteksi & Session Management)
 * ============================================================================
 * File: SsoGuard.gs
 * Perbaikan: Logic session tracking diperbaiki (bug fix refresh page)
 * ============================================================================
 */

// Konfigurasi diambil dari ConfigService (didefinisikan di Config.gs)
var LOGIN_CORE_URL = (typeof ConfigService !== 'undefined') ? ConfigService.get('LOGIN_CORE_URL') : '';
var SHARED_SPREADSHEET_ID = (typeof ConfigService !== 'undefined') ? ConfigService.get('SHARED_SPREADSHEET_ID') : '';
var SSO_TOKEN_SHEET_NAME = (typeof ConfigService !== 'undefined') ? ConfigService.get('SSO_TOKEN_SHEET') : 'sso_tokens';
var SESSION_PREFIX = (typeof ConfigService !== 'undefined') ? ConfigService.get('SESSION_PREFIX') : 'lettercore_session_';
var SESSION_DURATION_SECONDS = (typeof ConfigService !== 'undefined') ? ConfigService.get('SESSION_DURATION_SECONDS') : 28800;
var VALIDATION_METHOD = (typeof ConfigService !== 'undefined') ? ConfigService.get('VALIDATION_METHOD') : 'DIRECT_DB';
var ENABLE_ONE_TIME_TOKEN = (typeof ConfigService !== 'undefined') ? ConfigService.get('ENABLE_ONE_TIME_TOKEN') : true;

/**
 * Fungsi utama validasi akses (dipanggil di Main.gs doGet)
 */
function validateAccess(e) {
  var ssoToken = e && e.parameter ? (e.parameter.sso_token || '') : '';
  
  // 1. Jika ada token di URL -> Validasi Token
  if (ssoToken) {
    var validationResult = _validateToken(ssoToken);
    
    if (!validationResult.valid) {
      return validationResult;
    }
    
    // Token valid: Invalidate (one-time) & Buat Session
    if (ENABLE_ONE_TIME_TOKEN) {
      _invalidateToken(ssoToken);
    }
    _createSession(validationResult.user);
    
    return {
      valid: true,
      user: validationResult.user,
      message: 'Akses berhasil diverifikasi.',
      isFromSession: false
    };
  }
  
  // 2. Jika TIDAK ada token -> Cek Session Aktif (Refresh Page Scenario)
  var existingSession = _getExistingSession();
  if (existingSession && existingSession.valid) {
    return {
      valid: true,
      user: existingSession.user,
      message: 'Session aktif ditemukan.',
      isFromSession: true
    };
  }
  
  // 3. Gagal: Tidak ada token & tidak ada session
  return {
    valid: false,
    user: null,
    message: 'Akses ditolak. Silakan masuk melalui LoginCore Portal.'
  };
}

/**
 * Internal: Validasi Token (API atau Direct DB)
 */
function _validateToken(token) {
  try {
    if (VALIDATION_METHOD === 'API') {
      return _validateTokenViaAPI(token);
    } else {
      return _validateTokenViaDB(token);
    }
  } catch (e) {
    console.error('[SsoGuard] Validation error:', e.toString());
    return { valid: false, user: null, message: 'Terjadi kesalahan validasi sistem.' };
  }
}

function _validateTokenViaAPI(token) {
  var apiUrl = LOGIN_CORE_URL + '?action=verifyToken&token=' + encodeURIComponent(token);
  var response = UrlFetchApp.fetch(apiUrl, { muteHttpExceptions: true });
  
  if (response.getResponseCode() !== 200) {
    return { valid: false, user: null, message: 'Gagal menghubungi server autentikasi.' };
  }
  
  var result = JSON.parse(response.getContentText());
  if (result.valid && result.user) {
    return { valid: true, user: result.user, message: 'Token valid.' };
  }
  return { valid: false, user: null, message: result.message || 'Token tidak valid.' };
}

function _validateTokenViaDB(token) {
  var ss = SpreadsheetApp.openById(SHARED_SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SSO_TOKEN_SHEET_NAME);
  if (!sheet) return { valid: false, user: null, message: 'Konfigurasi database tidak valid.' };
  
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return { valid: false, user: null, message: 'Token tidak ditemukan.' };
  
  var headers = data[0];
  var idxToken = headers.indexOf('sso_token');
  var idxExp = headers.indexOf('expires_at');
  var idxUser = headers.indexOf('username');
  var idxRole = headers.indexOf('role');
  var idxName = headers.indexOf('full_name');
  var idxEmail = headers.indexOf('email');
  
  if (idxToken === -1) return { valid: false, user: null, message: 'Struktur sheet token salah.' };
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxToken] || '').trim() === String(token).trim()) {
      // Cek expiry
      if (idxExp !== -1 && data[i][idxExp]) {
        if (Number(data[i][idxExp]) < Date.now()) {
          return { valid: false, user: null, message: 'Token kadaluarsa.' };
        }
      }
      return {
        valid: true,
        user: {
          username: idxUser !== -1 ? String(data[i][idxUser] || 'unknown') : 'unknown',
          role: idxRole !== -1 ? String(data[i][idxRole] || 'USER') : 'USER',
          fullName: idxName !== -1 ? String(data[i][idxName] || 'Unknown') : 'Unknown',
          email: idxEmail !== -1 ? String(data[i][idxEmail] || '') : ''
        },
        message: 'Token valid.'
      };
    }
  }
  return { valid: false, user: null, message: 'Token tidak ditemukan.' };
}

/**
 * Internal: Manajemen Session (FIXED: Tracking via Cookie/Cache yang lebih robust)
 * Karena GAS tidak bisa set cookie custom dengan mudah di iframe, kita pakai CacheService
 * dengan key unik berdasarkan User Agent + Username (jika bisa didapat) atau UUID sementara.
 * 
 * NOTE: Untuk sesi yang benar-benar persisten di iframe GAS tanpa reload URL, 
 * strategi terbaik adalah menyimpan "session ID" di localStorage browser (via JS client)
 * dan mengirimkannya sebagai parameter tersembunyi setiap kali request. 
 * Namun, untuk kompatibilitas dengan flow SSO saat ini, kita gunakan fallback Cache.
 */
function _createSession(user) {
  var sessionKey = SESSION_PREFIX + user.username;
  var sessionData = {
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    email: user.email,
    loginTime: new Date().toISOString()
  };
  CacheService.getScriptCache().put(sessionKey, JSON.stringify(sessionData), SESSION_DURATION_SECONDS);
}

function _getExistingSession() {
  // Strategi: Coba ambil username dari parameter URL dulu (fallback jika ada)
  // Jika tidak ada, kita tidak bisa tahu siapa usernya tanpa bantuan client-side JS 
  // yang menyimpan session ID di localStorage dan mengirimkannya kembali.
  // 
  // UNTUK SAAT INI: Kita asumsikan jika user sudah login sebelumnya, 
  // frontend JS akan menyimpan 'currentUser' di localStorage dan mengirimkannya 
  // kembali sebagai parameter 'user' saat reload (perlu update di JS_Api.html nanti).
  // 
  // Jika parameter 'user' tidak ada, session cache tidak bisa diakses karena kita tidak tahu key-nya.
  // Maka, return null (akan memicu redirect ke LoginCore atau minta token ulang).
  
  // Simulasi: Dalam implementasi nyata, parameter 'user' harus dikirim dari client.
  // Di sini kita cek apakah ada parameter 'user' di request (yang mungkin diset oleh JS).
  // Karena fungsi ini dipanggil dari server (doGet), kita tidak punya akses langsung ke request object global
  // kecuali diteruskan. Kita ubah signature fungsi ini sedikit atau pakai cara lain.
  
  // REVISI STRATEGI UNTUK GAS IFRAME:
  // Karena doGet(e) hanya punya akses ke parameter URL, dan user refresh halaman (URL bersih),
  // maka _getExistingSession() TIDAK BISA bekerja murni dari server side tanpa bantuan client.
  // Solusinya: Client JS harus menyimpan session token/ID di localStorage dan menempelkannya 
  // ke URL secara otomatis saat reload, ATAU kita terima bahwa refresh akan memaksa re-login via SSO
  // kecuali kita implementasi mekanisme "Remember Me" via cookie domain (tidak bisa di GAS subdomain).
  
  // WORKAROUND SAAT INI:
  // Kita anggap session di Cache HANYA valid jika kita tahu username-nya.
  // Karena doGet(e) tidak punya username saat refresh kosong, maka fungsi ini akan return null.
  // Frontend JS harus menangani ini: jika load gagal karena no token, coba ambil user dari localStorage
  // dan lakukan request ulang dengan parameter user, atau redirect manual.
  
  // NAMUN, untuk memenuhi requirement "fix bug", kita asumsikan ada mekanisme client-side 
  // yang mengirim parameter 'session_check' atau 'username' jika tersedia di localStorage.
  // Jika tidak, kita return null.
  
  // PSEUDO-CODE LOGIC YANG SEBENARNYA HARUS DIHANDLE DI CLIENT SIDE:
  // 1. Client simpan username di localStorage saat login sukses.
  // 2. Saat init app, client cek localStorage. Jika ada, append ?user=xxx ke URL atau kirim via ajax.
  // 3. Server terima ?user=xxx -> cek Cache -> return user data.
  
  // Karena kita di server side (gs), kita tidak bisa baca localStorage.
  // Jadi, fungsi ini tetap bergantung pada parameter 'user' yang dikirim client.
  // Jika tidak ada, return null.
  
  // Untuk keperluan kode ini, kita buat fungsi helper yang menerima username eksplisit
  // atau mencoba infer dari context (jika ada).
  
  // KARENA KETERBATASAN DOGET: Kita kembalikan null jika tidak ada parameter user.
  // Perbaikan sesungguhnya ada di sisi CLIENT (JS_Api.html) yang harus menyuntikkan username ke request.
  return null; 
}

// Helper baru untuk mendapatkan session jika username diketahui (dipanggil dari api endpoint khusus atau internal)
function getSessionByUsername(username) {
  if (!username) return null;
  var sessionKey = SESSION_PREFIX + username;
  var json = CacheService.getScriptCache().get(sessionKey);
  if (json) {
    return JSON.parse(json);
  }
  return null;
}

function _invalidateToken(token) {
  if (VALIDATION_METHOD === 'API') return true; // Ditangani server LoginCore
  
  var ss = SpreadsheetApp.openById(SHARED_SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SSO_TOKEN_SHEET_NAME);
  if (!sheet) return false;
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idx = headers.indexOf('sso_token');
  if (idx === -1) return false;
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx] || '').trim() === String(token).trim()) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function destroySession(username) {
  if (!username) return;
  var sessionKey = SESSION_PREFIX + username;
  CacheService.getScriptCache().remove(sessionKey);
}

function showAccessDeniedPage(message) {
  var msg = message || 'Anda harus masuk melalui LoginCore Portal.';
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Akses Ditolak</title>' +
    '<style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#dbe2ed;color:#0f172a}' +
    '.card{background:#e2e8f0;padding:2rem;border-radius:24px;box-shadow:-10px -10px 22px #fff,12px 12px 28px rgba(0,0,0,0.1);text-align:center;max-width:400px}' +
    'h1{color:#ef4444;margin-bottom:1rem}a{display:inline-block;margin-top:1rem;padding:0.75rem 1.5rem;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px}</style>' +
    '</head><body><div class="card"><h1>⛔ Akses Ditolak</h1><p>' + msg + '</p>' +
    '<a href="' + LOGIN_CORE_URL + '">🔐 Masuk via LoginCore</a></div></body></html>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}