# Adobe Stock Scraping Visualization Tool

A simple, clean web interface for visualizing scraped Adobe Stock video results with a split-pane layout showing search queries and their corresponding results.

## Features

- **Split-pane Interface**: Search queries on the left, results on the right
- **Interactive Query Selection**: Click any query to view its results
- **Video Grid Display**: Clean card layout for video results
- **Statistics Dashboard**: Shows total videos, average duration, and unique tags
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Beautiful gradient design with smooth animations

## Quick Start

1. Open `index.html` in your web browser
2. Click on any search query in the left sidebar
3. View the results in the main content area

## Integration with Your Scraper

To integrate with your existing Adobe Stock scraper:

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

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge

## File Structure

```
├── index.html          # Main HTML file with styles
├── app.js             # JavaScript application logic
├── sample-data.json   # Example data structure
└── README.md          # This file
```

## Tips for Integration

1. **Consistent Data Format**: Ensure your scraper outputs data in the expected JSON structure
2. **Thumbnail URLs**: Include thumbnail URLs for better visual presentation
3. **Error Handling**: The tool handles missing thumbnails gracefully
4. **Performance**: For large datasets, consider implementing pagination or lazy loading
5. **Real-time Updates**: You can call `loadQueries()` after updating the data to refresh the interface

## Example Usage

```javascript
// After your scraper completes
const scrapedData = {
  "nature videos": {
    query: "nature videos",
    timestamp: new Date().toISOString(),
    totalResults: 500,
    videos: yourScrapedVideos
  }
};

// Update the visualization
Object.assign(window.AdobeStockViz.scrapingResults, scrapedData);
loadQueries();
```

Enjoy visualizing your Adobe Stock scraping results! 