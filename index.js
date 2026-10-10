
export default {
  async fetch(request, env) {
    const headers = { "Content-Type": "text/plain; charset=utf-8" };

    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers
      });
    }

    if (request.headers.get("Authorization") !== `Bearer ${env.WORKER_SECRET}`) {
      return new Response("Unauthorized", { status: 401, headers });
    }

    try {
      const prompt = (await request.text()).trim();

      if (!prompt) {
        return new Response("Please enter a question.", {
          status: 400,
          headers
        });
      }

      if (prompt.length > 2000) {
        return new Response("Question too long.", {
          status: 400,
          headers
        });
      }

      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "openrouter/free",
            messages: [
              {
                role: "system",
                content: "You are VYRA AI, a friendly Discord assistant. Answer in the user's language."
              },
              { role: "user", content: prompt }
            ],
            max_tokens: 500
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return new Response(
          `OpenRouter error (${response.status}): ${data.error?.message || "Unknown error"}`,
          { status: 502, headers }
        );
      }

      const answer = data.choices?.[0]?.message?.content;

      if (!answer) {
        return new Response("No AI response received.", {
          status: 502,
          headers
        });
      }

      return new Response(answer, { status: 200, headers });
    } catch (error) {
      return new Response("Worker error: " + error.message, {
        status: 500,
        headers
      });
    }
  }
};
