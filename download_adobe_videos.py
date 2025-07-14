#!/usr/bin/env python3
"""
Adobe Stock Video Downloader

This script processes JSON files containing video metadata and downloads
watermarked videos from Adobe Stock using their API endpoint.
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

# Selenium imports for browser automation
try:
    from selenium import webdriver
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import TimeoutException, WebDriverException
    SELENIUM_AVAILABLE = True
except ImportError:
    SELENIUM_AVAILABLE = False
    print("Warning: Selenium not installed. Install with: pip install selenium")
    print("Browser authentication will not be available.")

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class AdobeVideoDownloader:
    def __init__(self, base_output_dir: str = "video_data", delay_between_downloads: float = 1.0, use_auth: bool = True):
        """
        Initialize the downloader.
        
        Args:
            base_output_dir: Base directory for downloads
            delay_between_downloads: Delay in seconds between downloads to be respectful
            use_auth: Whether to use browser-based authentication (default: True)
        """
        self.base_output_dir = Path(base_output_dir)
        self.delay = delay_between_downloads
        self.use_auth = use_auth
        self.authenticated = False
        self.cookies_file = Path("adobe_stock_cookies.json")
        
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
        })
        
        # Try to load existing cookies if authentication is requested
        if self.use_auth:
            self.load_cookies()
    
    def authenticate_with_browser(self) -> bool:
        """
        Open a browser for user to log in to Adobe Stock manually.
        Extract cookies after successful login.
        
        Returns:
            True if authentication successful, False otherwise
        """
        if not SELENIUM_AVAILABLE:
            logger.error("Selenium not available. Install with: pip install selenium")
            return False
        
        logger.info("Opening browser for Adobe Stock login...")
        
        # Set up Chrome options
        chrome_options = Options()
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        # Try to start Chrome browser
        try:
            service = Service()  # Will use system chromedriver if available
            driver = webdriver.Chrome(service=service, options=chrome_options)
            
            # Execute script to remove webdriver property
            driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
        except WebDriverException as e:
            logger.error(f"Failed to start Chrome browser: {e}")
            logger.info("Make sure Chrome and chromedriver are installed.")
            logger.info("Install chromedriver: brew install chromedriver (macOS) or download from https://chromedriver.chromium.org/")
            return False
        
        try:
            # Navigate to Adobe Stock login page
            login_url = "https://stock.adobe.com/contributor"
            logger.info(f"Navigating to {login_url}")
            driver.get(login_url)
            
            # Wait a moment for page to load
            time.sleep(3)
            
            print("\n" + "="*60)
            print("🌐 BROWSER OPENED FOR ADOBE STOCK LOGIN")
            print("="*60)
            print("1. Complete your login in the browser window")
            print("2. Navigate to any Adobe Stock page (e.g., search for videos)")
            print("3. Make sure you're fully logged in")
            print("4. Press ENTER here when you're done logging in...")
            print("="*60)
            
            # Wait for user to complete login
            input("Press ENTER after logging in: ")
            
            # Get current URL to verify login
            current_url = driver.current_url
            logger.info(f"Current URL: {current_url}")
            
            # Extract cookies from browser
            selenium_cookies = driver.get_cookies()
            
            if not selenium_cookies:
                logger.warning("No cookies found. Make sure you're logged in.")
                return False
            
            # Convert selenium cookies to requests format
            cookies_dict = {}
            for cookie in selenium_cookies:
                if cookie['domain'] in ['.adobe.com', 'stock.adobe.com', '.stock.adobe.com']:
                    cookies_dict[cookie['name']] = cookie['value']
            
            logger.info(f"Extracted {len(cookies_dict)} Adobe cookies")
            
            # Save cookies to file
            self.save_cookies(cookies_dict)
            
            # Update session with cookies
            self.session.cookies.update(cookies_dict)
            
            # Test authentication by accessing a protected page
            test_response = self.session.get("https://stock.adobe.com/search")
            if test_response.status_code == 200:
                self.authenticated = True
                logger.info("✅ Authentication successful!")
                print("\n✅ Authentication successful! You can now close the browser.")
            else:
                logger.warning("Authentication may have failed. Will attempt downloads anyway.")
                self.authenticated = True  # Try anyway
            
            return True
            
        except Exception as e:
            logger.error(f"Error during browser authentication: {e}")
            return False
            
        finally:
            # Close browser
            try:
                driver.quit()
            except:
                pass

    def load_cookies(self) -> bool:
        """
        Load saved cookies from file.
        
        Returns:
            True if cookies loaded successfully, False otherwise
        """
        if not self.cookies_file.exists():
            logger.info("No saved cookies found. Browser authentication will be required.")
            return False
        
        try:
            with open(self.cookies_file, 'r') as f:
                cookies = json.load(f)
            
            self.session.cookies.update(cookies)
            logger.info(f"✅ Loaded {len(cookies)} saved cookies from {self.cookies_file}")
            
            # Test if the loaded cookies are still valid
            logger.info("Testing if saved cookies are still valid...")
            if self._test_authentication():
                self.authenticated = True
                logger.info("✅ Saved cookies are valid. Authentication successful!")
                return True
            else:
                logger.warning("⚠️ Saved cookies appear to be expired or invalid.")
                logger.info("Browser authentication will be required to refresh credentials.")
                self.authenticated = False
                return False
            
        except Exception as e:
            logger.error(f"Error loading cookies: {e}")
            logger.info("Browser authentication will be required.")
            return False

    def _test_authentication(self) -> bool:
        """
        Internal method to test if current session is authenticated.
        
        Returns:
            True if authenticated, False otherwise
        """
        try:
            # Test with the actual download endpoint to see if we get an auth error
            test_video_id = "123456789"  # This will fail, but we're checking the error type
            test_url = f"https://stock.adobe.com/Download/Watermarked/{test_video_id}"
            response = self.session.head(test_url, timeout=10)
            
            # If we get a 404, that means we reached the download system (authenticated)
            # If we get a 401/403, that means we're not authenticated
            # If we get a 200, we might be authenticated (though the video ID is fake)
            if response.status_code in [200, 404]:
                return True
            elif response.status_code in [401, 403]:
                return False
            else:
                # For other status codes, try a different approach
                # Check if we can access the Adobe Stock main page and look for login indicators
                main_response = self.session.get("https://stock.adobe.com/", timeout=10)
                if main_response.status_code == 200:
                    # Look for signs that we're logged in (this is a simple check)
                    page_content = main_response.text.lower()
                    if 'sign in' in page_content or 'log in' in page_content:
                        # Page contains sign in links, probably not logged in
                        return False
                    else:
                        # No obvious sign in links, might be logged in
                        return True
                else:
                    return False
                
        except requests.RequestException as e:
            logger.debug(f"Authentication test failed with network error: {e}")
            return False

    def is_authenticated(self) -> bool:
        """
        Check if user is authenticated by testing access to Adobe Stock.
        
        Returns:
            True if authenticated, False otherwise
        """
        # If we haven't loaded cookies and auth is enabled, we're not authenticated
        if self.use_auth and not self.authenticated:
            return False
        
        # If auth is disabled, assume we can proceed
        if not self.use_auth:
            return True
            
        # If we think we're authenticated, test it to make sure
        if self.authenticated:
            return self._test_authentication()
        
        return False
    
    def save_cookies(self, cookies: dict) -> bool:
        """
        Save cookies to file.
        
        Args:
            cookies: Dictionary of cookies to save
            
        Returns:
            True if saved successfully, False otherwise
        """
        try:
            with open(self.cookies_file, 'w') as f:
                json.dump(cookies, f, indent=2)
            
            logger.debug(f"Saved {len(cookies)} cookies to {self.cookies_file}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving cookies: {e}")
            return False

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
    
    def create_output_directory(self, query: str) -> Path:
        """Create and return the output directory for a given query."""
        # Clean the query name to be filesystem-safe
        safe_query = "".join(c for c in query if c.isalnum() or c in (' ', '-', '_')).rstrip()
        safe_query = safe_query.replace(' ', '_').lower()
        
        output_dir = self.base_output_dir / safe_query
        output_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Created output directory: {output_dir}")
        return output_dir
    
    def download_video(self, video_id: str, output_path: Path, video_info: Dict[str, Any]) -> bool:
        """
        Download a single video from Adobe Stock.
        
        Args:
            video_id: The Adobe Stock video ID
            output_path: Where to save the video
            video_info: Video metadata for logging
            
        Returns:
            True if download was successful, False otherwise
        """
        url = f"https://stock.adobe.com/Download/Watermarked/{video_id}"
        
        try:
            logger.info(f"Downloading video {video_id}: {video_info.get('title', 'Unknown title')[:50]}...")
            
            response = self.session.get(url, stream=True, timeout=30)
            response.raise_for_status()
            
            # Get file extension from content-type or default to mp4
            content_type = response.headers.get('content-type', '')
            if 'video/mp4' in content_type:
                extension = '.mp4'
            elif 'video/quicktime' in content_type:
                extension = '.mov'
            else:
                extension = '.mp4'  # Default fallback
            
            # Create filename from video info or use video ID
            if 'filename' in video_info:
                filename = video_info['filename']
            else:
                safe_title = "".join(c for c in video_info.get('title', video_id) if c.isalnum() or c in (' ', '-', '_'))[:100]
                filename = f"{safe_title.replace(' ', '_')}{extension}"
            
            file_path = output_path / filename
            
            # Don't download if file already exists
            if file_path.exists():
                logger.info(f"File already exists: {filename}")
                return True
            
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
            logger.error(f"Network error downloading video {video_id}: {e}")
            return False
        except Exception as e:
            logger.error(f"Error downloading video {video_id}: {e}")
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
        exported_videos = data.get('exported_videos', [])
        
        if not exported_videos:
            logger.warning(f"No exported_videos found in {json_path.name}")
            return {"total": 0, "success": 0, "failed": 0, "skipped": 0}
        
        output_dir = self.create_output_directory(query)
        
        stats = {"total": len(exported_videos), "success": 0, "failed": 0, "skipped": 0}
        
        for i, video in enumerate(exported_videos, 1):
            video_id = video.get('id')
            if not video_id:
                logger.warning(f"No video ID found for video {i} in {json_path.name}")
                stats["skipped"] += 1
                continue
            
            logger.info(f"Processing video {i}/{len(exported_videos)}: {video_id}")
            
            if self.download_video(video_id, output_dir, video):
                stats["success"] += 1
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
    parser = argparse.ArgumentParser(description="Download videos from Adobe Stock based on JSON metadata files")
    
    # Create mutually exclusive group for path and folder
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument("--path", "-p", help="Path to single JSON file containing video metadata")
    input_group.add_argument("--folder", "-f", help="Path to folder containing JSON files with video metadata")
    
    parser.add_argument("--output", "-o", default="video_data", help="Base output directory (default: video_data)")
    parser.add_argument("--delay", "-d", type=float, default=1.0, help="Delay between downloads in seconds (default: 1.0)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose logging")
    parser.add_argument("--no-auth", action="store_true", help="Disable browser-based authentication (default: False)")
    
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
    
    downloader = AdobeVideoDownloader(args.output, args.delay, not args.no_auth)
    
    if not downloader.is_authenticated():
        if downloader.use_auth:
            logger.info("🔐 Authentication required. Attempting browser authentication...")
            if downloader.authenticate_with_browser():
                logger.info("✅ Browser authentication successful. Proceeding with downloads.")
            else:
                logger.error("❌ Browser authentication failed. Exiting.")
                return 1
        else:
            logger.warning("⚠️ Browser authentication is disabled. Please ensure you are logged in to Adobe Stock manually.")
            logger.warning("You will need to provide cookies or use --no-auth to disable this warning.")
    else:
        if downloader.use_auth:
            logger.info("✅ Authentication confirmed. Proceeding with downloads.")
        else:
            logger.info("Authentication disabled. Proceeding without login.")
    
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