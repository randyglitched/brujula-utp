/**
 * Google Apps Script — Registro agregado de "Brújula UTP"
 *
 * COMO USARLO:
 * 1. Crea una hoja de Google Sheets nueva (ej. "Brujula UTP - Registro").
 * 2. En la hoja, ve a Extensiones > Apps Script.
 * 3. Borra el contenido de Code.gs y pega este archivo completo.
 * 4. Guarda. Luego Implementar > Nueva implementación.
 *    - Tipo: Aplicación web
 *    - Ejecutar como: Yo (tu cuenta)
 *    - Quien tiene acceso: Cualquier usuario (necesario para que el navegador del estudiante pueda escribir)
 * 5. Copia la URL que te da ("URL de la aplicacion web") y pegala como valor de
 *    SHEETS_WEBAPP_URL en app_logic.js (dentro de index.html), reemplazando el string vacio "".
 * 6. Cada vez que un estudiante acepte el consentimiento de estadisticas, se agrega una fila aqui.
 *
 * NOTA DE PRIVACIDAD: esta hoja va a acumular datos personales (correos, si los dejan).
 * Compartela solo con quien realmente necesite verla (orientacion academica), no la hagas publica.
 */

function doPost(e) {
  try {
    const datos = JSON.parse(e.postData.contents);
    const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Registros") || crearHojaConEncabezados();

    hoja.appendRow([
      datos.marca_tiempo || new Date().toISOString(),
      datos.correo || "",
      datos.carrera_actual_id || "",
      datos.puesto_carrera_actual || "",
      datos.mejor_match_id || "",
      datos.mejor_match_nombre || "",
      datos.score_mejor_match || "",
      datos.respuesta_uniforme ? "SI" : "NO",
    ]);

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function crearHojaConEncabezados() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.insertSheet("Registros");
  hoja.appendRow([
    "marca_tiempo",
    "correo",
    "carrera_actual_id",
    "puesto_carrera_actual",
    "mejor_match_id",
    "mejor_match_nombre",
    "score_mejor_match",
    "respuesta_uniforme",
  ]);
  hoja.getRange(1, 1, 1, 8).setFontWeight("bold");
  return hoja;
}
