// api/analizar.js
// Funcion serverless de Vercel. Recibe el prompt desde el frontend,
// llama a la API de Anthropic usando la API key guardada como variable
// de entorno (nunca visible en el navegador), y devuelve la respuesta.
//
// Configuracion necesaria en Vercel:
//   Project Settings -> Environment Variables -> ANTHROPIC_API_KEY = tu-api-key

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Falta configurar ANTHROPIC_API_KEY en las variables de entorno de Vercel",
    });
  }

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Falta el campo 'prompt' en el body" });
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
