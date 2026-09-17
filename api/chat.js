export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(200).json({ ok: false, error: "Can't connect — try again." });
    return;
  }
  const key = process.env.XAI_API_KEY;
  if (!key) {
    res.status(200).json({ ok: false, error: "Can't connect — try again." });
    return;
  }
  let history = [];
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    history = Array.isArray(body.messages) ? body.messages.slice(-16) : [];
  } catch {
    history = [];
  }
  try {
    const r = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 180,
        temperature: 0.8,
        messages: [
          {
            role: "system",
            content:
              "You are SHARAKO — a quiet companion. Short, warm, unhurried. No lists unless asked. If they want the phone, tell them to tap Call.",
          },
          ...history.map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: String(m.text || "").slice(0, 2000),
          })),
        ],
      }),
    });
    const data = await r.json();
    const text = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || "").trim();
    if (!r.ok || !text) {
      res.status(200).json({ ok: false, error: "Can't connect — try again." });
      return;
    }
    res.status(200).json({ ok: true, text });
  } catch {
    res.status(200).json({ ok: false, error: "Can't connect — try again." });
  }
}
