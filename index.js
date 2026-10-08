
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Nur /chat erlauben
    if (url.pathname !== "/chat") {
      return json({ success: false, error: "Route nicht gefunden." }, 404);
    }

    // Nur POST erlauben
    if (request.method !== "POST") {
      return json({ success: false, error: "POST erforderlich." }, 405);
    }

    // API-Key prüfen
    if (!env.GEMINI_API_KEY) {
      return json({
        success: false,
        error: "GEMINI_API_KEY fehlt in Cloudflare."
      }, 500);
    }

    try {
      // Formulardaten von BDFD lesen
      const form = await request.formData();

      const message = form.get("message");
      const prompt = form.get("prompt");

      if (typeof message !== "string" || !message.trim()) {
        return json({
          success: false,
          error: "Die Nachricht fehlt."
        }, 400);
      }

      if (typeof prompt !== "string" || !prompt.trim()) {
        return json({
          success: false,
          error: "Der System-Prompt fehlt."
        }, 400);
      }

      if (message.length > 2000 || prompt.length > 5000) {
        return json({
          success: false,
          error: "Nachricht oder Prompt ist zu lang."
        }, 400);
      }

      // Anfrage an Gemini senden
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: prompt.trim() }]
            },
            contents: [{
              role: "user",
              parts: [{ text: message.trim() }]
            }],
            generationConfig: {
              maxOutputTokens: 800
            }
          })
        }
      );

      // Gemini-Antwort lesen
      const result = await response.json();

      if (!response.ok) {
        console.error("Gemini API Fehler:", result);

        return json({
          success: false,
          error: "Gemini API Anfrage fehlgeschlagen.",
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
          error: "Gemini hat keinen Antworttext geliefert."
        }, 502);
      }

      // Antwort an BDFD zurückgeben
      return json({
        success: true,
        reply: reply
      });

    } catch (error) {
      console.error("Worker Fehler:", error);

      return json({
        success: false,
        error: "Interner Worker-Fehler."
      }, 500);
    }
  }
};

// JSON-Antwort senden
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8"
    }
  });
}
