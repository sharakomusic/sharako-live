export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const login = process.env.TELNYX_SIP_USER || process.env.TELNYX_LOGIN || "";
  const password = process.env.TELNYX_SIP_PASSWORD || process.env.TELNYX_PASSWORD || "";
  if (login && password) {
    res.status(200).json({ ok: true, login, password });
    return;
  }

  const key = process.env.TELNYX_API_KEY || "";
  const connectionId = process.env.TELNYX_CONNECTION_ID || "";
  if (key && connectionId) {
    try {
      const r = await fetch("https://api.telnyx.com/v2/telephony_credentials", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + key,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ connection_id: connectionId })
      });
      const body = await r.json();
      const d = body && body.data ? body.data : {};
      const u = d.sip_username || d.user_name || "";
      const p = d.sip_password || d.password || "";
      if (u && p) {
        res.status(200).json({ ok: true, login: u, password: p });
        return;
      }
    } catch (_) {}
  }

  res.status(200).json({ ok: false });
}
