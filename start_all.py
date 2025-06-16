#!/usr/bin/env python3
"""
All-in-one startup script for Adobe Stock Visualization
Starts file monitor, web server, and opens browser
"""

import subprocess
import sys
import os
import threading
import time
from pathlib import Path

def install_requirements():
    """Install required packages"""
    try:
        print("📦 Installing dependencies...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Dependencies installed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error installing dependencies: {e}")
        return False

def check_dependencies():
    """Check if required packages are installed"""
    try:
        import watchdog
        return True
    except ImportError:
        return False

def start_file_monitor():
    """Start the file monitor in background"""
    if not check_dependencies():
        if not install_requirements():
            print("❌ Failed to install dependencies. Please install manually:")
            print("pip install watchdog")
            return False
    
    print("🔍 Starting file monitor...")
    try:
        import file_monitor
        file_monitor.main()
    except KeyboardInterrupt:
        print("🛑 File monitor stopped")
    except Exception as e:
        print(f"❌ Error starting file monitor: {e}")
        return False
    
    return True

def start_web_server():
    """Start the web server"""
    print("🌐 Starting web server...")
    try:
        import serve
        serve.main()
    except KeyboardInterrupt:
        print("🛑 Web server stopped")
    except Exception as e:
        print(f"❌ Error starting web server: {e}")
        return False
    
    return True

def create_sample_videos():
    """Create sample video structure if downloads folder is empty"""
    downloads_path = Path("/Users/jackieli/Downloads/prof_code/scraping_vis/downloads")
    
    if not downloads_path.exists() or not any(downloads_path.iterdir()):
        print("📁 Creating sample folder structure...")
        
        # Create sample folders
        sample_folders = [
            "nature_landscapes",
            "business_meeting", 
            "technology_innovation"
        ]
        
        for folder in sample_folders:
            folder_path = downloads_path / folder
            folder_path.mkdir(parents=True, exist_ok=True)
            
            # Create a placeholder file
            placeholder = folder_path / "README.txt"
            placeholder.write_text(f"Add your {folder.replace('_', ' ')} videos here!\n\nSupported formats: .mp4, .avi, .mov, .mkv, .webm, .flv, .wmv")
        
        print(f"✅ Created sample folders in {downloads_path}")
        print("   Add your video files to these folders to see them in the visualization!")

def main():
    print("🎬 === Adobe Stock Visualization Startup ===")
    print()
    
    # Create sample structure if needed
    create_sample_videos()
    
    # Check FFmpeg installation
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
        print("✅ FFmpeg found - video thumbnails will be generated")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("⚠️  FFmpeg not found - using placeholder thumbnails")
        print("   Install FFmpeg for real video thumbnails:")
        print("   • macOS: brew install ffmpeg")
        print("   • Windows: Download from https://ffmpeg.org/download.html")
        print("   • Linux: sudo apt install ffmpeg")
    
    print()
    print("🚀 Starting services...")
    print("   File Monitor: Watches downloads folder for changes")
    print("   Web Server: Serves videos and interface")
    print()
    
    try:
        # Start file monitor in a separate thread
        monitor_thread = threading.Thread(target=start_file_monitor)
        monitor_thread.daemon = True
        monitor_thread.start()
        
        # Give monitor time to start
        time.sleep(2)
        
        # Start web server (this will block)
        start_web_server()
        
    except KeyboardInterrupt:
        print("\n🛑 All services stopped")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main() 