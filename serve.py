#!/usr/bin/env python3
"""
Simple web server for Adobe Stock visualization
Serves videos and thumbnails with proper CORS headers
"""

import http.server
import socketserver
import os
import mimetypes
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