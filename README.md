# Adobe Stock Scraping Visualization

A web-based visualization tool for exploring Adobe Stock video scraping results and annotation data with VQA (Visual Question Answering) confidence scores.

## Features

### Video Directory Support
- ✅ Browse videos organized by categories and subconcepts
- ✅ View video metadata (resolution, duration, file size)
- ✅ Star/bookmark favorite videos and queries
- ✅ Video preview with navigation controls
- ✅ Pagination for large video collections

### Annotation Data Support 🆕
- ✅ **Load JSON files with confidence scores** (e.g., `dolly_zoom.json`)
- ✅ **Display confidence scores** as color-coded badges and progress bars
- ✅ **Sort by confidence score** (high to low, low to high)
- ✅ **VQA question display** in annotation cards
- ✅ **Automatic integration** with existing video data

### Labeling Interface
- ✅ Label videos as "Yes" or "No" for annotation tasks
- ✅ **Sort by confidence score in labeling mode** 📊
- ✅ Export labeled videos to JSON
- ✅ Bookmark videos for later review
- ✅ Optimized performance with caching

### Rankings & Analytics
- ✅ VQA score rankings with detailed statistics
- ✅ Star videos to prioritize in rankings
- ✅ Visual progress bars for scores

## Usage

### Basic Setup
```bash
# Start the server
python serve.py

# Open browser to http://localhost:8000/index.html
```

### Supported File Structures

#### 1. Video Directories (Existing)
```
downloads/
  camera movement/
    dolly in/
      dolly_in/
        *.mp4 files
```

#### 2. Annotation JSON Files (New) 🆕
```
downloads/
  camera movement/
    dolly_zoom/
      dolly_zoom.json
```

**Annotation JSON Format:**
```json
{
  "time": 57820.127,
  "results": [
    {
      "video": "https://example.com/video.mp4",
      "label": "cam_motion.dolly_zoom_movement.has_dolly_in_zoom_out",
      "question": "Does the shot feature a dolly zoom effect?",
      "score": 0.8731436729431152
    }
  ]
}
```

### Confidence Score Sorting

In the **Labeling** section, when annotation data is detected, you can sort by:

- **Confidence Score (High to Low)** - Shows most confident predictions first
- **Confidence Score (Low to High)** - Shows least confident predictions first  
- **Label Status** - Groups by Yes/No/Unlabeled
- **Title** - Alphabetical sorting

### Visual Indicators

**Confidence Score Colors:**
- 🟢 **Excellent** (80-100%): Green gradient
- 🔵 **Good** (60-80%): Blue-purple gradient  
- 🟡 **Fair** (40-60%): Yellow-orange gradient
- 🟠 **Poor** (20-40%): Orange-red gradient
- 🔴 **Very Poor** (0-20%): Red-purple gradient

**Card Styling:**
- 💜 Purple left border for annotation data
- 🎯 Confidence percentage badge in top-left
- 📊 Progress bar showing confidence level
- ❓ Question text snippet

## API Endpoints

- `GET /api/annotation-data` - Combined video and annotation data
- `GET /api/ranking-results` - VQA ranking results  
- `GET /api/labels` - Video labeling data
- `POST /api/labels` - Save video labels
- `DELETE /api/labels` - Clear all labels
- `POST /api/export-labels` - Export labeled videos

## File Structure

```
scraping_vis/
├── index.html          # Main UI
├── app.js             # Frontend logic with annotation support
├── serve.py           # Backend server with annotation API
├── downloads/         # Video files and annotation JSON
├── data/             # Exported labels and settings
└── thumbnails/       # Video thumbnails
```

## Recent Updates

### Version 2.0 - Annotation Data Support
- ✅ Added JSON annotation file scanning
- ✅ Confidence score display and sorting
- ✅ VQA question integration
- ✅ Enhanced labeling interface
- ✅ Combined data source loading
- ✅ Color-coded confidence indicators

## Browser Compatibility

- ✅ Chrome/Edge (Recommended)
- ✅ Firefox  
- ✅ Safari
- 📱 Mobile responsive design

---

**Ready to use!** 🚀 Your annotation data files like `dolly_zoom.json` will be automatically detected and integrated with confidence score sorting in the labeling interface.
