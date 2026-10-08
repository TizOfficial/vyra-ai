
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== "/chat") {
      return json({ success: false, error: "Route nicht gefunden" }, 404);
    }

    if (request.method !== "POST") {
      return json({ success: false, error: "POST erforderlich" }, 405);
    }

    if (!env.GEMINI_API_KEY) {
      return json({ success: false, error: "API-Key fehlt" }, 500);
    }

    try {
      const form = await request.formData();
      const message = form.get("message");
      const prompt = form.get("prompt");

      if (typeof message !== "string" || !message.trim()) {
        return json({ success: false, error: "Nachricht fehlt" }, 400);
      }

      if (typeof prompt !== "string" || !prompt.trim()) {
        return json({ success: false, error: "Prompt fehlt" }, 400);
      }

      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: prompt.slice(0, 5000) }]
            },
            contents: [{
              role: "user",
              parts: [{ text: message.slice(0, 1500) }]
            }],
            generationConfig: {
              maxOutputTokens: 250
            }
          }),
          signal: AbortSignal.timeout(12000)
        }
      );

      const result = await response.json();

      if (!response.ok) {
  console.error("Gemini API Fehler:", response.status, result);

  return json({
    success: false,
    error: result.error?.message || "Unbekannter Gemini-Fehler",
    status: response.status
  }, 502);
      }

      const reply = result.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

      if (!reply) {
        return json({
          success: false,
          error: "Gemini hat keinen Antworttext geliefert"
        }, 502);
      }

      return json({ success: true, reply });
} catch (error) {
  console.error("Worker Fehler:", error);

  return json({
    success: false,
    error: error.message || "Unbekannter Worker-Fehler"
  }, 500);
    }
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8"
    }
  });
}
