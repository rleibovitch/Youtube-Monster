import os
import json
import tempfile
import requests
from http.server import BaseHTTPRequestHandler
from transformers import pipeline
import yt_dlp
import torch

# Define constants
NEGATIVE_SPEECH_SUBCATEGORIES = [
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
]

NEGATIVE_BEHAVIOR_SUBCATEGORIES = [
    'Bullying',
    'Harassment',
    'Drinking alcohol',
    'Violence',
    'Sexism',
]

POTENTIAL_EMOTIONS_SUBCATEGORIES = [
    'Angry',
    'Fearful/Anxious',
    'Sad',
    'Irritated/Impatient',
    'Cold/Detached',
]

def download_youtube_audio(video_id):
    """Download audio from YouTube video"""
    temp_dir = tempfile.gettempdir()
    output_path = os.path.join(temp_dir, f"{video_id}.wav")
    
    try:
        print(f"[ASR Analysis] Downloading audio for video {video_id}...")
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'wav',
                'preferredquality': '192',
            }],
            'outtmpl': output_path,
            'quiet': True,
            'no_warnings': True
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([f"https://www.youtube.com/watch?v={video_id}"])
        
        print(f"[ASR Analysis] Audio downloaded to {output_path}")
        return output_path
    except Exception as error:
        print(f"[ASR Analysis] Failed to download audio: {error}")
        raise Exception(f"Failed to download audio for video {video_id}")

def transcribe_audio(audio_path):
    """Transcribe audio using Whisper model"""
    try:
        print("[ASR Analysis] Starting transcription with Whisper model...")
        
        # Use Whisper model for transcription
        transcriber = pipeline(
            "automatic-speech-recognition",
            "openai/whisper-large-v3",
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            device="cuda" if torch.cuda.is_available() else "cpu"
        )
        
        result = transcriber(
            audio_path,
            return_timestamps=True,
            chunk_length_s=30,
            stride_length_s=5
        )
        
        print("[ASR Analysis] Transcription completed")
        
        # Convert the result to our segment format
        segments = []
        
        if 'chunks' in result:
            # Handle chunked results
            for chunk in result['chunks']:
                if 'timestamp' in chunk and 'text' in chunk:
                    segments.append({
                        'offset': int(chunk['timestamp'][0] * 1000),  # Convert to milliseconds
                        'text': chunk['text'].strip(),
                        'duration': int((chunk['timestamp'][1] - chunk['timestamp'][0]) * 1000)
                    })
        elif 'text' in result:
            # Handle single result
            segments.append({
                'offset': 0,
                'text': result['text'].strip(),
                'duration': None
            })
        
        return segments
    except Exception as error:
        print(f"[ASR Analysis] Transcription failed: {error}")
        raise Exception(f"Failed to transcribe audio: {error}")

