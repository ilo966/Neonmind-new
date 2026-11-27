// Vercel serverless function: POST /api/chat
const ALLOWED_MODELS = new Set([
  "openai/gpt-oss-120b",
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile"
]);

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "Server AI configuration is missing. Add GROQ_API_KEY in Vercel." });
  }

  try {
    const body = req.body || {};
    const incoming = Array.isArray(body.messages) ? body.messages : [];
    if (incoming.length < 1 || incoming.length > 20) {
      return res.status(400).json({ error: "Send between 1 and 20 messages." });
    }

    const modelMap = {
      default: "openai/gpt-oss-120b",
      fast: "llama-3.1-8b-instant",
      reasoning: "openai/gpt-oss-120b"
    };
    const requested = modelMap[body.model] || body.model;
    const model = ALLOWED_MODELS.has(requested) ? requested : "openai/gpt-oss-120b";

    const messages = [];
    const systemPrompt = typeof body.systemPrompt === "string"
      ? body.systemPrompt.slice(0, 4000)
      : "You are a helpful, concise AI assistant.";
    messages.push({ role: "system", content: systemPrompt });

    for (const item of incoming) {
      if (!item || !["user", "assistant"].includes(item.role) || typeof item.content !== "string") {
        return res.status(400).json({ error: "Invalid message format." });
      }
      messages.push({ role: item.role, content: item.content.slice(0, 12000) });
    }

    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1200
      })
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error("Groq request failed:", upstream.status, data?.error?.message || "Unknown error");
      return res.status(upstream.status >= 500 ? 502 : upstream.status).json({
        error: "Groq could not complete the request. Check the Vercel function logs."
      });
    }

    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return res.status(502).json({ error: "Groq returned an empty response." });
    }

    return res.status(200).json({ choices: [{ message: { content } }] });
  } catch (error) {
    console.error("Chat function error:", error);
    return res.status(500).json({ error: "Unexpected server error." });
  }
};
