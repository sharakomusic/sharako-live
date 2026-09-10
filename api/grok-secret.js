export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(200).json({ ok: false });
    return;
  }
  const key = process.env.XAI_API_KEY;
  if (!key) {
    res.status(200).json({ ok: false });
    return;
  }
  let voice = "luna";
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const v = String(body.voice || "").toLowerCase();
    if (["luna", "carina", "ara", "eve", "sal", "rex", "liora", "aurora", "iris"].includes(v)) voice = v;
  } catch (_) {}
  try {
    const r = await fetch("https://api.x.ai/v1/realtime/client_secrets", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        expires_after: { seconds: 300 },
        session: { model: "grok-voice-latest", voice },
      }),
    });
    const body = await r.json();
    if (!r.ok || !body.value) {
      res.status(200).json({ ok: false });
      return;
    }
    res.status(200).json({ ok: true, token: body.value });
  } catch (_) {
    res.status(200).json({ ok: false });
  }
}
