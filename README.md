# Adobe Stock Scraping Visualization

A comprehensive web application for organizing, visualizing, and analyzing scraped video content from Adobe Stock. This tool provides an intuitive interface to browse videos, generate thumbnails, rank content, and export labeled datasets for machine learning applications.

## 🚀 Features

### Video Management System
- **Automatic Video Discovery**: Monitors Downloads folder for new video files using real-time file system watching
- **Thumbnail Generation**: Automatically creates video thumbnails using FFmpeg for quick preview
- **Hierarchical Organization**: Category → Subconcept → Query folder structure for systematic content organization  
- **Multiple Video Formats**: Supports .mp4, .avi, .mov, .mkv, .webm, .flv, .wmv files
- **Real-time Updates**: Automatically detects new videos and updates display without manual refresh

### Interactive Web Interface
- **Modern Responsive UI**: Clean, intuitive interface for browsing large video collections
- **Video Modal Player**: Full-screen video viewing with navigation controls and metadata display
- **Search & Filter System**: Browse videos by category, subconcept, and query with instant filtering
- **Star Rating System**: Mark favorite queries and individual videos for quick access
- **Grid and List Views**: Switch between different viewing modes for optimal browsing experience

### Ranking & Labeling Tools
- **Video Ranking System**: Score and rank videos for quality assessment and content curation
- **Binary Labeling System**: Mark videos as relevant/irrelevant for training dataset preparation
- **Data Export Functionality**: Export labeled videos to JSON format for machine learning workflows
- **Batch Operations**: Clear labels, export selections, and manage datasets efficiently
- **Training Data Preparation**: Streamlined workflow for creating labeled datasets

### Real-time File Monitoring
- **File System Watcher**: Automatically detects new videos added to folder structure
- **Live JSON Generation**: Updates visualization data in real-time as content changes  
- **Manual Refresh Options**: On-demand updates via web interface when needed
- **Cross-platform Monitoring**: Works on Windows, macOS, and Linux systems

## 🛠️ Setup and Installation

### 1. Prerequisites

- **Python 3.7+** with pip
- **Node.js** (optional, for development)
- **FFmpeg** (recommended for video thumbnails)

### 2. Install FFmpeg (Recommended)

**macOS (Homebrew):**
```bash
brew install ffmpeg
```

**Windows:**
```bash
# Download from https://ffmpeg.org/download.html
# Add to PATH environment variable
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt install ffmpeg
```

### 3. Clone or Download the Project
```bash
cd scraping_vis
```

### 4. Install Python Dependencies
```bash
pip install -r requirements.txt
```

Or install manually:
```bash
pip install watchdog
```

### 5. Organize Your Video Structure (Optional)
Create folder structure in `downloads/` directory following this pattern:
```
downloads/
├── Category/
│   ├── Subconcept/
│   │   └── query_folder/
│   │       ├── video1.mp4
│   │       └── video2.mp4
└── Another_Category/
    └── Another_Subconcept/
        └── another_query/
```

## 📚 Usage

### 1. Quick Start (Recommended)

Run the all-in-one startup script:
```bash
python start_all.py
```

This will:
- Install any missing dependencies automatically
- Start the file monitor (watches for new videos)  
- Start the web server (serves the visualization)
- Open your browser to the application at `http://localhost:8000`

### 2. Manual Component Startup

Start components individually for more control:

**Start file monitor** (optional, for auto-updates):
```bash
python file_monitor.py
```

**Start web server**:
```bash
python serve.py
```

**Open browser**: Navigate to `http://localhost:8000`

### 3. Adding Videos to the System

**Create folder structure** in `downloads/`:
```bash
downloads/
├── Nature/
│   ├── Landscapes/
│   │   ├── mountain_scenery/
│   │   │   ├── video1.mp4
│   │   │   └── video2.mp4
│   │   └── ocean_views/
│   │       └── ocean_video.mp4
│   └── Wildlife/
│       └── animals/
│           └── wildlife_footage.mp4
└── Business/
    └── Meetings/
        └── office_discussion/
            └── meeting_video.mp4
```

**Add video files** to query folders and **refresh** the web interface (videos appear automatically if file monitor is running).

### 4. Web Interface Navigation

**Sidebar Navigation**: Browse categories, subconcepts, and queries in hierarchical structure

**Main Content Area**: 
- **Videos Mode**: Grid view of all videos in selected query
- **Rankings Mode**: View ranked videos with scores (if ranking data exists)  
- **Labeling Mode**: Label videos as relevant/irrelevant for training datasets

**Video Modal Controls**: 
- Click any video for full-screen viewing
- Use arrow keys or navigation buttons to browse videos
- View metadata, duration, and file information

**Interactive Controls**:
- **Star System**: Click stars to favorite queries and videos
- **Update Button**: Manually refresh data from file system
- **Export Button**: Export labeled videos to JSON format  
- **Clear Labels**: Reset all labels for current query

### 5. Video Labeling and Export

**Label Videos for Training**:
```bash
# Access via web interface labeling mode
# Mark videos as relevant (✓) or irrelevant (✗)
# Labels are saved automatically
```

**Export Labeled Data**:
```bash
# Use Export button in web interface
# Generates JSON file with labeled video data
# Includes metadata and file paths for ML workflows
```

## 📄 JSON Output Format

### Scraped Data Structure
```json
{
  "Category Name": {
    "Subconcept Name": {
      "queries": [
        {
          "query": "Search Term",
          "folder": "folder_name", 
          "timestamp": "2024-01-15 14:30:00",
          "totalResults": 5,
          "videos": [...]
        }
      ]
    }
  }
}
```

