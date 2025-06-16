#!/usr/bin/env python3
"""
Adobe Stock Scraping File Monitor
Monitors Downloads folder structure and generates JSON for web visualization
"""

import os
import json
import time
import hashlib
import subprocess
from datetime import datetime
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class VideoFileHandler(FileSystemEventHandler):
    def __init__(self, downloads_path, output_file):
        self.downloads_path = Path(downloads_path)
        self.output_file = output_file
        self.last_update = 0
        self.thumbnails_dir = Path("thumbnails")
        self.thumbnails_dir.mkdir(exist_ok=True)
        
    def on_any_event(self, event):
        # Debounce: only update once per second
        current_time = time.time()
        if current_time - self.last_update < 1:
            return
        
        self.last_update = current_time
        print(f"File system change detected: {event.event_type} - {event.src_path}")
        self.generate_json()

    def generate_json(self):
        """Generate JSON from the Downloads folder structure"""
        try:
            data = self.scan_downloads_folder()
            with open(self.output_file, 'w') as f:
                json.dump(data, f, indent=2)
            print(f"Updated {self.output_file} with {len(data)} queries")
        except Exception as e:
            print(f"Error generating JSON: {e}")

    def scan_downloads_folder(self):
        """Scan Downloads folder and create data structure"""
        result = {}
        
        if not self.downloads_path.exists():
            print(f"Downloads path does not exist: {self.downloads_path}")
            return result
            
        # Look for query folders in Downloads
        for query_folder in self.downloads_path.iterdir():
            if query_folder.is_dir() and not query_folder.name.startswith('.'):
                query_name = query_folder.name
                videos = self.scan_query_folder(query_folder)
                
                if videos:  # Only add if we found videos
                    result[query_name] = {
                        "query": query_name,
                        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "totalResults": len(videos),
                        "videos": videos
                    }
                    
        return result

    def scan_query_folder(self, query_folder):
        """Scan a query folder for video files"""
        videos = []
        video_extensions = {'.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv'}
        
        for file_path in query_folder.rglob('*'):
            if file_path.is_file() and file_path.suffix.lower() in video_extensions:
                video_info = self.extract_video_info(file_path, query_folder)
                videos.append(video_info)
                
        return sorted(videos, key=lambda x: x['title'])

    def generate_thumbnail(self, video_path, output_path):
        """Generate thumbnail from video using ffmpeg"""
        try:
            # Check if ffmpeg is available
            subprocess.run(['ffmpeg', '-version'], 
                         capture_output=True, check=True)
            
            # Generate thumbnail at 2 second mark
            cmd = [
                'ffmpeg', '-i', str(video_path),
                '-ss', '00:00:02',  # Seek to 2 seconds
                '-vframes', '1',     # Extract 1 frame
                '-vf', 'scale=300:180:force_original_aspect_ratio=decrease,pad=300:180:(ow-iw)/2:(oh-ih)/2',
                '-y',  # Overwrite output file
                str(output_path)
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                return True
            else:
                print(f"FFmpeg error: {result.stderr}")
                return False
                
        except (subprocess.CalledProcessError, FileNotFoundError):
            # FFmpeg not available, return False
            return False

    def get_video_info(self, video_path):
        """Get video information using ffprobe"""
        try:
            cmd = [
                'ffprobe', '-v', 'quiet',
                '-print_format', 'json',
                '-show_format', '-show_streams',
                str(video_path)
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                data = json.loads(result.stdout)
                
                # Extract video stream info
                video_stream = None
                for stream in data.get('streams', []):
                    if stream.get('codec_type') == 'video':
                        video_stream = stream
                        break
                
                info = {}
                
                # Get duration
                if 'format' in data and 'duration' in data['format']:
                    duration_seconds = float(data['format']['duration'])
                    minutes = int(duration_seconds // 60)
                    seconds = int(duration_seconds % 60)
                    info['duration'] = f"{minutes}:{seconds:02d}"
                else:
                    info['duration'] = "0:00"
                
                # Get resolution
                if video_stream:
                    width = video_stream.get('width', 0)
                    height = video_stream.get('height', 0)
                    if height >= 2160:
                        info['resolution'] = '4K'
                    elif height >= 1080:
                        info['resolution'] = '1080p'
                    elif height >= 720:
                        info['resolution'] = '720p'
                    elif height > 0:
                        info['resolution'] = f"{height}p"
                    else:
                        info['resolution'] = 'Unknown'
                else:
                    info['resolution'] = 'Unknown'
                
                return info
                
        except (subprocess.CalledProcessError, FileNotFoundError, json.JSONDecodeError):
            pass
        
        return {'duration': '0:00', 'resolution': 'Unknown'}

    def extract_video_info(self, file_path, query_folder):
        """Extract video information from file"""
        relative_path = file_path.relative_to(query_folder)
        file_name = file_path.stem
        
        # Generate a unique ID based on file path
        file_id = hashlib.md5(str(file_path).encode()).hexdigest()[:8]
        
        # Try to get file stats
        try:
            stats = file_path.stat()
            file_size = stats.st_size
            modified_time = datetime.fromtimestamp(stats.st_mtime)
        except:
            file_size = 0
            modified_time = datetime.now()
        
        # Extract basic info from filename
        title = file_name.replace('_', ' ').replace('-', ' ').title()
        
        # Get video information using ffprobe
        video_info = self.get_video_info(file_path)
        duration = video_info.get('duration', self.extract_duration_from_filename(file_name))
        resolution = video_info.get('resolution', self.extract_resolution_from_filename(file_name))
        
        # Generate thumbnail
        thumbnail_filename = f"{file_id}.jpg"
        thumbnail_path = self.thumbnails_dir / thumbnail_filename
        thumbnail_url = None
        
        if self.generate_thumbnail(file_path, thumbnail_path):
            thumbnail_url = f"thumbnails/{thumbnail_filename}"
            print(f"Generated thumbnail: {thumbnail_url}")
        
        # Generate tags from folder structure and filename
        tags = self.generate_tags(file_path, query_folder)
        
        # Create relative URL for serving through web server
        relative_video_path = file_path.relative_to(self.downloads_path.parent)
        
        return {
            "id": file_id,
            "title": title,
            "filename": file_path.name,
            "filepath": str(relative_path),
            "duration": duration,
            "resolution": resolution,
            "fileSize": self.format_file_size(file_size),
            "modified": modified_time.strftime("%Y-%m-%d %H:%M:%S"),
            "tags": tags,
            "thumbnail": thumbnail_url,
            "url": str(relative_video_path),
            "localPath": str(file_path.absolute())
        }

    def extract_duration_from_filename(self, filename):
        """Try to extract duration from filename patterns"""
        import re
        
        # Look for patterns like "30s", "1m30s", "2min", etc.
        duration_patterns = [
            r'(\d+)m(\d+)s',  # 1m30s
            r'(\d+)min',      # 2min
            r'(\d+)s',        # 30s
            r'(\d{1,2}):(\d{2})'  # 1:30
        ]
        
        for pattern in duration_patterns:
            match = re.search(pattern, filename.lower())
            if match:
                groups = match.groups()
                if len(groups) == 2:
                    if ':' in pattern:
                        return f"{groups[0]}:{groups[1]}"
                    else:
                        return f"{groups[0]}:{groups[1].zfill(2)}"
                elif len(groups) == 1:
                    if 'min' in pattern:
                        return f"{groups[0]}:00"
                    else:
                        return f"0:{groups[0].zfill(2)}"
        
        return "0:00"  # Default duration

    def extract_resolution_from_filename(self, filename):
        """Try to extract resolution from filename"""
        import re
        
        # Common resolution patterns
        resolution_patterns = [
            r'4k', r'2160p', r'1080p', r'720p', r'480p', r'360p',
            r'uhd', r'hd', r'fhd'
        ]
        
        filename_lower = filename.lower()
        for pattern in resolution_patterns:
            if re.search(pattern, filename_lower):
                if pattern in ['4k', 'uhd', '2160p']:
                    return '4K'
                elif pattern in ['1080p', 'fhd']:
                    return '1080p'
                elif pattern == '720p':
                    return '720p'
                elif pattern == 'hd':
                    return 'HD'
                else:
                    return pattern.upper()
        
        return 'Unknown'

    def generate_tags(self, file_path, query_folder):
        """Generate tags from folder structure and filename"""
        tags = []
        
        # Add query folder name as primary tag
        query_name = query_folder.name.lower()
        tags.extend(query_name.split())
        
        # Add subfolder names as tags
        relative_path = file_path.relative_to(query_folder)
        for parent in relative_path.parents:
            if parent != Path('.'):
                folder_tags = parent.name.lower().split()
                tags.extend(folder_tags)
        
        # Add filename-based tags
        filename_tags = file_path.stem.lower().replace('_', ' ').replace('-', ' ').split()
        
        # Filter out common non-descriptive words
        stop_words = {'video', 'clip', 'stock', 'adobe', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'entire', 'complete', 'full'}
        
        for tag in filename_tags:
            if len(tag) > 2 and tag not in stop_words:
                tags.append(tag)
        
        # Remove duplicates and return first 8 tags
        unique_tags = list(dict.fromkeys(tags))[:8]
        return [tag.capitalize() for tag in unique_tags]

    def format_file_size(self, size_bytes):
        """Format file size in human readable format"""
        if size_bytes == 0:
            return "0 B"
        
        size_names = ["B", "KB", "MB", "GB"]
        i = 0
        while size_bytes >= 1024 and i < len(size_names) - 1:
            size_bytes /= 1024
            i += 1
        
        return f"{size_bytes:.1f} {size_names[i]}"

def main():
    # Configuration
    downloads_path = "/Users/jackieli/Downloads/prof_code/scraping_vis/downloads"
    output_file = "scraped-data.json"
    
    print(f"Adobe Stock File Monitor")
    print(f"Monitoring: {downloads_path}")
    print(f"Output file: {output_file}")
    print(f"Expected structure: Downloads/query_name/video_files")
    
    # Check for ffmpeg
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
        print("✅ FFmpeg found - will generate video thumbnails")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("⚠️  FFmpeg not found - using placeholder thumbnails")
        print("   Install FFmpeg for video thumbnails: https://ffmpeg.org/download.html")
    
    print("-" * 50)
    
    # Create handler
    handler = VideoFileHandler(downloads_path, output_file)
    
    # Generate initial JSON
    print("Generating initial data...")
    handler.generate_json()
    
    # Set up file system monitoring
    observer = Observer()
    observer.schedule(handler, str(downloads_path), recursive=True)
    observer.start()
    
    print("File monitoring started. Press Ctrl+C to stop.")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        print("\nFile monitoring stopped.")
    
    observer.join()

if __name__ == "__main__":
    main() 