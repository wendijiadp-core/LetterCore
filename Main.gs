/**
 * ============================================================================
 * LETTERCORE - MAIN ENTRY POINT
 * ============================================================================
 * File: Main.gs
 * UPDATE: Tambah logic bypass SSO untuk development
 * ============================================================================
 */

/**
 * Entry point GET
 */
function doGet(e) {
  var access;

  // ==========================================
  // CEK BYPASS SSO (DEVELOPER MODE)
  // ==========================================
  if (typeof ConfigService !== 'undefined' && ConfigService.isBypassSSO()) {
    // BYPASS AKTIF: Gunakan mock user
    console.warn('[Main] ⚠️ BYPASS SSO AKTIF - Menggunakan mock user untuk development');
    
    access = {
      valid: true,
      user: ConfigService.getMockUser(),
      message: 'Developer mode aktif (SSO bypass)',
      isFromSession: false,
      isDevBypass: true  // Flag khusus untuk UI indicator
    };
  } else {
    // BYPASS MATI: Validasi SSO normal
    access = validateAccess(e);
  }

  // ==========================================
  // RENDER HALAMAN
  // ==========================================
  if (!access.valid) {
    return showAccessDeniedPage(access.message);
  }

  try {
    var template = HtmlService.createTemplateFromFile('Index');
    
    // Inject data user ke template
    template.currentUser = access.user;
    template.launcherUrl = (typeof ConfigService !== 'undefined') ? ConfigService.get('LAUNCHER_PORTAL_URL') : '';
    template.isFromSession = access.isFromSession || false;
    template.isDevBypass = access.isDevBypass || false;  // Inject flag dev bypass ke UI
    
    return template.evaluate()
      .setTitle('Letter Core — Sistem Persuratan')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
      
  } catch (err) {
    console.error('[Main] Error rendering:', err);
    return HtmlService.createHtmlOutput('<h2>Error Loading App</h2><p>' + err.message + '</p>');
  }
}

/**
 * Entry point POST (Untuk API Layer - Persiapan Fase 4)
 */
function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action || '';
    
    if (typeof this[action] === 'function') {
      var result = this[action](params);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Action not found: ' + action }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Server Error: ' + err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Helper Include File HTML
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}