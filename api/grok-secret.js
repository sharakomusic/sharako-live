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

  const voice = "ara";

  try {
    const r = await fetch("https://api.x.ai/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        expires_after: { seconds: 3600 },
        session: {
          model: "grok-voice-think-fast-2.0",
          voice,
          audio: {
            input: { format: { type: "audio/pcm", rate: 24000 } },
            output: { format: { type: "audio/pcm", rate: 24000 }, speed: 0.9 }
          }
        }
      })
    });
    const body = await r.json();
    if (!r.ok || !body.value) {
      res.status(200).json({ ok: false });
      return;
    }
    res.status(200).json({ ok: true, token: body.value, voice });
  } catch (_) {
    res.status(200).json({ ok: false });
  }
}
