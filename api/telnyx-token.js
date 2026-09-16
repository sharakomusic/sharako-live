export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const login = process.env.TELNYX_SIP_USER || "usersharakomusic61680";
  const password = process.env.TELNYX_SIP_PASSWORD || "5zfUSY3#TcvY";
  if (login && password) {
    res.status(200).json({ ok: true, login, password });
    return;
  }

  res.status(200).json({ ok: false });
}