def analyze_with_gemini(transcript_segments, sensitivity_index, max_timestamp):
    """Analyze transcript segments with Gemini AI"""
    if not os.getenv('GEMINI_API_KEY'):
        raise Exception("GEMINI_API_KEY environment variable not set")
    
    gemini_api_key = os.getenv('GEMINI_API_KEY')
    gemini_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent"
    
    analysis_events = []
    
    for i, segment in enumerate(transcript_segments):
        # Only analyze segments within the video duration
        if segment['offset'] / 1000 > max_timestamp:
            continue
        
        prompt = f"""
You are an expert AI content moderation engine. Analyze the following YouTube transcript segment for negative speech, negative behavior, or potential negative emotions. Use the sensitivity index ({sensitivity_index}) to determine how strictly to flag content (1=least sensitive, 10=most sensitive, 5=medium). Judge as if Carl Jung were a parent.

Transcript segment:
\"\"\"
{segment['text']}
\"\"\"

If you detect a negative event, respond with a JSON object with the following schema:
{{
  "category": "Negative Speech" | "Negative Behavior" | "Potential Emotions",
  "subCategory": string, // Must be one of the predefined sub-categories below
  "description": string, // Brief, neutral, one-sentence description (under 15 words)
  "phrase": string // The quoted phrase or utterance that triggered the flag
}}
If there is no negative event, respond with an empty string.

**Valid Sub-Categories (use these exact strings):**
- For "Negative Speech": {', '.join(NEGATIVE_SPEECH_SUBCATEGORIES)}
- For "Negative Behavior": {', '.join(NEGATIVE_BEHAVIOR_SUBCATEGORIES)}
- For "Potential Emotions": {', '.join(POTENTIAL_EMOTIONS_SUBCATEGORIES)}
"""
        
        try:
            headers = {
                'Content-Type': 'application/json',
            }
            
            data = {
                'contents': [{
                    'parts': [{
                        'text': prompt
                    }]
                }],
                'generationConfig': {
                    'temperature': 0.5,
                    'responseMimeType': 'application/json'
                }
            }
            
            response = requests.post(
                f"{gemini_url}?key={gemini_api_key}",
                headers=headers,
                json=data,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                ai_response = result.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
                
                if ai_response.strip() and ai_response.strip() != '""':
                    try:
                        event_obj = json.loads(ai_response.strip())
                    except json.JSONDecodeError:
                        # Try to extract JSON from markdown or text
                        import re
                        match = re.search(r'\{[\s\S]*\}', ai_response)
                        if match:
                            event_obj = json.loads(match.group(0))
                        else:
                            continue
                    
                    if (event_obj and 'category' in event_obj and 'subCategory' in event_obj and 
                        'description' in event_obj and 'phrase' in event_obj):
                        analysis_events.append({
                            'timestamp': int(segment['offset'] / 1000),
                            **event_obj,
                        })
            else:
                print(f"Gemini API error for segment {i}: {response.status_code}")
                
        except Exception as e:
            print(f"AI analysis error for segment {i}: {e}")
            # Continue to next segment
    
    return analysis_events

def cleanup_audio_file(audio_path):
    """Clean up downloaded audio file"""
    try:
        if os.path.exists(audio_path):
            os.remove(audio_path)
            print(f"[ASR Analysis] Cleaned up audio file: {audio_path}")
    except Exception as error:
        print(f"[ASR Analysis] Failed to cleanup audio file: {error}")

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Set CORS headers
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        
        if self.path != '/api/analyze-asr':
            self.wfile.write(json.dumps({'error': 'Invalid endpoint'}).encode())
            return
        
        try:
            # Read request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))
            
            video_id = request_data.get('videoId')
            sensitivity = request_data.get('sensitivity', 5)
            video_duration = request_data.get('videoDuration', 450)
            
            if not video_id:
                self.wfile.write(json.dumps({'error': "Missing 'videoId' in request body for ASR analysis."}).encode())
                return
            
            # Validate videoId format
            if not (len(video_id) == 11 and video_id.replace('-', '').replace('_', '').isalnum()):
                self.wfile.write(json.dumps({'error': "Invalid video ID format. YouTube video IDs should be 11 characters long."}).encode())
                return
            
            # Sensitivity index: 1 (least sensitive) to 10 (most sensitive), default 5
            sensitivity_index = 5
            if isinstance(sensitivity, (int, float)) and 1 <= sensitivity <= 10:
                sensitivity_index = int(sensitivity)
            
            # Use actual video duration if provided, otherwise default to 450 seconds
            max_timestamp = 450
            if isinstance(video_duration, (int, float)) and video_duration > 10:
                max_timestamp = int(video_duration)
            
            audio_path = None
            
            try:
                print(f"[ASR Analysis] Starting ASR analysis for video: {video_id}")
                
                # Step 1: Download audio
                audio_path = download_youtube_audio(video_id)
                
                # Step 2: Transcribe audio
                transcript = transcribe_audio(audio_path)
                
                if len(transcript) == 0:
                    self.wfile.write(json.dumps({'error': 'ASR transcription produced no results. The video may not contain speech or the audio quality is too poor.'}).encode())
                    return
                
                print(f"[ASR Analysis] Successfully transcribed {len(transcript)} segments using ASR")
                print(f"[ASR Analysis] Analyzing {len(transcript)} transcript segments...")
                
                # Step 3: Analyze transcript with Gemini
                analysis_events = analyze_with_gemini(transcript, sensitivity_index, max_timestamp)
                
                # Return the analysis results
                print(f"[ASR Analysis] Analysis complete. Found {len(analysis_events)} events using ASR transcription")
                
                result = {
                    'events': analysis_events,
                    'extractionMethod': 'huggingface-whisper-asr',
                    'transcriptSegmentCount': len(transcript)
                }
                
                self.wfile.write(json.dumps(result).encode())
                
            except Exception as error:
                print(f"[ASR Analysis] ASR analysis failed: {error}")
                self.wfile.write(json.dumps({'error': str(error)}).encode())
            finally:
                # Cleanup audio file
                if audio_path:
                    cleanup_audio_file(audio_path)
                    
        except Exception as error:
            print(f"[ASR Analysis] Request processing failed: {error}")
            self.wfile.write(json.dumps({'error': 'Internal server error'}).encode())
    
    def do_OPTIONS(self):
        # Handle preflight requests
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers() 