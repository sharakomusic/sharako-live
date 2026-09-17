export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  const key = process.env.XAI_API_KEY;
  if (!key) return res.status(503).json({ ok: false, error: "AI is not available" });
  const history = Array.isArray(req.body?.messages) ? req.body.messages.slice(-16) : [];
  const r = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "grok-4.5",
      max_tokens: 180,
      temperature: 0.8,
      messages: [
        { role: "system", content: "You are SHARAKO — a quiet companion. Short, warm, unhurried. If they want the phone, tell them to tap Call." },
        ...history.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.text || "").slice(0, 2000) })),
      ],
    }),
  });
  if (!r.ok) return res.status(502).json({ ok: false, error: "Can't connect" });
  const data = await r.json();
  return res.json({ ok: true, text: data.choices?.[0]?.message?.content?.trim() || "" });
}
