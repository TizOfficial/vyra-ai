
export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8",
        },
      });

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === "/" && request.method === "GET") {
      return json({
        success: true,
        service: "VYRA AI",
        provider: "OpenRouter",
      });
    }

    if (url.pathname !== "/chat") {
      return json({ success: false, error: "Endpoint not found" }, 404);
    }

    if (request.method !== "POST") {
      return json({ success: false, error: "Use POST" }, 405);
    }

    if (!env.OPENROUTER_API_KEY) {
      return json({
        success: false,
        error: "OpenRouter API key is not configured",
      }, 500);
    }

    try {
      const form = await request.formData();
      const message = String(form.get("message") || "").trim();
      const prompt = String(form.get("prompt") || "").trim();

      if (!message) {
        return json({
          success: false,
          error: "Message is required",
        }, 400);
      }

      if (message.length > 4000 || prompt.length > 4000) {
        return json({
          success: false,
          error: "Message or prompt is too long",
        }, 400);
      }

      const messages = [];

      if (prompt) {
        messages.push({
          role: "system",
          content: prompt,
        });
      } else {
        messages.push({
          role: "system",
          content:
            "You are VYRA AI, a helpful, friendly Discord assistant. Answer clearly and naturally.",
        });
      }

      messages.push({
        role: "user",
        content: message,
      });

      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "X-OpenRouter-Title": "VYRA AI",
          },
          body: JSON.stringify({
            model: "openrouter/free",
            messages,
            max_tokens: 500,
            temperature: 0.7,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("OpenRouter error:", response.status, data);

        return json({
          success: false,
          error: data?.error?.message || `OpenRouter HTTP ${response.status}`,
        }, 502);
      }

      const reply = data?.choices?.[0]?.message?.content;

      if (typeof reply !== "string" || !reply.trim()) {
        return json({
          success: false,
          error: "The AI returned an empty response",
        }, 502);
      }

      return json({
        success: true,
        reply: reply.trim(),
        model: data.model || "openrouter/free",
        usage: data.usage || null,
      });
    } catch (error) {
      console.error("VYRA Worker error:", error);

      return json({
        success: false,
        error: "The AI request failed. Please try again.",
      }, 500);
    }
  },
};
