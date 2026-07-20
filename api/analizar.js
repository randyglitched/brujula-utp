// api/analizar.js
// Funcion serverless de Vercel. Recibe el prompt desde el frontend,
// llama a la API de Anthropic usando la API key guardada como variable
// de entorno (nunca visible en el navegador), y devuelve la respuesta.
//
// Configuracion necesaria en Vercel:
//   Project Settings -> Environment Variables -> ANTHROPIC_API_KEY = tu-api-key

// Limitador simple en memoria: mientras la funcion se mantenga "caliente" (mismo
// contenedor reciclado por Vercel entre invocaciones), acumula conteos por IP.
// No es a prueba de balas (Vercel puede levantar varios contenedores en paralelo,
// y cada uno tiene su propio conteo), pero frena el abuso casual/automatizado
// mucho mejor que no tener nada.
const conteoPorIP = new Map();
const LIMITE_POR_HORA = 20;
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

// Compara el origen exacto (o el origen + "/" para el caso de Referer, que
// incluye path). Un startsWith() ingenuo aqui es evadible: un atacante dueno
// de "attacker.com" puede crear el subdominio "brujula-utp.vercel.app.attacker.com",
// cuyo Origin SI pasaria un startsWith(permitido) aunque sea un sitio distinto.
function origenValido(origenHeader, permitido) {
  if (!permitido) return true;
  if (!origenHeader) return false;
  return origenHeader === permitido || origenHeader.startsWith(`${permitido}/`);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  // Solo aceptar solicitudes que vengan del propio sitio, no de scripts externos
  // apuntando directo al endpoint.
  const origin = req.headers.origin || req.headers.referer || "";
  const origenPermitido = process.env.SITIO_PERMITIDO || ""; // ej: https://brujula-utp.vercel.app
  if (!origenValido(origin, origenPermitido)) {
    return res.status(403).json({ error: "Origen no permitido" });
  }

  const ip = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "desconocida").split(",")[0].trim();
  if (!permitirSolicitud(ip)) {
    return res.status(429).json({ error: "Demasiadas solicitudes, intenta más tarde" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Falta configurar ANTHROPIC_API_KEY en las variables de entorno de Vercel",
    });
  }

  const { prompt, token } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Falta el campo 'prompt' en el body" });
  }
  // Limite defensivo de tamano: el prompt legitimo de este proyecto no pasa de
  // ~2000 caracteres. Cualquier cosa mucho mayor es sospechosa de abuso.
  if (prompt.length > 4000) {
    return res.status(400).json({ error: "Prompt demasiado largo" });
  }

  const sheetsUrl = process.env.SHEETS_WEBAPP_URL;
  if (sheetsUrl) {
    if (!token || typeof token !== "string") {
      return res.status(401).json({ error: "Falta código de acceso" });
    }
    try {
      const verifUrl = `${sheetsUrl}?action=verificar&token=${encodeURIComponent(token.trim())}`;
      const verifRes = await fetch(verifUrl);
      const verifData = await verifRes.json();
      if (!verifData.valido) {
        return res.status(403).json({ error: "Código de acceso inválido o expirado" });
      }
    } catch (e) {
      return res.status(500).json({ error: "No se pudo verificar el código de acceso" });
    }
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(response.status).json({ error: "Error de la API de Anthropic", detalle: errorBody });
    }

    const data = await response.json();
    const texto = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return res.status(200).json({ texto });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
