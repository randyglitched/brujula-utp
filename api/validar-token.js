// api/validar-token.js
// Valida un codigo de acceso contra la hoja "Tokens" en Google Sheets, via Apps Script.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
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
