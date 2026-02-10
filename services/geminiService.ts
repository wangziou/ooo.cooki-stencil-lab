import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';

// Initialize safely
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

export const analyzeTattooDesign = async (base64Image: string, promptText: string): Promise<string> => {
  if (!ai) {
    return "API Key is missing. Please check your environment configuration.";
  }

  try {
    const model = 'gemini-2.5-flash-latest';
    
    // Remove data URL header if present
    const base64Data = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Data
            }
          },
          {
            text: `You are a professional senior tattoo artist. Analyze this tattoo design. ${promptText}. Keep it concise and helpful for a stencil artist.`
          }
        ]
      }
    });

    return response.text || "No analysis could be generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Failed to analyze the image. Please try again.";
  }
};