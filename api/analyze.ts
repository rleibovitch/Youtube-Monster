import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from "@google/genai";

// Define types locally to avoid import issues
interface AnalysisEvent {
  timestamp: number;
  category: string;
  subCategory: string;
  description: string;
}

// Define constants locally
const NEGATIVE_SPEECH_SUBCATEGORIES: string[] = [
  'Devaluation of Others',
  'Entitlement',
  'Victim Narrative/Self-Pity',
  'Shame-Laden',
  'Envy/Resentment',
  'Passive-Aggression',
  'Hostility',
  'Hate Speech',
  'Impaired Empathy / Dismissiveness',
  'Incoherence',
  'Excessive Self-Reference',
];

const NEGATIVE_BEHAVIOR_SUBCATEGORIES: string[] = [
  'Bullying',
  'Harassment',
  'Drinking alcohol',
  'Violence',
  'Sexism',
];

const POTENTIAL_EMOTIONS_SUBCATEGORIES: string[] = [
  'Angry',
  'Fearful/Anxious',
  'Sad',
  'Irritated/Impatient',
  'Cold/Detached',
];

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY environment variable not set on server");
    return res.status(500).json({ error: "Server configuration error: API key is missing." });
  }
  
  const { videoTopic, sensitivity } = req.body;
  if (!videoTopic) {
    return res.status(400).json({ error: "Missing 'videoTopic' in request body." });
  }

  // Sensitivity index: 1 (least sensitive) to 10 (most sensitive), default 5
  let sensitivityIndex = 5;
  if (typeof sensitivity === 'number' && sensitivity >= 1 && sensitivity <= 10) {
    sensitivityIndex = Math.round(sensitivity);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `
You are an expert AI content analysis engine. Your task is to generate a mock analysis for a hypothetical YouTube video about "${videoTopic}".

The sensitivity index is ${sensitivityIndex} (1=least sensitive, 10=most sensitive, 5=medium). Judge as if Carl Jung were a parent. The higher the sensitivity, the more likely you are to flag subtle or borderline content as negative; the lower the sensitivity, the more tolerant you are of ambiguity or mild negativity.

Your output MUST be a valid JSON array of objects. Each object represents a detected negative event and must adhere to the following schema:

{
  "timestamp": number,      // Time in seconds (e.g., 45.5). Must be between 10 and 450.
  "category": "Negative Speech" | "Negative Behavior" | "Potential Emotions",
  "subCategory": string,      // Must be one of the predefined sub-categories below.
  "description": string,      // A brief, neutral, one-sentence description (under 15 words).
  "phrase": string           // The quoted phrase or utterance that triggered the flag.
}

Here is an example of a valid response format:
[
  {
    "timestamp": 25,
    "category": "Negative Speech",
    "subCategory": "Hostility",
    "description": "The speaker aggressively insults the opponent's viewpoint.",
    "phrase": "You're an idiot for thinking that."
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
                temperature: 0.5,
            },
        });
        
        responseText = response.text || '';
        let jsonStr = responseText.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[2]) {
            jsonStr = match[2].trim();
        }

        const parsedData = JSON.parse(jsonStr);
        if (Array.isArray(parsedData)) {
            return res.status(200).json(parsedData as AnalysisEvent[]);
        }
        throw new Error("AI response was not a JSON array.");

    } catch (e) {
        console.error("Failed to generate or parse Gemini response:", e);
        if(responseText){
            console.error("Raw AI response that caused the error:\n---\n" + responseText + "\n---");
        }
        throw new Error("The AI failed to generate a valid analysis. Please try again.");
    }
  } catch (e) {
    console.error("Error in serverless function:", e);
    const message = e instanceof Error ? e.message : "An unknown server error occurred.";
    return res.status(500).json({ error: message });
  }
}
