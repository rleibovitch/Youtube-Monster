import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from "@google/genai";
import { YoutubeTranscript } from 'youtube-transcript';

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

// Enhanced transcript fetching with multiple fallback methods
async function fetchTranscriptWithFallbacks(videoId: string) {
  let transcript = null;
  let errorMessage = '';

  // Method 1: Try default language (usually English)
  try {
    console.log(`Attempting to fetch transcript for video ${videoId} with default language...`);
    transcript = await YoutubeTranscript.fetchTranscript(videoId);
    console.log(`Successfully fetched transcript with ${transcript.length} segments`);
    return { transcript, error: null };
  } catch (err: any) {
    errorMessage = `Default language failed: ${err.message}`;
    console.log(`Default language transcript fetch failed: ${err.message}`);
  }

  // Method 2: Try with specific language codes
  const languageCodes = ['en', 'en-US', 'en-GB', 'auto'];
  for (const lang of languageCodes) {
    try {
      console.log(`Attempting to fetch transcript for video ${videoId} with language ${lang}...`);
      transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang });
      console.log(`Successfully fetched transcript with ${transcript.length} segments using language ${lang}`);
      return { transcript, error: null };
    } catch (err: any) {
      errorMessage = `${errorMessage}\nLanguage ${lang} failed: ${err.message}`;
      console.log(`Language ${lang} transcript fetch failed: ${err.message}`);
    }
  }

  // Method 3: Try to get available transcripts first
  try {
    console.log(`Attempting to list available transcripts for video ${videoId}...`);
    const availableTranscripts = await YoutubeTranscript.listTranscripts(videoId);
    console.log(`Available transcripts:`, availableTranscripts);
    
    if (availableTranscripts.length > 0) {
      // Try the first available transcript
      const firstTranscript = availableTranscripts[0];
      transcript = await firstTranscript.fetch();
      console.log(`Successfully fetched transcript with ${transcript.length} segments using first available transcript`);
      return { transcript, error: null };
    }
  } catch (err: any) {
    errorMessage = `${errorMessage}\nListing transcripts failed: ${err.message}`;
    console.log(`Listing transcripts failed: ${err.message}`);
  }

  // Method 4: Check if video exists and has captions using YouTube Data API (if API key is available)
  if (process.env.YOUTUBE_API_KEY) {
    try {
      console.log(`Checking video details with YouTube Data API...`);
      const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics,status&id=${videoId}&key=${process.env.YOUTUBE_API_KEY}`);
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        const video = data.items[0];
        console.log(`Video found: ${video.snippet?.title || 'Unknown title'}`);
        
        // Check if video has captions
        const captionsResponse = await fetch(`https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${process.env.YOUTUBE_API_KEY}`);
        const captionsData = await captionsResponse.json();
        
        if (captionsData.items && captionsData.items.length > 0) {
          console.log(`Video has ${captionsData.items.length} caption tracks available`);
          errorMessage = `${errorMessage}\nVideo has captions but transcript package failed to fetch them`;
        } else {
          console.log(`Video exists but has no captions`);
          errorMessage = `${errorMessage}\nVideo exists but has no captions/transcripts`;
        }
      } else {
        console.log(`Video not found or is private`);
        errorMessage = `${errorMessage}\nVideo not found or is private`;
      }
    } catch (err: any) {
      errorMessage = `${errorMessage}\nYouTube API check failed: ${err.message}`;
      console.log(`YouTube API check failed: ${err.message}`);
    }
  }

  // If all methods fail, return detailed error
  const finalError = `Unable to retrieve transcript. Possible reasons:\n` +
    `1. Video has no captions/transcripts enabled\n` +
    `2. Video is private or restricted\n` +
    `3. Video ID is invalid\n` +
    `4. YouTube API restrictions\n\n` +
    `Technical details:\n${errorMessage}`;

  return { transcript: null, error: finalError };
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
  
  const { videoTopic, sensitivity, videoDuration, videoId } = req.body;
  if (!videoId) {
    return res.status(400).json({ error: "Missing 'videoId' in request body for transcript analysis." });
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

  // Fetch transcript with enhanced error handling
  console.log(`Starting transcript analysis for video: ${videoId}`);
  const { transcript, error: transcriptError } = await fetchTranscriptWithFallbacks(videoId);
  
  if (!transcript) {
    console.error('Transcript fetch failed:', transcriptError);
    return res.status(500).json({ error: transcriptError || 'Unable to retrieve this transcript.' });
  }

  if (transcript.length === 0) {
    return res.status(500).json({ error: 'Transcript is empty. This video may not have any speech content or captions.' });
  }

  console.log(`Analyzing ${transcript.length} transcript segments...`);

  // For each transcript segment, run Gemini analysis to flag negative content
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const flaggedEvents = [];
  
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
        model: "gemini-2.5-flash-preview-04-17",
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
          flaggedEvents.push({
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

  console.log(`Analysis complete. Found ${flaggedEvents.length} flagged events.`);
  return res.status(200).json(flaggedEvents);
}
