#!/usr/bin/env python3
"""
HuggingFace Video Dataset Downloader

This script processes JSON files containing video metadata and downloads
videos from HuggingFace datasets.
"""

import os
import json
import requests
import urllib.parse
from pathlib import Path
import time
import argparse
from typing import List, Dict, Any
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class HuggingFaceVideoDownloader:
    def __init__(self, base_output_dir: str = "video_data", delay_between_downloads: float = 1.0):
        """
        Initialize the downloader.
        
        Args:
            base_output_dir: Base directory for downloads
            delay_between_downloads: Delay in seconds between downloads to be respectful
        """
        self.base_output_dir = Path(base_output_dir)
        self.delay = delay_between_downloads
        
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/octet-stream,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
        })

    def find_json_files(self, directory: str) -> List[Path]:
        """Find all JSON files in the given directory and subdirectories."""
        json_files = []
        for root, dirs, files in os.walk(directory):
            for file in files:
                if file.endswith('.json'):
                    json_files.append(Path(root) / file)
        
        logger.info(f"Found {len(json_files)} JSON files")
        return json_files
    
    def parse_json_file(self, json_path: Path) -> Dict[str, Any]:
        """Parse a JSON file and return its contents."""
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            logger.info(f"Parsed {json_path.name} - Query: {data.get('query', 'Unknown')}")
            return data
        except Exception as e:
            logger.error(f"Error parsing {json_path}: {e}")
            return {}
    
    def create_output_directory(self, folder_path: str, query: str = None) -> Path:
        """Create and return the output directory based on folder path and query."""
        # Use the folder path from JSON if available, otherwise create from query
        if folder_path:
            # Clean the folder path to be filesystem-safe
            safe_folder = folder_path.replace('/', '_').replace('\\', '_')
            output_dir = self.base_output_dir / safe_folder
        else:
            # Fallback to query-based directory
            safe_query = "".join(c for c in (query or 'unknown') if c.isalnum() or c in (' ', '-', '_')).rstrip()
            safe_query = safe_query.replace(' ', '_').lower()
            output_dir = self.base_output_dir / safe_query
        
        output_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Created output directory: {output_dir}")
        return output_dir
    
    def download_video(self, video_info: Dict[str, Any], output_path: Path) -> bool:
        """
        Download a single video from HuggingFace.
        
        Args:
            video_info: Video metadata containing URL and filename
            output_path: Directory where to save the video
            
        Returns:
            True if download was successful, False otherwise
        """
        url = video_info.get('url')
        if not url:
            logger.error(f"No URL found for video: {video_info.get('id', 'Unknown')}")
            return False
        
        filename = video_info.get('filename')
        if not filename:
            # Generate filename from title or ID
            title = video_info.get('title', video_info.get('id', 'unknown'))
            filename = f"{title}.mp4"
        
        file_path = output_path / filename
        
        # Don't download if file already exists
        if file_path.exists():
            logger.info(f"File already exists: {filename}")
            return True
        
        try:
            logger.info(f"Downloading: {filename} from {url}")
            
            response = self.session.get(url, stream=True, timeout=30)
            response.raise_for_status()
            
            # Download with progress
            total_size = int(response.headers.get('content-length', 0))
            downloaded = 0
            
            with open(file_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0:
                            progress = (downloaded / total_size) * 100
                            print(f"\rProgress: {progress:.1f}%", end='', flush=True)
            
            print()  # New line after progress
            logger.info(f"Successfully downloaded: {filename} ({downloaded} bytes)")
            return True
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error downloading {filename}: {e}")
            return False
        except Exception as e:
            logger.error(f"Error downloading {filename}: {e}")
            return False
    
    def download_thumbnail(self, video_info: Dict[str, Any], output_path: Path) -> bool:
        """
        Download thumbnail for a video if available.
        
        Args:
            video_info: Video metadata containing thumbnail path
            output_path: Directory where to save the thumbnail
            
        Returns:
            True if download was successful, False otherwise
        """
        thumbnail_path = video_info.get('thumbnail')
        if not thumbnail_path:
            return False
        
        # If thumbnail is a relative path, we need to construct the full URL
        # For now, we'll skip thumbnail downloads since we don't have the base URL
        # This could be enhanced if we know the thumbnail base URL
        logger.debug(f"Thumbnail path found but skipping download: {thumbnail_path}")
        return False
    
    def process_json_file(self, json_path: Path) -> Dict[str, int]:
        """
        Process a single JSON file and download all videos.
        
        Returns:
            Dictionary with download statistics
        """
        data = self.parse_json_file(json_path)
        if not data:
            return {"total": 0, "success": 0, "failed": 0, "skipped": 0}
        
        query = data.get('query', 'unknown_query')
        folder = data.get('folder', '')
        exported_videos = data.get('exported_videos', [])
        
        if not exported_videos:
            logger.warning(f"No exported_videos found in {json_path.name}")
            return {"total": 0, "success": 0, "failed": 0, "skipped": 0}
        
        output_dir = self.create_output_directory(folder, query)
        
        stats = {"total": len(exported_videos), "success": 0, "failed": 0, "skipped": 0}
        
        logger.info(f"Processing {len(exported_videos)} videos for query: {query}")
        
        for i, video in enumerate(exported_videos, 1):
            video_id = video.get('id')
            if not video_id:
                logger.warning(f"No video ID found for video {i} in {json_path.name}")
                stats["skipped"] += 1
                continue
            
            logger.info(f"Processing video {i}/{len(exported_videos)}: {video_id}")
            
            if self.download_video(video, output_dir):
                stats["success"] += 1
                
                # Optionally download thumbnail
                self.download_thumbnail(video, output_dir)
            else:
                stats["failed"] += 1
            
            # Rate limiting - be respectful to the server
            if i < len(exported_videos):  # Don't delay after the last download
                time.sleep(self.delay)
        
        return stats
    
    def process_directory(self, directory: str) -> None:
        """Process all JSON files in the given directory."""
        json_files = self.find_json_files(directory)
        
        if not json_files:
            logger.warning(f"No JSON files found in {directory}")
            return
        
        total_stats = {"total": 0, "success": 0, "failed": 0, "skipped": 0}
        
        for json_file in json_files:
            logger.info(f"Processing file: {json_file}")
            stats = self.process_json_file(json_file)
            
            # Aggregate stats
            for key in total_stats:
                total_stats[key] += stats[key]
            
            logger.info(f"File {json_file.name} completed: {stats}")
        
        # Final summary
        logger.info("="*50)
        logger.info("DOWNLOAD SUMMARY")
        logger.info("="*50)
        logger.info(f"Total videos: {total_stats['total']}")
        logger.info(f"Successfully downloaded: {total_stats['success']}")
        logger.info(f"Failed downloads: {total_stats['failed']}")
        logger.info(f"Skipped videos: {total_stats['skipped']}")
        
        success_rate = (total_stats['success'] / total_stats['total']) * 100 if total_stats['total'] > 0 else 0
        logger.info(f"Success rate: {success_rate:.1f}%")

def main():
    parser = argparse.ArgumentParser(description="Download videos from HuggingFace datasets based on JSON metadata files")
    
    # Create mutually exclusive group for path and folder
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument("--path", "-p", help="Path to single JSON file containing video metadata")
    input_group.add_argument("--folder", "-f", help="Path to folder containing JSON files with video metadata")
    
    parser.add_argument("--output", "-o", default="video_data", help="Base output directory (default: video_data)")
    parser.add_argument("--delay", "-d", type=float, default=1.0, help="Delay between downloads in seconds (default: 1.0)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose logging")
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Validate input path/folder
    if args.path:
        json_path = Path(args.path)
        if not json_path.exists():
            logger.error(f"JSON file not found: {args.path}")
            return 1
        
        if not json_path.suffix.lower() == '.json':
            logger.error(f"File must be a JSON file: {args.path}")
            return 1
    
    if args.folder:
        folder_path = Path(args.folder)
        if not folder_path.exists():
            logger.error(f"Folder not found: {args.folder}")
            return 1
        
        if not folder_path.is_dir():
            logger.error(f"Path is not a directory: {args.folder}")
            return 1
    
    downloader = HuggingFaceVideoDownloader(args.output, args.delay)
    
    # Process either single file or folder
    if args.path:
        # Process single JSON file
        logger.info(f"Processing single JSON file: {json_path}")
        stats = downloader.process_json_file(json_path)
        
        # Display final summary
        logger.info("="*50)
        logger.info("DOWNLOAD SUMMARY")
        logger.info("="*50)
        logger.info(f"Total videos: {stats['total']}")
        logger.info(f"Successfully downloaded: {stats['success']}")
        logger.info(f"Failed downloads: {stats['failed']}")
        logger.info(f"Skipped videos: {stats['skipped']}")
        
        success_rate = (stats['success'] / stats['total']) * 100 if stats['total'] > 0 else 0
        logger.info(f"Success rate: {success_rate:.1f}%")
        
    elif args.folder:
        # Process folder of JSON files
        logger.info(f"Processing folder: {folder_path}")
        downloader.process_directory(str(folder_path))
    
    return 0

if __name__ == "__main__":
    exit(main()) 