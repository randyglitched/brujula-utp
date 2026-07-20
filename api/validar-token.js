// api/validar-token.js
// Valida un codigo de acceso contra la hoja "Tokens" en Google Sheets, via Apps Script.

// Mismas protecciones que api/analizar.js: rate limiting en memoria por IP y
// chequeo de origen exacto. Este endpoint no las tenia, dejandolo abierto a
// automatizar solicitudes sin limite (riesgo de agotar la cuota gratuita de
// Vercel/Apps Script, que es un objetivo explicito del proyecto).
const conteoPorIP = new Map();
const LIMITE_POR_HORA = 30;
const VENTANA_MS = 60 * 60 * 1000;

function permitirSolicitud(ip) {
  const ahora = Date.now();
  const registro = conteoPorIP.get(ip);
  if (!registro || ahora - registro.inicio > VENTANA_MS) {
    conteoPorIP.set(ip, { inicio: ahora, conteo: 1 });
    return true;
  }
  if (registro.conteo >= LIMITE_POR_HORA) return false;
  registro.conteo += 1;
  return true;
}

function origenValido(origenHeader, permitido) {
  if (!permitido) return true;
  if (!origenHeader) return false;
  return origenHeader === permitido || origenHeader.startsWith(`${permitido}/`);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const origin = req.headers.origin || req.headers.referer || "";
  const origenPermitido = process.env.SITIO_PERMITIDO || "";
  if (!origenValido(origin, origenPermitido)) {
    return res.status(403).json({ valido: false, motivo: "origen_no_permitido" });
  }

  const ip = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "desconocida").split(",")[0].trim();
  if (!permitirSolicitud(ip)) {
    return res.status(429).json({ valido: false, motivo: "demasiadas_solicitudes" });
  }

  const sheetsUrl = process.env.SHEETS_WEBAPP_URL;
  if (!sheetsUrl) {
    return res.status(500).json({ valido: false, motivo: "SHEETS_WEBAPP_URL no configurada en Vercel" });
  }

  const { token } = req.body || {};
  if (!token || typeof token !== "string") {
    return res.status(400).json({ valido: false, motivo: "falta_token" });
  }

  try {
    const url = `${sheetsUrl}?action=iniciar&token=${encodeURIComponent(token.trim())}`;
    const respuesta = await fetch(url);
    const datos = await respuesta.json();
    return res.status(200).json(datos);
  } catch (e) {
    return res.status(500).json({ valido: false, motivo: "error_de_conexion", detalle: e.message });
  }
}
