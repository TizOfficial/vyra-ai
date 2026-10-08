
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Nur die Route /chat erlauben
    if (url.pathname !== "/chat") {
      return antwort({
        success: false,
        error: "Diese Seite gibt es nicht."
      }, 404);
    }

    // Nur POST-Anfragen erlauben
    if (request.method !== "POST") {
      return antwort({
        success: false,
        error: "Nur POST ist erlaubt."
      }, 405);
    }

    try {
      // Formulardaten von BDFD auslesen
      const daten = await request.formData();

      const message = daten.get("message");
      const prompt = daten.get("prompt");

      // Prüfen, ob Nachricht und Prompt vorhanden sind
      if (
        typeof message !== "string" ||
        message.trim() === ""
      ) {
        return antwort({
          success: false,
          error: "Keine Nachricht angegeben."
        }, 400);
      }

      if (
        typeof prompt !== "string" ||
        prompt.trim() === ""
      ) {
        return antwort({
          success: false,
          error: "Der System-Prompt fehlt."
        }, 400);
      }

      const frage = message.trim();
      const systemPrompt = prompt.trim();

      // Eingaben begrenzen
      if (frage.length > 2000) {
        return antwort({
          success: false,
          error: "Die Nachricht ist zu lang."
        }, 400);
      }

      if (systemPrompt.length > 5000) {
        return antwort({
          success: false,
          error: "Der System-Prompt ist zu lang."
        }, 400);
      }

      // Prüfen, ob die AI-Bindung eingerichtet ist
      if (!env.AI) {
        return antwort({
          success: false,
          error: "Die AI-Bindung fehlt."
        }, 500);
      }

      // KI mit dem BDFD-Prompt und der Nachricht aufrufen
      const ergebnis = await env.AI.run(
        "@cf/meta/llama-3.1-8b-instruct-fast",
        {
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: frage
            }
          ],
          max_tokens: 800
        }
      );

      // Antwort der KI auslesen
      const antwortText = ergebnis?.response;

      if (
        typeof antwortText !== "string" ||
        antwortText.trim() === ""
      ) {
        return antwort({
          success: false,
          error: "Die KI hat keine Antwort geliefert."
        }, 500);
      }

      // Antwort an BDFD zurückgeben
      return antwort({
        success: true,
        reply: antwortText
      });

    } catch (fehler) {
      console.error("VYRA AI Fehler:", fehler);

      return antwort({
        success: false,
        error: "Die KI-Anfrage ist fehlgeschlagen."
      }, 500);
    }
  }
};

// Einheitliches JSON-Format für Antworten
function antwort(daten, status = 200) {
  return new Response(JSON.stringify(daten), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8"
    }
  });
}
