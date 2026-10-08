
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Browser- und Verbindungstest
    if (request.method === "GET" && url.pathname === "/") {
      return json({
        success: true,
        reply: "VYRA AI Worker läuft!",
        endpoint: "/chat"
      });
    }

    // Nur der Chat-Endpunkt verarbeitet KI-Anfragen
    if (url.pathname !== "/chat") {
      return json({
        success: false,
        error: "Route nicht gefunden."
      }, 404);
    }

    if (request.method !== "POST") {
      return json({
        success: false,
        error: "Bitte POST verwenden."
      }, 405);
    }

    if (!env.GEMINI_API_KEY) {
      return json({
        success: false,
        error: "GEMINI_API_KEY fehlt in Cloudflare."
      }, 500);
    }

    try {
      const form = await request.formData();

      const message = form.get("message");
      const prompt = form.get("prompt");

      if (typeof message !== "string" || !message.trim()) {
        return json({
          success: false,
          error: "Das Feld message fehlt."
        }, 400);
      }

      if (typeof prompt !== "string" || !prompt.trim()) {
        return json({
          success: false,
          error: "Das Feld prompt fehlt."
        }, 400);
      }

      if (message.length > 2000 || prompt.length > 5000) {
        return json({
          success: false,
          error: "Die Nachricht oder der Prompt ist zu lang."
        }, 400);
      }

      const geminiResponse = await fetch(
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
              maxOutputTokens: 250
            }
          })
        }
      );

      const rawResponse = await geminiResponse.text();

      let data;

      try {
        data = JSON.parse(rawResponse);
      } catch {
        console.error(
          "Gemini lieferte ungültiges JSON. HTTP:",
          geminiResponse.status
        );

        return json({
          success: false,
          error: "Ungültige Antwort von Gemini."
        }, 502);
      }

      if (!geminiResponse.ok) {
        console.error(
          "Gemini API Fehler:",
          geminiResponse.status,
          data.error?.message || "Keine Fehlerbeschreibung"
        );

        return json({
          success: false,
          error: data.error?.message || "Gemini-Anfrage fehlgeschlagen.",
          status: geminiResponse.status
        }, 502);
      }

      const reply = data.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

      if (!reply) {
        console.error(
          "Gemini lieferte keinen Antworttext.",
          data.promptFeedback || data.candidates
        );

        return json({
          success: false,
          error: "Gemini hat keinen Antworttext geliefert."
        }, 502);
      }

      return json({
        success: true,
        reply: reply
      });

    } catch (error) {
      console.error(
        "Worker-Fehler:",
        error?.name || "Error",
        error?.message || "Unbekannter Fehler"
      );

      return json({
        success: false,
        error: "Der Worker konnte die Anfrage nicht verarbeiten."
      }, 500);
    }
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store"
    }
  });
}
