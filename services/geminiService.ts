
import { GoogleGenAI } from "@google/genai";

const LOCAL_FALLBACKS = [
  "¡El estadio ruge con esta jugada!",
  "¡Qué intensidad estamos viendo en el césped!",
  "El técnico no deja de dar instrucciones en la banda.",
  "¡La posesión es clave en este tramo del partido!",
  "¡Balón en disputa, nadie quiere ceder ni un metro!",
  "¡Ojo a la transición ofensiva, hay espacios!",
  "¡Presión asfixiante en la salida de balón!",
  "¡El mediocampo es una batalla táctica ahora mismo!",
  "¡Qué elegancia en ese control!",
  "¡Buscan la verticalidad con pases entre líneas!",
  "¡La defensa está muy bien plantada hoy!",
  "¡El público se levanta de sus asientos!"
];

// Estado persistente para el Circuit Breaker
let apiCooldownUntil = 0;
const BREAKER_TIME = 60000; // 1 minuto de descanso si la API falla por cuota

export const getMatchCommentary = async (eventDescription: string) => {
  const now = Date.now();

  // Si estamos en periodo de penalización por cuota, usamos fallback directo
  if (now < apiCooldownUntil) {
    return LOCAL_FALLBACKS[Math.floor(Math.random() * LOCAL_FALLBACKS.length)];
  }

  if (!process.env.API_KEY) {
    return LOCAL_FALLBACKS[Math.floor(Math.random() * LOCAL_FALLBACKS.length)];
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Eres un narrador de fútbol profesional. Describe de forma apasionada y MUY BREVE (máximo 10 palabras) este evento: ${eventDescription}. Evita mencionar que eres una IA.`,
      config: {
        temperature: 0.9,
        topP: 0.95,
      }
    });

    const text = response.text?.trim();
    if (!text) throw new Error("Empty response");
    return text;

  } catch (error: any) {
    const isQuotaError = error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
    
    if (isQuotaError) {
      // Activamos el Circuit Breaker
      apiCooldownUntil = Date.now() + BREAKER_TIME;
      console.warn(`[Gemini Service] Quota exceeded. Silencing API for ${BREAKER_TIME/1000}s.`);
    } else {
      console.error("[Gemini Service] Error:", error?.message);
    }
    
    // Devolvemos un comentario local aleatorio sin mensajes de error para el usuario
    return LOCAL_FALLBACKS[Math.floor(Math.random() * LOCAL_FALLBACKS.length)];
  }
};
