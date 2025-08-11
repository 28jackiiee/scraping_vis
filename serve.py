#!/usr/bin/env python3
"""
Simple web server for Adobe Stock visualization
Serves videos and thumbnails with proper CORS headers
"""

import http.server
import socketserver
import os
import mimetypes
import json
import urllib.parse
from pathlib import Path
import threading
import webbrowser
import time
import hashlib
import re
import subprocess
import requests
from urllib.parse import urlparse
import tempfile
import concurrent.futures
import random
from collections import defaultdict
from urllib.parse import urlparse

class SmartRateLimiter:
    """Smart rate limiter that only applies delays when rate limits are hit"""
    
    def __init__(self):
        self.domain_requests = defaultdict(list)
        self.rate_limited_domains = set()
        self.lock = threading.Lock()
    
    def should_delay(self, url):
        """Check if we should delay before making a request to this URL"""
        domain = urlparse(url).netloc
        
        with self.lock:
            # If this domain has been rate limited recently, add a delay
            if domain in self.rate_limited_domains:
                return True
            
            # Check recent requests to this domain
            now = time.time()
            recent_requests = [req_time for req_time in self.domain_requests[domain] 
                             if now - req_time < 60]  # Last minute
            
            # If we've made more than 10 requests to this domain in the last minute, delay
            if len(recent_requests) > 10:
                return True
            
            return False
    
    def record_request(self, url):
        """Record a request to track rate limiting"""
        domain = urlparse(url).netloc
        with self.lock:
            self.domain_requests[domain].append(time.time())
    
    def record_rate_limit(self, url):
        """Record that we hit a rate limit for this domain"""
        domain = urlparse(url).netloc
        with self.lock:
            self.rate_limited_domains.add(domain)
            # Remove from rate limited set after 5 minutes
            threading.Timer(300, lambda: self.rate_limited_domains.discard(domain)).start()
    
    def get_delay(self, url):
        """Get appropriate delay for a URL"""
        domain = urlparse(url).netloc
        
        with self.lock:
            if domain in self.rate_limited_domains:
                return random.uniform(2, 5)  # Longer delay for rate limited domains
            
            # Check recent requests
            now = time.time()
            recent_requests = [req_time for req_time in self.domain_requests[domain] 
                             if now - req_time < 60]
            
            if len(recent_requests) > 10:
                return random.uniform(0.5, 1.5)  # Short delay for high activity
            
            return 0  # No delay needed

