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

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()
    
    def do_GET(self):
        """Handle GET requests"""
        parsed_path = urllib.parse.urlparse(self.path)
        
        # Handle API endpoints
        if parsed_path.path == '/api/ranking-results':
            self.handle_ranking_results()
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
        
        # Return 404 for other POST requests
        self.send_response(404)
        self.end_headers()
    
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