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
import concurrent.futures

class VideoFileHandler(FileSystemEventHandler):
    def __init__(self, downloads_path, output_file):
        self.downloads_path = Path(downloads_path)
        self.output_file = output_file
        self.last_update = 0
        self.thumbnails_dir = Path("thumbnails")
        self.thumbnails_dir.mkdir(exist_ok=True)
        
    def get_category_and_subconcept(self, query_folder_name):
        """
        Dynamically determine category and subconcept based on folder structure.
        
        Structure:
        downloads/
        ├── Category/
        │   ├── Subconcept/
        │   │   └── query_folder/
        │   └── ...
        └── query_folder/  (top-level, uncategorized)
        """
        # Check if this query exists in a nested structure
        for category_folder in self.downloads_path.iterdir():
            if category_folder.is_dir() and not category_folder.name.startswith('.'):
                # Check if this is a category folder (contains subconcept folders)
                for subconcept_folder in category_folder.iterdir():
                    if subconcept_folder.is_dir() and not subconcept_folder.name.startswith('.'):
                        # Check if our query folder exists in this subconcept
                        query_path = subconcept_folder / query_folder_name
                        if query_path.exists() and query_path.is_dir():
                            return category_folder.name, subconcept_folder.name
        
        # If not found in nested structure, treat as uncategorized
        return "Uncategorized", query_folder_name.replace('_', ' ').replace('-', ' ').title()
        
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
        """Scan Downloads folder and create hierarchical data structure"""
        result = {}
        
        if not self.downloads_path.exists():
            print(f"Downloads path does not exist: {self.downloads_path}")
            return result
        
        # Collect all query folders and their paths
        query_folders = []
        
        # First, scan for nested structure (Category/Subconcept/Query)
        for category_folder in self.downloads_path.iterdir():
            if category_folder.is_dir() and not category_folder.name.startswith('.'):
                # Check if this folder contains subconcept folders
                has_subconcepts = False
                for subconcept_folder in category_folder.iterdir():
                    if subconcept_folder.is_dir() and not subconcept_folder.name.startswith('.'):
                        # Check if this subconcept contains query folders
                        for query_folder in subconcept_folder.iterdir():
                            if query_folder.is_dir() and not query_folder.name.startswith('.'):
                                videos = self.scan_query_folder(query_folder)
                                if videos:  # Only add if we found videos
                                    query_folders.append({
                                        'path': query_folder,
                                        'name': query_folder.name,
                                        'category': category_folder.name,
                                        'subconcept': subconcept_folder.name,
                                        'videos': videos
                                    })
                                    has_subconcepts = True
                
                # If no subconcepts found, treat this category folder as a direct query folder
                if not has_subconcepts:
                    videos = self.scan_query_folder(category_folder)
                    if videos:  # Only add if we found videos
                        query_folders.append({
                            'path': category_folder,
                            'name': category_folder.name,
                            'category': "Uncategorized",
                            'subconcept': category_folder.name.replace('_', ' ').replace('-', ' ').title(),
                            'videos': videos
                        })
        
        # Build the result structure
        for query_data in query_folders:
            category = query_data['category']
            subconcept = query_data['subconcept']
            
            # Initialize category if not exists
            if category not in result:
                result[category] = {}
            
            # Initialize subconcept if not exists
            if subconcept not in result[category]:
                result[category][subconcept] = {
                    "queries": []
                }
            
            # Add query to subconcept
            formatted_query = query_data['name'].replace('_', ' ').replace('-', ' ').title()
            query_info = {
                "query": formatted_query,
                "folder": query_data['name'],
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "totalResults": len(query_data['videos']),
                "videos": query_data['videos']
            }
            
            result[category][subconcept]["queries"].append(query_info)
                    
        return result

    def scan_query_folder(self, query_folder):
        """Scan a query folder for video files"""
        videos = []
        video_extensions = {'.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv'}
        
        # Collect all video files first
        video_files = []
        for file_path in query_folder.rglob('*'):
            if file_path.is_file() and file_path.suffix.lower() in video_extensions:
                video_files.append(file_path)
        
        # Generate thumbnails in parallel
        self.generate_thumbnails_parallel(video_files)
        
        # Now extract video info (thumbnails should be ready)
        for file_path in video_files:
            video_info = self.extract_video_info(file_path, query_folder)
            videos.append(video_info)
                
        return sorted(videos, key=lambda x: x['title'])

    def generate_thumbnails_parallel(self, video_files):
        """Generate thumbnails for multiple videos in parallel"""
        if not video_files:
            return
        
        # Filter out videos that already have thumbnails
        videos_needing_thumbnails = []
        for file_path in video_files:
            # Generate file ID
            metadata_mappings = self.load_query_metadata(file_path.parent)
            adobe_stock_id = self.get_adobe_stock_id(file_path, metadata_mappings)
            if adobe_stock_id:
                file_id = adobe_stock_id
            else:
                file_id = hashlib.md5(str(file_path).encode()).hexdigest()[:8]
            
            thumbnail_filename = f"{file_id}.jpg"
            thumbnail_path = self.thumbnails_dir / thumbnail_filename
            
            # Only generate if thumbnail doesn't exist
            if not thumbnail_path.exists():
                videos_needing_thumbnails.append((file_path, thumbnail_path))
        
        if not videos_needing_thumbnails:
            return
        
        print(f"🖼️ Generating {len(videos_needing_thumbnails)} thumbnails in parallel...")
        
        # Use ThreadPoolExecutor for parallel thumbnail generation
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            # Submit thumbnail generation tasks
            future_to_path = {}
            for file_path, thumbnail_path in videos_needing_thumbnails:
                future = executor.submit(self.generate_thumbnail, file_path, thumbnail_path)
                future_to_path[future] = file_path
            
            # Collect results as they complete
            for future in concurrent.futures.as_completed(future_to_path):
                file_path = future_to_path[future]
                try:
                    success = future.result()
                    if success:
                        print(f"✅ Generated thumbnail for {file_path.name}")
                    else:
                        print(f"❌ Failed to generate thumbnail for {file_path.name}")
                except Exception as e:
                    print(f"❌ Error generating thumbnail for {file_path.name}: {e}")

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

    def load_query_metadata(self, query_folder):
        """Load query metadata from query_metadata.json if it exists"""
        metadata_path = query_folder / 'query_metadata.json'
        if metadata_path.exists():
            try:
                with open(metadata_path, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
                    return metadata.get('video_file_mappings', {})
            except (json.JSONDecodeError, FileNotFoundError, UnicodeDecodeError) as e:
                print(f"Error loading metadata from {metadata_path}: {e}")
        return {}

    def get_adobe_stock_id(self, file_path, metadata_mappings):
        """Get Adobe Stock ID from metadata mappings based on filename"""
        filename = file_path.name
        filename_stem = file_path.stem
        
        # Try exact filename match first
        for adobe_id, info in metadata_mappings.items():
            if info.get('filename') == filename:
                return adobe_id
        
        # Try filename without extension match
        for adobe_id, info in metadata_mappings.items():
            mapping_filename = info.get('filename', '')
            mapping_stem = mapping_filename.replace('.mp4', '').replace('.mov', '').replace('.avi', '')
            if mapping_stem == filename_stem:
                return adobe_id
        
        # Try partial filename match (more flexible)
        for adobe_id, info in metadata_mappings.items():
            mapping_filename = info.get('filename', '').lower()
            if filename.lower() in mapping_filename or mapping_filename in filename.lower():
                return adobe_id
        
        return None

    def extract_video_info(self, file_path, query_folder):
        """Extract video information from file"""
        relative_path = file_path.relative_to(query_folder)
        file_name = file_path.stem
        
        # Load query metadata to get actual Adobe Stock IDs
        metadata_mappings = self.load_query_metadata(query_folder)
        
        # Try to get Adobe Stock ID from metadata, fallback to hash ID
        adobe_stock_id = self.get_adobe_stock_id(file_path, metadata_mappings)
        if adobe_stock_id:
            file_id = adobe_stock_id
        else:
            # Generate a unique ID based on file path as fallback
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
        # Format title: replace all underscores with spaces
        filename_stem = file_path.stem  # Get filename without extension
        title = filename_stem.replace('_', ' ')
        
        # Get video information using ffprobe
        video_info = self.get_video_info(file_path)

        duration = video_info.get('duration', self.extract_duration_from_filename(file_name))
        resolution = video_info.get('resolution', self.extract_resolution_from_filename(file_name))
        
        # Check if thumbnail exists (should have been generated in parallel)
        thumbnail_filename = f"{file_id}.jpg"
        thumbnail_path = self.thumbnails_dir / thumbnail_filename
        thumbnail_url = None
        
        if thumbnail_path.exists():
            thumbnail_url = f"thumbnails/{thumbnail_filename}"
        
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
        # Return empty list - tags are removed per user request
        return []

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