# Global rate limiter instance
rate_limiter = SmartRateLimiter()

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()
    
    def do_GET(self):
        """Handle GET requests"""
        parsed_path = urllib.parse.urlparse(self.path)
        
        # Handle API endpoints
        if parsed_path.path == '/api/ranking-results':
            self.handle_ranking_results()
            return
        elif parsed_path.path == '/api/labels':
            self.handle_get_labels()
            return
        elif parsed_path.path == '/api/annotation-data':
            self.handle_get_annotation_data()
            return
        elif parsed_path.path == '/api/generate-thumbnails':
            self.handle_generate_thumbnails()
            return
        
        # Default file serving
        try:
            super().do_GET()
        except BrokenPipeError:
            # Client closed the connection before we finished sending the response.
            # This is common for browsers that cancel requests (e.g., when navigating away).
            # Silently ignore to avoid cluttering the logs with traceback noise.
            pass
    
    def do_POST(self):
        """Handle POST requests"""
        parsed_path = urllib.parse.urlparse(self.path)
        
        # Handle export labels endpoint
        if parsed_path.path == '/api/export-labels':
            self.handle_export_labels()
            return
        elif parsed_path.path == '/api/labels':
            self.handle_save_labels()
            return
        
        # Return 404 for other POST requests
        self.send_response(404)
        self.end_headers()
    
    def do_DELETE(self):
        """Handle DELETE requests"""
        parsed_path = urllib.parse.urlparse(self.path)
        
        if parsed_path.path == '/api/labels':
            self.handle_clear_labels()
            return
        
        # Return 404 for other DELETE requests
        self.send_response(404)
        self.end_headers()
    
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS"""
        self.send_response(200)
        self.end_headers()
    
    def get_labels_file_path(self):
        """Get the path to the labels storage file"""
        labels_dir = Path('data')
        labels_dir.mkdir(exist_ok=True)
        return labels_dir / 'video_labels.json'
    
    def handle_get_labels(self):
        """Handle GET request for video labels"""
        try:
            labels_file = self.get_labels_file_path()
            
            if labels_file.exists():
                with open(labels_file, 'r', encoding='utf-8') as f:
                    labels_data = json.load(f)
            else:
                labels_data = {}
            
            # Send success response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            self.wfile.write(json.dumps(labels_data).encode('utf-8'))
            
        except Exception as e:
            print(f"❌ Error getting labels: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            error_response = {'error': str(e)}
            self.wfile.write(json.dumps(error_response).encode('utf-8'))
    
    def handle_save_labels(self):
        """Handle POST request to save video labels"""
        try:
            # Get the content length
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                raise ValueError("No data provided")
            
            # Read the request body
            post_data = self.rfile.read(content_length)
            labels_data = json.loads(post_data.decode('utf-8'))
            
            # Save labels to file
            labels_file = self.get_labels_file_path()
            with open(labels_file, 'w', encoding='utf-8') as f:
                json.dump(labels_data, f, indent=2, ensure_ascii=False)
            
            # Send success response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            response = {'success': True, 'message': 'Labels saved successfully'}
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
            print(f"✅ Saved labels for {len(labels_data)} videos")
            
        except Exception as e:
            print(f"❌ Error saving labels: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            error_response = {'error': str(e)}
            self.wfile.write(json.dumps(error_response).encode('utf-8'))
    
    def handle_clear_labels(self):
        """Handle DELETE request to clear all video labels"""
        try:
            labels_file = self.get_labels_file_path()
            
            # Remove the labels file if it exists
            if labels_file.exists():
                labels_file.unlink()
                print("✅ Cleared all video labels")
            
            # Send success response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            response = {'success': True, 'message': 'All labels cleared successfully'}
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            print(f"❌ Error clearing labels: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            error_response = {'error': str(e)}
            self.wfile.write(json.dumps(error_response).encode('utf-8'))

    def handle_ranking_results(self):
        """Scan for ranking_results.json files and return them"""
        try:
            ranking_results = {}
            downloads_dir = Path('downloads')
            
            if downloads_dir.exists():
                # Recursively find all ranking_results.json files
                for ranking_file in downloads_dir.rglob('ranking_results.json'):
                    try:
                        with open(ranking_file, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            # Use the folder path as key
                            folder_key = str(ranking_file.parent.relative_to(downloads_dir))
                            ranking_results[folder_key] = data
                    except Exception as e:
                        print(f"Error reading {ranking_file}: {e}")
            
            # Send JSON response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            response_data = json.dumps(ranking_results, indent=2)
            self.wfile.write(response_data.encode('utf-8'))
            
        except Exception as e:
            print(f"Error handling ranking results: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            error_response = json.dumps({'error': str(e)})
            self.wfile.write(error_response.encode('utf-8'))
    
    def handle_get_annotation_data(self):
        """Scan for annotation JSON files and integrate them with scraped data"""
        try:
            combined_data = {}
            downloads_dir = Path('downloads')
            
            # First, load existing scraped data if it exists
            scraped_data_file = Path('scraped-data.json')
            if scraped_data_file.exists():
                with open(scraped_data_file, 'r', encoding='utf-8') as f:
                    combined_data = json.load(f)
            
            # Then scan for annotation JSON files in downloads directory
            if downloads_dir.exists():
                for json_file in downloads_dir.rglob('*.json'):
                    # Skip ranking_results.json and query_metadata.json files
                    if json_file.name in ['ranking_results.json', 'query_metadata.json']:
                        continue
                    
                    try:
                        with open(json_file, 'r', encoding='utf-8') as f:
                            annotation_data = json.load(f)
                        
                        # Check if this is an annotation file (has 'results' field with score data)
                        if 'results' in annotation_data and isinstance(annotation_data['results'], list):
                            if annotation_data['results'] and 'score' in annotation_data['results'][0]:
                                # Convert annotation data to our format
                                converted_data = self.convert_annotation_data(json_file, annotation_data)
                                if converted_data:
                                    # Merge into combined data
                                    category = converted_data['category']
                                    subconcept = converted_data['subconcept']
                                    
                                    if category not in combined_data:
                                        combined_data[category] = {}
                                    if subconcept not in combined_data[category]:
                                        combined_data[category][subconcept] = {'queries': []}
                                    
                                    combined_data[category][subconcept]['queries'].append(converted_data['query'])
                                    
                                    print(f"✅ Loaded annotation data: {json_file}")
                        # Also check if the file is directly an array of annotation results
                        elif isinstance(annotation_data, list) and annotation_data:
                            if 'score' in annotation_data[0] and 'video' in annotation_data[0]:
                                # Convert to the expected format
                                formatted_data = {
                                    'results': annotation_data,
                                    'time': 0  # Default time if not provided
                                }
                                # Convert annotation data to our format
                                converted_data = self.convert_annotation_data(json_file, formatted_data)
                                if converted_data:
                                    # Merge into combined data
                                    category = converted_data['category']
                                    subconcept = converted_data['subconcept']
                                    
                                    if category not in combined_data:
                                        combined_data[category] = {}
                                    if subconcept not in combined_data[category]:
                                        combined_data[category][subconcept] = {'queries': []}
                                    
                                    combined_data[category][subconcept]['queries'].append(converted_data['query'])
                                    
                                    print(f"✅ Loaded annotation data (array format): {json_file}")
                    except Exception as e:
                        print(f"Error reading annotation file {json_file}: {e}")
            
            # Send JSON response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            response_data = json.dumps(combined_data, indent=2)
            self.wfile.write(response_data.encode('utf-8'))
            
        except Exception as e:
            print(f"Error handling annotation data: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            error_response = json.dumps({'error': str(e)})
            self.wfile.write(error_response.encode('utf-8'))
    
    def convert_annotation_data(self, json_file_path, annotation_data):
        """Convert annotation JSON to our data format"""
        try:
            # Extract category and subconcept from file path
            # Example: downloads/camera movement/dolly_zoom/dolly_zoom.json
            relative_path = json_file_path.relative_to(Path('downloads'))
            path_parts = relative_path.parts
            
            if len(path_parts) < 2:
                return None
            
            category = path_parts[0]  # "camera movement"
            subconcept = path_parts[1] if len(path_parts) > 1 else path_parts[0]  # "dolly_zoom"
            file_stem = json_file_path.stem  # "dolly_zoom"
            
            # Get the first result to extract common fields
            if not annotation_data['results']:
                return None
            
            first_result = annotation_data['results'][0]
            question = first_result.get('question', '')
            label = first_result.get('label', '')
            
            # Collect all videos that need thumbnails
            videos_needing_thumbnails = []
            video_data = []
            
            for i, result in enumerate(annotation_data['results']):
                video_url = result.get('video', '')
                score = result.get('score', 0.0)
                
                # Handle None values explicitly
                if score is None:
                    score = 0.0
                
                # Extract video ID from URL (e.g., adobe_stock_11573423 from the URL)
                video_id_match = re.search(r'adobe_stock_(\d+)', video_url)
                if not video_id_match:
                    # Try to extract from other URL patterns like dolly_out/1000564187.mp4
                    video_id_match = re.search(r'/([^/]+)\.mp4$', video_url)
                    video_id = video_id_match.group(1) if video_id_match else f"annotation_{i}"
                else:
                    video_id = video_id_match.group(1)
                
                # Generate a unique ID for this video
                unique_id = hashlib.md5(f"{json_file_path}_{video_id}".encode()).hexdigest()[:8]
                
                # Extract filename from URL
                filename = video_url.split('/')[-1] if video_url else f"video_{i}.mp4"
                title = filename.replace('.mp4', '').replace('adobe_stock_', '')
                
                # Check if thumbnail already exists
                thumbnails_dir = Path('thumbnails')
                thumbnails_dir.mkdir(exist_ok=True)
                thumbnail_filename = f"{unique_id}.jpg"
                thumbnail_path = thumbnails_dir / thumbnail_filename
                
                # Store video data for later processing
                video_data.append({
                    'unique_id': unique_id,
                    'title': title,
                    'filename': filename,
                    'video_url': video_url,
                    'score': score,
                    'question': question,
                    'label': label,
                    'thumbnail_path': thumbnail_path,
                    'thumbnail_filename': thumbnail_filename
                })
                
                # Add to parallel processing if thumbnail doesn't exist and is remote
                if not thumbnail_path.exists() and video_url.startswith(('http://', 'https://')):
                    videos_needing_thumbnails.append((video_url, thumbnail_path))
            
            # Generate thumbnails in parallel for remote videos
            if videos_needing_thumbnails:
                print(f"🖼️ Generating {len(videos_needing_thumbnails)} remote thumbnails in parallel...")
                # Use smart rate limiting with more workers for better performance
                with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
                    future_to_path = {}
                    for video_url, thumbnail_path in videos_needing_thumbnails:
                        # Check if we need to delay based on smart rate limiting
                        if rate_limiter.should_delay(video_url):
                            delay = rate_limiter.get_delay(video_url)
                            if delay > 0:
                                print(f"⏰ Rate limiting: waiting {delay:.1f}s before {video_url.split('/')[-1]}")
                                time.sleep(delay)
                        
                        future = executor.submit(self.generate_thumbnail_from_remote, video_url, thumbnail_path)
                        future_to_path[future] = video_url
                    
                    # Collect results as they complete
                    for future in concurrent.futures.as_completed(future_to_path):
                        video_url = future_to_path[future]
                        try:
                            thumbnail_path = future.result()
                            print(f"✅ Generated remote thumbnail for {video_url.split('/')[-1]}")
                        except Exception as e:
                            print(f"❌ Error generating remote thumbnail for {video_url}: {e}")
            
            # Now process all videos with thumbnails ready
            videos = []
            for video_info in video_data:
                # Get thumbnail path (should already be generated or exist)
                thumbnail_path = self.generate_thumbnail(video_info['video_url'], video_info['unique_id'])
                
                video_entry = {
                    "id": video_info['unique_id'],
                    "title": video_info['title'],
                    "filename": video_info['filename'],
                    "filepath": video_info['filename'],
                    "duration": "0:00",  # Unknown duration
                    "resolution": "Unknown",
                    "fileSize": "Unknown",
                    "modified": "Unknown",
                    "tags": [],
                    "thumbnail": thumbnail_path,
                    "url": video_info['video_url'],
                    "localPath": video_info['video_url'],
                    "confidenceScore": video_info['score'],  # Add confidence score
                    "question": video_info['question'],
                    "label": video_info['label'],
                    "isAnnotation": True  # Flag to identify annotation data
                }
                
                videos.append(video_entry)
            
            # Sort videos by confidence score (highest first)
            videos.sort(key=lambda x: x['confidenceScore'], reverse=True)
            
            # Create query entry
            query_entry = {
                "query": question or f"Annotation: {file_stem}",
                "folder": str(relative_path.parent),
                "timestamp": "Annotation Data",
                "totalResults": len(videos),
                "videos": videos,
                "isAnnotation": True,
                "processingTime": annotation_data.get('time', 0)
            }
            
            return {
                'category': category,
                'subconcept': subconcept,
                'query': query_entry
            }
            
        except Exception as e:
            print(f"Error converting annotation data from {json_file_path}: {e}")
            return None
    
    def generate_thumbnail(self, video_url, unique_id):
        """Generate thumbnail for a video (local or remote)"""
        try:
            thumbnails_dir = Path('thumbnails')
            thumbnails_dir.mkdir(exist_ok=True)
            
            thumbnail_filename = f"{unique_id}.jpg"
            thumbnail_path = thumbnails_dir / thumbnail_filename
            
            # Check if thumbnail already exists
            if thumbnail_path.exists():
                return f"thumbnails/{thumbnail_filename}"
            
            # Determine if it's a remote URL or local file
            if video_url.startswith(('http://', 'https://')):
                return self.generate_thumbnail_from_remote(video_url, thumbnail_path)
            else:
                return self.generate_thumbnail_from_local(video_url, thumbnail_path)
                
        except Exception as e:
            print(f"Error generating thumbnail for {video_url}: {e}")
            return f"thumbnails/{unique_id}.jpg"  # Return path even if generation failed
    
    def generate_thumbnail_from_remote(self, video_url, thumbnail_path):
        """Generate thumbnail from remote video URL"""
        max_retries = 3
        base_delay = 2
        
        for attempt in range(max_retries):
            try:
                print(f"🖼️ Generating thumbnail from remote video: {video_url} (attempt {attempt + 1})")
                
                # Record this request for rate limiting
                rate_limiter.record_request(video_url)
                
                # Use ffmpeg to extract a frame directly from the remote URL
                cmd = [
                    'ffmpeg', '-y',  # Overwrite output file
                    '-i', video_url,  # Input URL
                    '-ss', '00:00:02',  # Seek to 2 seconds
                    '-vframes', '1',  # Extract 1 frame
                    '-vf', 'scale=300:180:force_original_aspect_ratio=decrease,pad=300:180:(ow-iw)/2:(oh-ih)/2',  # Scale and pad
                    '-q:v', '2',  # High quality
                    str(thumbnail_path)
                ]
                
                # Run ffmpeg with timeout
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
                
                if result.returncode == 0 and thumbnail_path.exists():
                    print(f"✅ Successfully generated thumbnail: {thumbnail_path}")
                    return str(thumbnail_path)
                else:
                    # Check if it's a rate limit error
                    stderr = result.stderr.lower()
                    if "429" in stderr or "too many requests" in stderr or "rate limit" in stderr:
                        rate_limiter.record_rate_limit(video_url)
                        if attempt < max_retries - 1:
                            delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
                            print(f"⏰ Rate limited, waiting {delay:.1f}s before retry...")
                            time.sleep(delay)
                            continue
                        else:
                            print(f"❌ Rate limit exceeded after {max_retries} attempts")
                    else:
                        print(f"❌ FFmpeg failed: {result.stderr}")
                    
                    return self.create_placeholder_thumbnail(thumbnail_path, video_url)
                    
            except subprocess.TimeoutExpired:
                print(f"⏰ Thumbnail generation timeout for {video_url}")
                if attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)
                    print(f"⏰ Waiting {delay}s before retry...")
                    time.sleep(delay)
                    continue
                else:
                    return self.create_placeholder_thumbnail(thumbnail_path, video_url)
            except Exception as e:
                print(f"❌ Error generating remote thumbnail: {e}")
                if attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)
                    print(f"⏰ Waiting {delay}s before retry...")
                    time.sleep(delay)
                    continue
                else:
                    return self.create_placeholder_thumbnail(thumbnail_path, video_url)
        
        return self.create_placeholder_thumbnail(thumbnail_path, video_url)
    
    def generate_thumbnail_from_local(self, video_path, thumbnail_path):
        """Generate thumbnail from local video file"""
        try:
            print(f"🖼️ Generating thumbnail from local video: {video_path}")
            
            # Check if local file exists
            if not Path(video_path).exists():
                print(f"❌ Local video file not found: {video_path}")
                return self.create_placeholder_thumbnail(thumbnail_path, video_path)
            
            cmd = [
                'ffmpeg', '-y',  # Overwrite output file
                '-i', video_path,  # Input file
                '-ss', '00:00:02',  # Seek to 2 seconds
                '-vframes', '1',  # Extract 1 frame
                '-vf', 'scale=300:180:force_original_aspect_ratio=decrease,pad=300:180:(ow-iw)/2:(oh-ih)/2',  # Scale and pad
                '-q:v', '2',  # High quality
                str(thumbnail_path)
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            
            if result.returncode == 0 and thumbnail_path.exists():
                print(f"✅ Successfully generated thumbnail: {thumbnail_path}")
                return str(thumbnail_path)
            else:
                print(f"❌ FFmpeg failed for local file: {result.stderr}")
                return self.create_placeholder_thumbnail(thumbnail_path, video_path)
                
        except Exception as e:
            print(f"❌ Error generating local thumbnail: {e}")
            return self.create_placeholder_thumbnail(thumbnail_path, video_path)
    
    def create_placeholder_thumbnail(self, thumbnail_path, video_identifier):
        """Create a simple placeholder thumbnail when FFmpeg fails"""
        try:
            from PIL import Image, ImageDraw, ImageFont
            
            # Create a simple colored rectangle as placeholder
            img = Image.new('RGB', (300, 180), color='#f0f0f0')
            draw = ImageDraw.Draw(img)
            
            # Extract some identifier for the color
            hash_color = hash(video_identifier) % 16777215  # Get a color from hash
            color = f"#{hash_color:06x}"
            
            # Fill with color
            img = Image.new('RGB', (300, 180), color=color)
            draw = ImageDraw.Draw(img)
            
            # Add play button symbol using ASCII character instead of Unicode
            draw.text((140, 80), ">", fill='white', anchor="mm")
            
            # Save the placeholder
            img.save(thumbnail_path, 'JPEG', quality=85)
            print(f"📦 Created placeholder thumbnail: {thumbnail_path}")
            return str(thumbnail_path)
            
        except Exception as e:
            print(f"❌ Error creating placeholder thumbnail: {e}")
            # Just return the path, the frontend will handle missing thumbnails
            return str(thumbnail_path)
    
    def handle_export_labels(self):
        """Handle export of labeled videos to JSON file"""
        try:
            # Get the content length
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                raise ValueError("No data provided")
            
            # Read the request body
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))
            
            query_folder = request_data.get('queryFolder', '').strip()
            export_data = request_data.get('data', {})
            
            if not query_folder or not export_data:
                raise ValueError("Missing queryFolder or data")
            
            # Create the data directory structure
            data_dir = Path('data') / query_folder
            data_dir.mkdir(parents=True, exist_ok=True)
            
            # Generate filename with timestamp
            timestamp = export_data.get('timestamp', '').replace(':', '-').replace('T', '_').split('.')[0]
            filename = f"labeled_videos_{timestamp}.json"
            file_path = data_dir / filename
            
            # Check if file already exists and append if it does
            if file_path.exists():
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        existing_data = json.load(f)
                    
                    # Append new videos to existing ones, avoiding duplicates
                    existing_ids = {video['id'] for video in existing_data.get('exported_videos', [])}
                    new_videos = [video for video in export_data['exported_videos'] 
                                if video['id'] not in existing_ids]
                    
                    if new_videos:
                        existing_data['exported_videos'].extend(new_videos)
                        existing_data['timestamp'] = export_data['timestamp']  # Update timestamp
                        export_data = existing_data
                        print(f"Appended {len(new_videos)} new videos to existing file")
                    else:
                        print("No new videos to add - all videos already exist in file")
                        
                except Exception as e:
                    print(f"Error reading existing file, creating new: {e}")
            
            # Write the JSON file
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, indent=2, ensure_ascii=False)
            
            # Send success response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            response = {
                'success': True,
                'filename': str(file_path),
                'video_count': len(export_data['exported_videos'])
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
            print(f"✅ Exported {len(export_data['exported_videos'])} videos to {file_path}")
            
        except Exception as e:
            print(f"❌ Export error: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            error_response = {'success': False, 'error': str(e)}
            self.wfile.write(json.dumps(error_response).encode('utf-8'))
    
    def handle_generate_thumbnails(self):
        """Handle bulk thumbnail generation for local videos"""
        try:
            # Get the content length
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                raise ValueError("No data provided")
            
            # Read the request body
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))
            
            video_paths = request_data.get('videoPaths', [])
            
            if not video_paths:
                raise ValueError("No video paths provided")
            
            generated_thumbnails = []
            
            # Use ThreadPoolExecutor for parallel thumbnail generation
            with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
                # Create a list to store future objects
                future_to_path = {}
                
                # Submit thumbnail generation tasks
                for video_path in video_paths:
                    if not Path(video_path).exists():
                        print(f"❌ Local video file not found: {video_path}")
                        generated_thumbnails.append({'path': video_path, 'status': 'error', 'message': 'File not found'})
                        continue
                    
                    unique_id = hashlib.md5(video_path.encode()).hexdigest()[:8]
                    future = executor.submit(self.generate_thumbnail_from_local, video_path, unique_id)
                    future_to_path[future] = video_path
                
                # Collect results as they complete
                for future in concurrent.futures.as_completed(future_to_path):
                    video_path = future_to_path[future]
                    try:
                        thumbnail_path = future.result()
                        generated_thumbnails.append({
                            'path': video_path,
                            'thumbnailPath': thumbnail_path,
                            'status': 'success'
                        })
                        print(f"✅ Generated thumbnail for {video_path}: {thumbnail_path}")
                    except Exception as e:
                        print(f"❌ Error generating thumbnail for {video_path}: {e}")
                        generated_thumbnails.append({
                            'path': video_path,
                            'status': 'error',
                            'message': str(e)
                        })
            
            # Send success response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            response = {'success': True, 'generatedThumbnails': generated_thumbnails}
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            print(f"❌ Bulk thumbnail generation error: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            error_response = {'success': False, 'error': str(e)}
            self.wfile.write(json.dumps(error_response).encode('utf-8'))
    
    def guess_type(self, path):
        """Guess the type of a file and return a tuple (type, encoding)"""
        # Add specific video mime types
        if path.endswith('.mp4'):
            return 'video/mp4', None
        elif path.endswith('.avi'):
            return 'video/x-msvideo', None
        elif path.endswith('.mov'):
            return 'video/quicktime', None
        elif path.endswith('.mkv'):
            return 'video/x-matroska', None
        elif path.endswith('.webm'):
            return 'video/webm', None
        elif path.endswith('.flv'):
            return 'video/x-flv', None
        elif path.endswith('.wmv'):
            return 'video/x-ms-wmv', None
        elif path.endswith('.jpg') or path.endswith('.jpeg'):
            return 'image/jpeg', None
        elif path.endswith('.png'):
            return 'image/png', None
        return super().guess_type(path)

def start_server(port=8000):
    """Start the web server"""
    os.chdir(Path(__file__).parent)
    
    with socketserver.TCPServer(("", port), CustomHTTPRequestHandler) as httpd:
        print(f"🌐 Web server started at http://localhost:{port}")
        print(f"📁 Serving files from: {Path.cwd()}")
        print(f"🎬 Video visualization: http://localhost:{port}/index.html")
        print(f"📹 Thumbnails: http://localhost:{port}/thumbnails/")
        print(f"🏆 Ranking API: http://localhost:{port}/api/ranking-results")
        print("\nPress Ctrl+C to stop the server")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped")

def open_browser(port=8000):
    """Open browser after a short delay"""
    time.sleep(2)
    url = f"http://localhost:{port}/index.html"
    print(f"🔗 Opening {url} in browser...")
    webbrowser.open(url)

def main():
    port = 8000
    
    # Check if port is in use
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if s.connect_ex(('localhost', port)) == 0:
            print(f"⚠️  Port {port} is already in use")
            port = 8001
            print(f"🔄 Trying port {port} instead...")
    
    # Start browser opener in background
    browser_thread = threading.Thread(target=open_browser, args=(port,))
    browser_thread.daemon = True
    browser_thread.start()
    
    # Start server
    start_server(port)

if __name__ == "__main__":
    main() 