### Video Object Format
```json
{
  "id": "unique_video_id",
  "title": "Video Title",
  "thumbnail": "thumbnails/folder/video_thumb.jpg",
  "duration": "1:23",
  "resolution": "1920x1080", 
  "fileSize": "15.2 MB",
  "tags": ["tag1", "tag2"],
  "url": "downloads/folder/video.mp4",
  "label": "relevant|irrelevant|unlabeled",
  "ranking": 8.5
}
```

### Exported Labels Format
```json
{
  "queryFolder": "query_name",
  "data": {
    "exported_videos": [
      {
        "video_id": "unique_id",
        "file_path": "downloads/category/subconcept/query/video.mp4",
        "label": "relevant",
        "ranking": 9.2,
        "metadata": {...}
      }
    ],
    "timestamp": "2024-01-15T10:30:00",
    "total_labeled": 25,
    "relevant_count": 18,
    "irrelevant_count": 7
  }
}
```

## 🔄 Real-time File Monitoring

The file monitoring system provides automatic updates when new videos are added:

**File System Watcher**: Uses Python's `watchdog` library to monitor the downloads directory for changes
**Automatic JSON Updates**: Regenerates metadata JSON when new videos are detected  
**Live Web Interface**: Updates visualization in real-time without manual refresh
**Cross-platform Support**: Works on Windows, macOS, and Linux file systems
**Performance Optimized**: Efficient monitoring that doesn't impact system performance

## 🎯 API Endpoints

### GET `/api/ranking-results`
Returns ranking data for all queries:
```bash
curl http://localhost:8000/api/ranking-results
```

### POST `/api/export-labels`  
Export labeled video data:
```bash
curl -X POST http://localhost:8000/api/export-labels \
  -H "Content-Type: application/json" \
  -d '{"queryFolder": "query_name"}'
```

### GET `/api/update`
Manually trigger data refresh:
```bash
curl http://localhost:8000/api/update
```

## 🛡️ Enhanced Video Management

The visualization system incorporates robust video management capabilities:

**Automatic Thumbnail Generation**: Creates thumbnails for all video formats using FFmpeg with fallback options
**Duplicate Video Detection**: Identifies and handles duplicate videos across different queries and folders
**Metadata Preservation**: Maintains original video metadata while adding visualization-specific data
**Hierarchical Organization**: Supports complex folder structures for systematic content organization
**File Type Validation**: Ensures only supported video formats are processed and displayed

## 🏷️ Advanced Labeling System

The labeling functionality is designed for machine learning dataset preparation:

**Binary Classification**: Simple relevant/irrelevant labeling for binary classification tasks
**Ranking Integration**: Combines star ratings with binary labels for nuanced dataset creation  
**Batch Processing**: Label multiple videos quickly with keyboard shortcuts and bulk operations
**Export Flexibility**: Multiple export formats for different ML frameworks and use cases
**Label Persistence**: Labels are preserved across sessions and automatically saved

## 🚨 Troubleshooting

### Common Issues

**No thumbnails generated:**
```bash
# Check FFmpeg installation
ffmpeg -version

# Install FFmpeg (macOS)
brew install ffmpeg

# Install FFmpeg (Linux)  
sudo apt install ffmpeg
```

**Videos not appearing:**
```bash
# Check folder structure in downloads/
ls -la downloads/

# Ensure supported video extensions
# Click "Update" button in web interface
```

**Port already in use:**
```bash
# Check what's using port 8000
lsof -ti:8000

# Kill process using port
lsof -ti:8000 | xargs kill

# Or change port in serve.py
python serve.py --port 8001
```

**File monitor not working:**
```bash
# Install watchdog
pip install watchdog

# Check file permissions
ls -la downloads/

# Run with verbose logging
python file_monitor.py --verbose
```

### Debug Mode

Enable debug output for troubleshooting:
```bash
# Start with verbose logging
python file_monitor.py --verbose
python serve.py --debug
```

## 💻 Development

### Frontend Architecture
- **Main Logic**: `app.js` - Vanilla JavaScript application
- **Styling**: Embedded CSS in `index.html` with modern responsive design
- **No Framework Dependencies**: Pure JavaScript for fast loading and minimal overhead

### Backend Architecture  
- **File Monitor**: `file_monitor.py` - File system watching and JSON generation
- **Web Server**: `serve.py` - Python HTTP server with CORS support and API endpoints
- **Orchestration**: `start_all.py` - Single-command startup script

### Dependencies
- **Python**: `watchdog` for file system monitoring
- **System**: FFmpeg for video processing and thumbnail generation
- **Optional**: Node.js for development tools

## 📦 Project Structure

```
scraping_vis/
├── data/                    # Exported labeled video datasets
├── downloads/               # Video files organized by category/subconcept/query
│   ├── Camera_Focus/
│   │   ├── Deep_Focus/
│   │   │   └── everything_in_focus/
│   │   └── Shallow_Focus/
│   │       └── shallow_focus/
│   └── Camera_Angle/
│       └── Level_Angle/
│           └── level_angle/
├── thumbnails/              # Auto-generated video thumbnails
├── app.js                   # Frontend JavaScript application
├── index.html               # Main web interface
├── serve.py                 # Python web server
├── file_monitor.py          # File system monitoring script
├── start_all.py             # All-in-one startup script
├── requirements.txt         # Python dependencies
└── README.md                # This file
```
