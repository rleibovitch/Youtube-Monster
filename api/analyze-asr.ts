import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from "@google/genai";

interface AnalysisEvent {
  timestamp: number;
  category: string;
  subCategory: string;
  description: string;
  phrase: string;
}

interface ASRTranscriptSegment {
  offset: number;
  text: string;
  duration?: number;
}

// Define constants
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

// Placeholder for ASR transcription
async function transcribeWithASR(videoId: string): Promise<ASRTranscriptSegment[]> {
  // This would be replaced with actual ASR implementation
  // For now, return an empty array to indicate no ASR available
  throw new Error('ASR transcription is not available in this environment. Please use videos with available captions.');
}

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
  
  const { videoId, sensitivity, videoDuration } = req.body;
  if (!videoId) {
    return res.status(400).json({ error: "Missing 'videoId' in request body for ASR analysis." });
  }

  // Validate videoId format
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: "Invalid video ID format. YouTube video IDs should be 11 characters long." });
  }

  // Sensitivity index: 1 (least sensitive) to 10 (most sensitive), default 5
  let sensitivityIndex = 5;
  if (typeof sensitivity === 'number' && sensitivity >= 1 && sensitivity <= 10) {
    sensitivityIndex = Math.round(sensitivity);
  }

  // Use actual video duration if provided, otherwise default to 450 seconds
  const maxTimestamp = (typeof videoDuration === 'number' && videoDuration > 10)
    ? Math.floor(videoDuration)
    : 450;
  
  try {
    console.log(`[ASR Analysis] Starting ASR analysis for video: ${videoId}`);
    
    // Try ASR transcription
    const transcript = await transcribeWithASR(videoId);
    
    if (transcript.length === 0) {
      return res.status(500).json({ error: 'ASR transcription produced no results. The video may not contain speech or the audio quality is too poor.' });
    }

    console.log(`[ASR Analysis] Successfully transcribed ${transcript.length} segments using ASR`);
    console.log(`[ASR Analysis] Analyzing ${transcript.length} transcript segments...`);

    // Analyze transcript with Gemini
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const analysisEvents: AnalysisEvent[] = [];
    
    for (let i = 0; i < transcript.length; i++) {
      const segment = transcript[i];
      
      // Only analyze segments within the video duration
      if (segment.offset / 1000 > maxTimestamp) continue;
      
      const prompt = `
You are an expert AI content moderation engine. Analyze the following YouTube transcript segment for negative speech, negative behavior, or potential negative emotions. Use the sensitivity index (${sensitivityIndex}) to determine how strictly to flag content (1=least sensitive, 10=most sensitive, 5=medium). Judge as if Carl Jung were a parent.

Transcript segment:
"""
${segment.text}
"""

If you detect a negative event, respond with a JSON object with the following schema:
{
  "category": "Negative Speech" | "Negative Behavior" | "Potential Emotions",
  "subCategory": string, // Must be one of the predefined sub-categories below
  "description": string, // Brief, neutral, one-sentence description (under 15 words)
  "phrase": string // The quoted phrase or utterance that triggered the flag
}
If there is no negative event, respond with an empty string.

**Valid Sub-Categories (use these exact strings):**
- For "Negative Speech": ${NEGATIVE_SPEECH_SUBCATEGORIES.join(', ')}
- For "Negative Behavior": ${NEGATIVE_BEHAVIOR_SUBCATEGORIES.join(', ')}
- For "Potential Emotions": ${POTENTIAL_EMOTIONS_SUBCATEGORIES.join(', ')}
`;
      
      let aiResponse = '';
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash-exp",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.5,
          },
        });
        aiResponse = response.text || '';
        
        if (aiResponse.trim() && aiResponse.trim() !== '""') {
          let eventObj;
          try {
            eventObj = JSON.parse(aiResponse.trim());
          } catch (e) {
            // Try to extract JSON from markdown or text
            const match = aiResponse.match(/\{[\s\S]*\}/);
            if (match) {
              eventObj = JSON.parse(match[0]);
            }
          }
          
          if (eventObj && eventObj.category && eventObj.subCategory && eventObj.description && eventObj.phrase) {
            analysisEvents.push({
              timestamp: Math.round(segment.offset / 1000),
              ...eventObj,
            });
          }
        }
      } catch (e) {
        console.error(`AI analysis error for segment ${i}:`, e, '\nPrompt:', prompt, '\nAI Response:', aiResponse);
        // Continue to next segment
      }
    }

    // Return the analysis results
    console.log(`[ASR Analysis] Analysis complete. Found ${analysisEvents.length} events using ASR transcription`);
    
    return res.status(200).json({
      events: analysisEvents,
      extractionMethod: 'cloud-asr-fallback',
      transcriptSegmentCount: transcript.length
    });
    
  } catch (error) {
    console.error(`[ASR Analysis] ASR analysis failed:`, error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'ASR analysis failed' 
    });
  }
} 