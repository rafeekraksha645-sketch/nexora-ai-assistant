exports.handler = async (event) => {
  const reply = (code, obj) => ({
    statusCode: code,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  });
  if (event.httpMethod !== "POST") return reply(405, { error: "POST only" });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return reply(500, { error: "Missing GEMINI_API_KEY" });
  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch (e) { return reply(400, { error: "Bad request" }); }
  let contents = (Array.isArray(body.messages) ? body.messages : [])
    .slice(-20)
    .map((m) => ({
      role: m.r === "u" ? "user" : "model",
      parts: [{ text: String(m.x || "").slice(0, 4000) }],
    }));
  while (contents.length && contents[0].role !== "user") contents.shift();
  if (!contents.length || contents[contents.length - 1].role !== "user")
    return reply(400, { error: "No question" });
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent";
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text:
          "You are NEXORA AI, a friendly assistant for learning, coding, ICT and cybersecurity education. " +
          "Reply in the same language the user writes in (English, Tamil or Sinhala). " +
          "Keep answers clear and simple. Refuse requests to harm people or break into systems." }] },
        contents,
      }),
    });
    const data = await r.json();
    if (!r.ok) return reply(502, { error: "Gemini error" });
    const text = ((data.candidates || [])[0]?.content?.parts || []).map((p) => p.text || "").join("");
    if (!text) return reply(502, { error: "Empty answer" });
    return reply(200, { reply: text });
  } catch (e) {
    return reply(502, { error: "Server error" });
  }
};
