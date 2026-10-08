
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Verbindungstest im Browser
    if (url.pathname === "/" && request.method === "GET") {
      return Response.json({
        success: true,
        reply: "VYRA AI Worker läuft!"
      });
    }

    if (url.pathname !== "/chat") {
      return Response.json({
        success: false,
        error: "Route nicht gefunden."
      }, { status: 404 });
    }

    if (request.method !== "POST") {
      return Response.json({
        success: false,
        error: "POST erforderlich."
      }, { status: 405 });
    }

    // Prüfen, ob Workers AI verbunden ist
    if (!env.AI) {
      return Response.json({
        success: false,
        error: "AI-Binding fehlt. Bitte Workers AI verbinden."
      }, { status: 500 });
    }

    try {
      const form = await request.formData();
      const message = form.get("message");
      const prompt = form.get("prompt");

      if (typeof message !== "string" || !message.trim()) {
        return Response.json({
          success: false,
          error: "Nachricht fehlt."
        }, { status: 400 });
      }

      if (typeof prompt !== "string" || !prompt.trim()) {
        return Response.json({
          success: false,
          error: "System-Prompt fehlt."
        }, { status: 400 });
      }

      const result = await env.AI.run(
        "@cf/meta/llama-3.2-3b-instruct",
        {
          messages: [
            {
              role: "system",
              content: prompt.slice(0, 5000)
            },
            {
              role: "user",
              content: message.slice(0, 2000)
            }
          ],
          max_tokens: 300
        }
      );

      const reply = result?.response?.trim();

      if (!reply) {
        console.error("Workers AI lieferte keine Antwort.");
        return Response.json({
          success: false,
          error: "Das Modell hat keinen Antworttext geliefert."
        }, { status: 502 });
      }

      return Response.json({
        success: true,
        reply
      });

    } catch (error) {
      console.error(
        "Workers AI Fehler:",
        error?.message || String(error)
      );

      return Response.json({
        success: false,
        error: error?.message || "Unbekannter Workers-AI-Fehler."
      }, { status: 500 });
    }
  }
};
