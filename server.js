import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const conversations = {};

// Vérification webhook
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Réception des messages
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (!message || message.type !== "text") return res.sendStatus(200);

    const from = message.from;
    const userText = message.text.body;

    if (!conversations[from]) conversations[from] = [];
    conversations[from].push({ role: "user", parts: [{ text: userText }] });

    const chat = model.startChat({
      history: conversations[from].slice(0, -1),
      generationConfig: { maxOutputTokens: 500 }
    });

    const result = await chat.sendMessage(userText);
    const reply = result.response.text();

    conversations[from].push({ role: "model", parts: [{ text: reply }] });

    await sendWhatsAppMessage(from, reply);
    res.sendStatus(200);
  } catch (error) {
    console.error("Erreur:", error);
    res.sendStatus(500);
  }
});

async function sendWhatsAppMessage(to, text) {
  const url = `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`;
  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
