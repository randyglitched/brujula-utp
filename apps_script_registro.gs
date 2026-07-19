/**
 * Google Apps Script — Registro agregado + Códigos de acceso de "Brújula UTP"
 *
 * COMO USARLO:
 * 1. Crea una hoja de Google Sheets nueva (ej. "Brujula UTP - Registro").
 * 2. En la hoja, ve a Extensiones > Apps Script.
 * 3. Borra el contenido de Code.gs y pega este archivo completo.
 * 4. Guarda. Luego Implementar > Nueva implementación.
 *    - Tipo: Aplicación web
 *    - Ejecutar como: Yo (tu cuenta)
 *    - Quien tiene acceso: Cualquier usuario
 * 5. Copia la URL ("URL de la aplicacion web") y pegala como SHEETS_WEBAPP_URL
 *    tanto en app_logic.js (index.html) como en las variables de entorno de Vercel.
 * 6. Para generar códigos de acceso: selecciona la función "generarTokens" en el
 *    menú desplegable de arriba del editor, y dale a "Ejecutar".
 *
 * NOTA DE PRIVACIDAD: esta hoja acumula datos personales (correos, si los dejan).
 * Compártela solo con quien realmente necesite verla.
 */

// ---------- REGISTRO DE RESULTADOS ----------
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
    "marca_tiempo", "correo", "carrera_actual_id", "puesto_carrera_actual",
    "mejor_match_id", "mejor_match_nombre", "score_mejor_match", "respuesta_uniforme",
  ]);
  hoja.getRange(1, 1, 1, 8).setFontWeight("bold");
  return hoja;
}

// ---------- CÓDIGOS DE ACCESO ----------
// Consultado via GET desde nuestras funciones serverless de Vercel (no directo
// desde el navegador), asi que no hace falta manejar CORS aqui.
function doGet(e) {
  const accion = (e.parameter.action || "").toLowerCase();
  const token = (e.parameter.token || "").trim().toUpperCase();

  if (!token) return jsonOut({ valido: false, motivo: "falta_token" });

  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Tokens") || crearHojaTokens();
  const datos = hoja.getDataRange().getValues();

  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][0]).trim().toUpperCase() === token) {
      const expira = new Date(datos[i][1]);
      const usado = datos[i][2] === true || datos[i][2] === "TRUE";

      if (new Date() > expira) return jsonOut({ valido: false, motivo: "expirado" });

      if (accion === "iniciar") {
        if (usado) return jsonOut({ valido: false, motivo: "ya_usado" });
        hoja.getRange(i + 1, 3).setValue(true);
        hoja.getRange(i + 1, 4).setValue(new Date().toISOString());
        return jsonOut({ valido: true });
      }

      if (accion === "verificar") {
        return jsonOut({ valido: true });
      }

      return jsonOut({ valido: false, motivo: "accion_desconocida" });
    }
  }

  return jsonOut({ valido: false, motivo: "no_existe" });
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function crearHojaTokens() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.insertSheet("Tokens");
  hoja.appendRow(["token", "expira", "usado", "usado_en"]);
  hoja.getRange(1, 1, 1, 4).setFontWeight("bold");
  return hoja;
}

/**
 * EJECUTAR MANUALMENTE desde el editor para generar un lote de códigos nuevos:
 * 1. Ajusta CANTIDAD y HORAS_VALIDEZ abajo.
 * 2. Selecciona "generarTokens" en el menú desplegable de arriba del editor.
 * 3. Clic en "Ejecutar" (▶). La primera vez pide autorizar permisos, es normal.
 * 4. Revisa la hoja "Tokens" — ahí aparecen los códigos nuevos, listos para repartir.
 */
function generarTokens() {
  const CANTIDAD = 30;
  const HORAS_VALIDEZ = 72;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName("Tokens") || crearHojaTokens();
  const expira = new Date(Date.now() + HORAS_VALIDEZ * 60 * 60 * 1000);

  const filas = [];
  for (let i = 0; i < CANTIDAD; i++) {
    filas.push([generarCodigo(), expira.toISOString(), false, ""]);
  }
  hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, 4).setValues(filas);
  Logger.log(`Se generaron ${CANTIDAD} codigos, validos por ${HORAS_VALIDEZ} horas (hasta ${expira.toISOString()}).`);
}

function generarCodigo() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I, para evitar confusiones
  let codigo = "";
  for (let i = 0; i < 6; i++) codigo += chars.charAt(Math.floor(Math.random() * chars.length));
  return codigo;
}
