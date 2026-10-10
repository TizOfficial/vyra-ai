
export default {
  async fetch(request, env) {
    const headers = {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store"
    };

    if (request.method !== "POST") {
      return new Response("Use POST", {
        status: 405,
        headers
      });
    }

    if (
      !env.WORKER_SECRET ||
      request.headers.get("Authorization") !== `Bearer ${env.WORKER_SECRET}`
    ) {
      return new Response("Unauthorized", {
        status: 401,
        headers
      });
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
        return new Response("Maximum prompt length is 2000 characters.", {
          status: 400,
          headers
        });
      }

      const apiResponse = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "X-OpenRouter-Title": "VYRA AI"
          },
          body: JSON.stringify({
            model: "openrouter/free",
            messages: [
              {
                role: "system",
                content:
                  "You are VYRA AI, a friendly Discord AI assistant. Answer in the same language as the user. Be helpful, clear and concise."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            max_tokens: 500
          })
        }
      );

      const data = await apiResponse.json();

      if (!apiResponse.ok) {
  return new Response(
    `OpenRouter HTTP ${apiResponse.status}: ${JSON.stringify(data)}`,
    {
      status: 200,
      headers
    }
  );
      }

      const answer = data.choices?.[0]?.message?.content;

      if (typeof answer !== "string" || !answer.trim()) {
        return new Response("The AI returned no text.", {
          status: 502,
          headers
        });
      }

      return new Response(answer.trim().slice(0, 4000), {
        status: 200,
        headers
      });
    } catch {
      return new Response("Worker request failed.", {
        status: 500,
        headers
      });
    }
  }
};
