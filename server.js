import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import twilio from "twilio";

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
const conversations = {};

// Webhook Twilio
app.post("/webhook/twilio", async (req, res) => {
  try {
    const from = req.body.From;
    const userText = req.body.Body;

    if (!from || !userText) return res.sendStatus(200);

    if (!conversations[from]) conversations[from] = [];
    conversations[from].push({ role: "user", parts: [{ text: userText }] });

    const chat = model.startChat({
      history: conversations[from].slice(0, -1),
      generationConfig: { maxOutputTokens: 500 }
    });

    const result = await chat.sendMessage(userText);
    const reply = result.response.text();

    conversations[from].push({ role: "model", parts: [{ text: reply }] });

    // Répondre via Twilio
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(reply);

    res.type("text/xml");
    res.send(twiml.toString());

  } catch (error) {
    console.error("Erreur:", error);
    res.sendStatus(500);
  }
});

app.get("/", (req, res) => res.send("Bot en ligne !"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
