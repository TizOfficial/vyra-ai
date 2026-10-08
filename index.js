
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/" && request.method === "GET") {
      return Response.json({ success: true, status: "Worker online" });
    }

    if (url.pathname !== "/chat") {
      return Response.json({ success: false, error: "Route nicht gefunden" }, { status: 404 });
    }

    if (request.method !== "POST") {
      return Response.json({ success: false, error: "POST erforderlich" }, { status: 405 });
    }

    if (!env.GEMINI_API_KEY) {
      return Response.json({ success: false, error: "GEMINI_API_KEY fehlt" }, { status: 500 });
    }

    try {
      const form = await request.formData();
      const message = form.get("message");
      const prompt = form.get("prompt");

      if (typeof message !== "string" || !message.trim() ||
          typeof prompt !== "string" || !prompt.trim()) {
        return Response.json({
          success: false,
          error: "message oder prompt fehlt"
        }, { status: 400 });
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
              parts: [{ text: message.slice(0, 2000) }]
            }],
            generationConfig: { maxOutputTokens: 300 }
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("Gemini API Fehler:", response.status, data.error?.message);
        return Response.json({
          success: false,
          error: data.error?.message || "Gemini-Anfrage fehlgeschlagen",
          status: response.status
        }, { status: 502 });
      }

      const reply = data.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

      if (!reply) {
        return Response.json({
          success: false,
          error: "Gemini hat keinen Antworttext geliefert"
        }, { status: 502 });
      }

      return Response.json({ success: true, reply });

    } catch (error) {
      console.error("Worker Fehler:", error.message);
      return Response.json({
        success: false,
        error: "Interner Worker-Fehler"
      }, { status: 500 });
    }
  }
};
