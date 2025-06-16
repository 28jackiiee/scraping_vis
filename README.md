# Adobe Stock Scraping Visualization Tool

A simple, clean web interface for visualizing scraped Adobe Stock video results with a split-pane layout showing search queries and their corresponding results. **Now with automatic file monitoring!**

## 🚀 New Feature: Automatic File Monitoring

The visualization tool now automatically updates when you add video files to your Downloads folder!

### Quick Start with Auto-Monitoring

1. **Start the File Monitor**:
   ```bash
   # Option 1: Use the startup script (recommended)
   python start_monitor.py
   
   # Option 2: Run directly  
   python file_monitor.py
   
   # Option 3: On Windows, double-click
   start_monitor.bat
   ```

2. **Open the Web Interface**:
   - Open `index.html` in your web browser
   - The interface will automatically check for updates every 5 seconds

3. **Add Video Files**:
   - Create folders in your Downloads directory: `Downloads/query_name/`
   - Add video files to these folders
   - Watch the visualization update automatically! 📹

### Expected Folder Structure

```
Downloads/
├── nature landscapes/
│   ├── mountain_sunset_4k.mp4
│   ├── ocean_waves_1080p.mp4
│   └── forest_timelapse.mov
├── business meeting/
│   ├── office_collaboration.mp4
│   └── boardroom_discussion.avi
└── technology innovation/
    ├── ai_robot_assembly.mp4
    ├── data_center_servers.mp4
    └── vr_experience.mkv
```

## Features

- **Split-pane Interface**: Search queries on the left, results on the right
- **Interactive Query Selection**: Click any query to view its results
- **Video Grid Display**: Clean card layout for video results
- **Statistics Dashboard**: Shows total videos, average duration, and unique tags
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Beautiful gradient design with smooth animations
- **🆕 Automatic Updates**: Real-time monitoring of Downloads folder
- **🆕 Local File Support**: Click video cards to open local files
- **🆕 Smart Metadata**: Extracts duration, resolution, and tags from filenames

## Requirements

- Python 3.6 or higher
- `watchdog` package (automatically installed)

## Installation

1. **Clone or download** this project
2. **Run the startup script**:
   ```bash
   python start_monitor.py
   ```
   This will automatically install dependencies and start monitoring.

## How It Works

1. **File Monitor**: Python script watches your Downloads folder for changes
2. **Data Generation**: Automatically creates `scraped-data.json` from your file structure
3. **Web Interface**: Periodically checks for updates and refreshes the display
4. **Smart Parsing**: Extracts video information from filenames and folder structure

## File Naming for Better Results

For optimal metadata extraction, name your files like:
- `mountain_landscape_4k_2m30s.mp4` → Duration: 2:30, Resolution: 4K
- `office_meeting_1080p.avi` → Resolution: 1080p
- `ai_robot_30s.mov` → Duration: 0:30

Supported video formats: `.mp4`, `.avi`, `.mov`, `.mkv`, `.webm`, `.flv`, `.wmv`

## Manual Integration (Alternative)

If you prefer not to use automatic monitoring:

### Option 1: Replace Sample Data

Edit the `scrapingResults` object in `app.js` to use your actual scraped data.

### Option 2: Load External JSON

Use the `loadScrapingData()` function to load data from an external JSON file:

```javascript
// Load data from your scraper's output file
window.AdobeStockViz.loadScrapingData('path/to/your/scraped-data.json');
```

### Expected Data Structure

Your scraped data should follow this structure:

```json
{
  "search_query": {
    "query": "search terms used",
    "timestamp": "2024-01-15 14:30:00",
    "totalResults": 1250,
    "videos": [
      {
        "id": "unique_video_id",
        "title": "Video Title",
        "thumbnail": "thumbnail_url",
        "duration": "1:30",
        "resolution": "4K",
        "tags": ["tag1", "tag2"],
        "url": "adobe_stock_url"
      }
    ]
  }
}
```

## Required Fields

- `query`: The search terms used
- `timestamp`: When the search was performed
- `videos`: Array of video objects
  - `id`: Unique identifier
  - `title`: Video title
  - `duration`: Format "M:SS" (e.g., "1:30")
  - `resolution`: Video quality (e.g., "4K", "1080p")
  - `tags`: Array of tags/keywords

## Optional Fields

- `thumbnail`: Video thumbnail URL
- `url`: Link to Adobe Stock page
- `description`: Video description
- `contributor`: Video creator
- `price`: Pricing information
- `filename`: Original filename
- `fileSize`: File size in human-readable format

## Customization

### Styling

Modify the CSS in `index.html` to customize:
- Colors and gradients
- Card layouts
- Typography
- Spacing and animations

### Functionality

Extend `app.js` to add:
- Search functionality
- Filtering by tags or duration
- Sorting options
- Export capabilities

### Monitor Configuration

Edit `file_monitor.py` to customize:
- Monitoring path (default: `~/Downloads`)
- Output filename (default: `scraped-data.json`)
- Video file extensions
- Tag generation rules

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge

## File Structure

```
├── index.html              # Main HTML file with styles
├── app.js                 # JavaScript application logic
├── file_monitor.py        # Python file monitoring script
├── start_monitor.py       # Startup script with dependency management
├── start_monitor.bat      # Windows batch file
├── requirements.txt       # Python dependencies
├── sample-data.json       # Example data structure
└── README.md              # This file
```

## Troubleshooting

### File Monitor Issues

1. **Permission Errors**: Make sure Python has permission to read your Downloads folder
2. **Module Not Found**: Run `pip install watchdog` manually
3. **No Updates**: Check that files are being added to `Downloads/query_name/` structure

### Web Interface Issues

1. **CORS Errors**: Serve files through a local web server:
   ```bash
   python -m http.server 8000
   # Then open http://localhost:8000
   ```
2. **No Auto-Updates**: Check browser console for JavaScript errors

### File Detection Issues

1. **Files Not Detected**: Ensure video files have supported extensions
2. **Wrong Metadata**: Check filename patterns for duration/resolution extraction
3. **Missing Tags**: Folder and filename words become tags automatically

## Tips for Best Results

1. **Consistent Naming**: Use descriptive folder names for your search queries
2. **File Organization**: Keep related videos in the same query folder
3. **Filename Conventions**: Include duration and resolution in filenames
4. **Regular Cleanup**: Remove old or unwanted video files to keep the interface clean
5. **Performance**: For large collections, consider organizing into subfolders

## Example Workflow

1. **Start Monitoring**: Run `python start_monitor.py`
2. **Open Web Interface**: Open `index.html` in browser
3. **Download Videos**: Save to `Downloads/my-search-query/video.mp4`
4. **Watch Updates**: Interface automatically shows new videos
5. **Browse Results**: Click queries to explore your video collection

Enjoy your automatic Adobe Stock visualization system! 🎬✨ 