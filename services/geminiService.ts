import { GoogleGenAI } from "@google/genai";
import type { AnalysisEvent } from '../types';
import { NEGATIVE_SPEECH_SUBCATEGORIES, NEGATIVE_BEHAVIOR_SUBCATEGORIES, POTENTIAL_EMOTIONS_SUBCATEGORIES } from '../constants';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateAnalysis = async (videoTopic: string): Promise<AnalysisEvent[]> => {
    const prompt = `
You are an expert AI content analysis engine. Your task is to generate a mock analysis for a hypothetical YouTube video about "${videoTopic}".

Your output MUST be a valid JSON array of objects. Each object represents a detected negative event and must adhere to the following schema:

{
  "timestamp": number,      // Time in seconds (e.g., 45.5). Must be between 10 and 450.
  "category": "Negative Speech" | "Negative Behavior" | "Potential Emotions",
  "subCategory": string,      // Must be one of the predefined sub-categories below.
  "description": string      // A brief, neutral, one-sentence description (under 15 words).
}

Here is an example of a valid response format:
[
  {
    "timestamp": 25,
    "category": "Negative Speech",
    "subCategory": "Hostility",
    "description": "The speaker aggressively insults the opponent's viewpoint."
  },
  {
    "timestamp": 68,
    "category": "Negative Behavior",
    "subCategory": "Bullying",
    "description": "One participant repeatedly interrupts and talks over another."
  },
  {
    "timestamp": 123,
    "category": "Potential Emotions",
    "subCategory": "Angry",
    "description": "The speaker's tone becomes loud and strained, suggesting anger."
  }
]

**Valid Sub-Categories (use these exact strings):**
- For "Negative Speech": ${NEGATIVE_SPEECH_SUBCATEGORIES.join(', ')}
- For "Negative Behavior": ${NEGATIVE_BEHAVIOR_SUBCATEGORIES.join(', ')}
- For "Potential Emotions": ${POTENTIAL_EMOTIONS_SUBCATEGORIES.join(', ')}

**CRITICAL RULES:**
1.  **JSON ONLY:** Your entire output must be ONLY the JSON array. Do NOT include any introductory text, comments, explanations, or markdown fences (like \`\`\`json).
2.  **VALID JSON:** Ensure the JSON is perfectly valid. Pay close attention to commas (no trailing commas) and correctly escaped double quotes within strings.
3.  **QUANTITY:** Generate between 8 and 15 event objects.
4.  **TIMESTAMPS:** Timestamps must be in increasing order.
`;

    let responseText = '';
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                temperature: 0.5, // Lowered temperature for more predictable, structured output
            },
        });
        
        responseText = response.text;
        let jsonStr = responseText.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[2]) {
            jsonStr = match[2].trim();
        }

        const parsedData = JSON.parse(jsonStr);
        if (Array.isArray(parsedData)) {
            return parsedData as AnalysisEvent[];
        }
        return [];

    } catch (e) {
        console.error("Failed to generate or parse Gemini response:", e);
        if(responseText){
            console.error("Raw AI response that caused the error:\n---\n" + responseText + "\n---");
        }
        throw new Error("The AI failed to generate a valid analysis. Please try again.");
    }
};