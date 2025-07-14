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

  // Method 4: Web scraping fallback - extract transcript from YouTube page
  try {
    console.log(`Attempting web scraping fallback for video ${videoId}...`);
    transcript = await scrapeTranscriptFromYouTubePage(videoId);
    if (transcript && transcript.length > 0) {
      console.log(`Successfully scraped transcript with ${transcript.length} segments from YouTube page`);
      return { transcript, error: null };
    }
  } catch (err: any) {
    errorMessage = `${errorMessage}\nWeb scraping failed: ${err.message}`;
    console.log(`Web scraping failed: ${err.message}`);
  }

  // Method 5: Check if video exists and has captions using YouTube Data API (if API key is available)
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

// Web scraping fallback method to extract transcript from YouTube page
async function scrapeTranscriptFromYouTubePage(videoId: string) {
  try {
    console.log(`Scraping transcript from YouTube page for video ${videoId}...`);
    
    // Fetch the YouTube page
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    
    // Method 1: Try to extract transcript from ytInitialData
    const ytInitialDataMatch = html.match(/var ytInitialData = ({.+?});/);
    if (ytInitialDataMatch) {
      try {
        const ytInitialData = JSON.parse(ytInitialDataMatch[1]);
        const transcript = extractTranscriptFromYtInitialData(ytInitialData);
        if (transcript && transcript.length > 0) {
          return transcript;
        }
      } catch (err) {
        console.log(`Failed to parse ytInitialData: ${err.message}`);
      }
    }

    // Method 2: Try to extract from inline script tags
    const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
    if (scriptMatches) {
      for (const script of scriptMatches) {
        try {
          // Look for transcript data in script content
          const transcriptData = extractTranscriptFromScript(script);
          if (transcriptData && transcriptData.length > 0) {
            return transcriptData;
          }
        } catch (err) {
          // Continue to next script
        }
      }
    }

    // Method 3: Try to extract from captions track
    const captionsMatch = html.match(/"captions":\s*({[^}]+})/);
    if (captionsMatch) {
      try {
        const captionsData = JSON.parse(captionsMatch[1]);
        const transcript = extractTranscriptFromCaptions(captionsData);
        if (transcript && transcript.length > 0) {
          return transcript;
        }
      } catch (err) {
        console.log(`Failed to parse captions data: ${err.message}`);
      }
    }

    throw new Error('No transcript data found in page source');
  } catch (err: any) {
    console.error(`Web scraping failed: ${err.message}`);
    throw err;
  }
}

// Extract transcript from ytInitialData
function extractTranscriptFromYtInitialData(data: any): any[] {
  try {
    // Navigate through the complex ytInitialData structure
    const playerResponse = data?.contents?.twoColumnWatchNextResults?.results?.results?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.backstagePostRenderer?.backstagePost?.subPost?.content?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.playerResponse;
    
    if (playerResponse) {
      const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (captions && captions.length > 0) {
        // Try to fetch the first available caption track
        return fetchCaptionTrack(captions[0].baseUrl);
      }
    }

    // Alternative path for transcript data
    const transcriptRenderer = findTranscriptRenderer(data);
    if (transcriptRenderer) {
      return parseTranscriptRenderer(transcriptRenderer);
    }

    return [];
  } catch (err) {
    console.log(`Failed to extract from ytInitialData: ${err.message}`);
    return [];
  }
}

// Find transcript renderer in the data structure
function findTranscriptRenderer(data: any): any {
  const searchInObject = (obj: any, depth = 0): any => {
    if (depth > 10) return null; // Prevent infinite recursion
    
    if (obj && typeof obj === 'object') {
      if (obj.transcriptRenderer) {
        return obj.transcriptRenderer;
      }
      
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const result = searchInObject(obj[key], depth + 1);
          if (result) return result;
        }
      }
    }
    
    return null;
  };
  
  return searchInObject(data);
}

// Parse transcript renderer data
function parseTranscriptRenderer(renderer: any): any[] {
  try {
    const body = renderer?.body?.transcriptBodyRenderer?.cueGroups;
    if (!body) return [];
    
    const transcript = [];
    for (const cueGroup of body) {
      const cues = cueGroup?.transcriptCueGroupRenderer?.cues;
      if (cues) {
        for (const cue of cues) {
          const cueRenderer = cue?.transcriptCueRenderer;
          if (cueRenderer) {
            const text = cueRenderer?.cue?.simpleText;
            const startMs = cueRenderer?.startOffsetMs;
            const durationMs = cueRenderer?.durationMs;
            
            if (text && startMs !== undefined) {
              transcript.push({
                text: text.trim(),
                offset: parseInt(startMs),
                duration: durationMs ? parseInt(durationMs) : 5000
              });
            }
          }
        }
      }
    }
    
    return transcript;
  } catch (err) {
    console.log(`Failed to parse transcript renderer: ${err.message}`);
    return [];
  }
}

// Extract transcript from script content
function extractTranscriptFromScript(scriptContent: string): any[] {
  try {
    // Look for various transcript data patterns
    const patterns = [
      /"transcriptRenderer":\s*({[^}]+})/g,
      /"captions":\s*({[^}]+})/g,
      /"transcript":\s*({[^}]+})/g
    ];
    
    for (const pattern of patterns) {
      const matches = scriptContent.match(pattern);
      if (matches) {
        for (const match of matches) {
          try {
            const data = JSON.parse(match);
            const transcript = parseTranscriptRenderer(data);
            if (transcript.length > 0) {
              return transcript;
            }
          } catch (err) {
            // Continue to next match
          }
        }
      }
    }
    
    return [];
  } catch (err) {
    console.log(`Failed to extract from script: ${err.message}`);
    return [];
  }
}

// Extract transcript from captions data
function extractTranscriptFromCaptions(captionsData: any): any[] {
  try {
    const tracks = captionsData?.playerCaptionsTracklistRenderer?.captionTracks;
    if (tracks && tracks.length > 0) {
      return fetchCaptionTrack(tracks[0].baseUrl);
    }
    return [];
  } catch (err) {
    console.log(`Failed to extract from captions: ${err.message}`);
    return [];
  }
}

// Fetch caption track from URL
async function fetchCaptionTrack(baseUrl: string): Promise<any[]> {
  try {
    const response = await fetch(baseUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch caption track: ${response.status}`);
    }
    
    const xml = await response.text();
    return parseCaptionXML(xml);
  } catch (err) {
    console.log(`Failed to fetch caption track: ${err.message}`);
    return [];
  }
}

// Parse caption XML
function parseCaptionXML(xml: string): any[] {
  try {
    const transcript = [];
    const textMatches = xml.match(/<text[^>]*dur="([^"]*)"[^>]*start="([^"]*)"[^>]*>([^<]*)<\/text>/g);
    
    if (textMatches) {
      for (const match of textMatches) {
        const durMatch = match.match(/dur="([^"]*)"/);
        const startMatch = match.match(/start="([^"]*)"/);
        const textMatch = match.match(/>([^<]*)</);
        
        if (durMatch && startMatch && textMatch) {
          const duration = parseFloat(durMatch[1]) * 1000; // Convert to milliseconds
          const start = parseFloat(startMatch[1]) * 1000; // Convert to milliseconds
          const text = textMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
          
          transcript.push({
            text: text.trim(),
            offset: Math.round(start),
            duration: Math.round(duration)
          });
        }
      }
    }
    
    return transcript;
  } catch (err) {
    console.log(`Failed to parse caption XML: ${err.message}`);
    return [];
  }
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
