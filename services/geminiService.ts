import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Contact } from "../types";

// Initialize the client.
// Note: process.env.API_KEY is assumed to be available as per instructions.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-2.5-flash';

/**
 * Generates a WhatsApp message template based on a campaign goal and audience description.
 */
export const generateCampaignMessage = async (
  goal: string,
  audience: string,
  tone: string = 'professional but friendly'
): Promise<string> => {
  try {
    const prompt = `
      You are an expert marketing copywriter for WhatsApp Business.
      
      Goal: ${goal}
      Target Audience: ${audience}
      Tone: ${tone}
      
      Constraints:
      1. Keep it short (under 100 words).
      2. Use emojis appropriately.
      3. Include a clear call to action.
      4. Format for WhatsApp (use *bold* for emphasis).
      5. You CAN use dynamic placeholders like {firstName}, {name}, or {phone} to personalize the message. The system will replace them with actual contact data.
      6. Prefer using {firstName} for a friendly tone.
      
      Write the message:
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    return response.text || "Could not generate message.";
  } catch (error) {
    console.error("Error generating message:", error);
    return "Error: Unable to generate message due to AI service unavailability.";
  }
};

/**
 * Analyzes a list of contacts and suggests segments based on tags and history.
 */
export const analyzeSegments = async (contacts: Contact[]): Promise<{name: string, reason: string, contactIds: string[]}[]> => {
  try {
    const contactsSummary = contacts.map(c => ({
      id: c.id,
      tags: c.tags,
      lastInteraction: c.lastInteraction,
      sentiment: c.sentiment
    }));

    const responseSchema: Schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          reason: { type: Type.STRING },
          contactIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["name", "reason", "contactIds"]
      }
    };

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `
        Analyze this list of contacts and group them into 3 logical marketing segments based on their tags, recency, and sentiment.
        
        Contacts Data:
        ${JSON.stringify(contactsSummary)}
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    const text = response.text;
    if (!text) return [];
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Error analyzing segments:", error);
    return [];
  }
};

/**
 * Suggests a follow-up reply based on a customer message.
 */
export const suggestReply = async (lastMessage: string, customerName: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `
            A customer named ${customerName} sent this message on WhatsApp: "${lastMessage}".
            Write a concise, helpful, and friendly reply.
        `
    });
    return response.text || "";
  } catch (e) {
    console.error(e);
    return "";
  }
};