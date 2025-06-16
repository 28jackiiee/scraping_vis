// Sample data structure - replace this with your actual scraped data
const scrapingResults = {
    "nature landscapes": {
        query: "nature landscapes",
        timestamp: "2024-01-15 14:30:00",
        totalResults: 1250,
        videos: [
            {
                id: "1",
                title: "Beautiful Mountain Landscape Time-lapse",
                thumbnail: "https://via.placeholder.com/300x180/4CAF50/white?text=Mountain",
                duration: "0:45",
                resolution: "4K",
                tags: ["nature", "mountain", "time-lapse", "scenic"],
                url: "#"
            },
            {
                id: "2",
                title: "Ocean Waves at Sunset",
                thumbnail: "https://via.placeholder.com/300x180/2196F3/white?text=Ocean",
                duration: "1:20",
                resolution: "1080p",
                tags: ["ocean", "sunset", "waves", "peaceful"],
                url: "#"
            },
            {
                id: "3",
                title: "Forest Wildlife Documentary Clip",
                thumbnail: "https://via.placeholder.com/300x180/4CAF50/white?text=Forest",
                duration: "2:15",
                resolution: "4K",
                tags: ["forest", "wildlife", "documentary", "animals"],
                url: "#"
            },
            {
                id: "4",
                title: "Desert Sand Dunes Aerial View",
                thumbnail: "https://via.placeholder.com/300x180/FF9800/white?text=Desert",
                duration: "1:00",
                resolution: "4K",
                tags: ["desert", "aerial", "sand", "landscape"],
                url: "#"
            }
        ]
    },
    "business meeting": {
        query: "business meeting",
        timestamp: "2024-01-15 15:45:00",
        totalResults: 890,
        videos: [
            {
                id: "5",
                title: "Modern Office Team Collaboration",
                thumbnail: "https://via.placeholder.com/300x180/9C27B0/white?text=Office",
                duration: "0:30",
                resolution: "1080p",
                tags: ["business", "team", "office", "collaboration"],
                url: "#"
            },
            {
                id: "6",
                title: "Corporate Boardroom Discussion",
                thumbnail: "https://via.placeholder.com/300x180/3F51B5/white?text=Boardroom",
                duration: "1:45",
                resolution: "4K",
                tags: ["corporate", "meeting", "boardroom", "discussion"],
                url: "#"
            },
            {
                id: "7",
                title: "Business Handshake Deal",
                thumbnail: "https://via.placeholder.com/300x180/FF5722/white?text=Handshake",
                duration: "0:15",
                resolution: "1080p",
                tags: ["handshake", "deal", "partnership", "agreement"],
                url: "#"
            }
        ]
    },
    "technology innovation": {
        query: "technology innovation",
        timestamp: "2024-01-15 16:20:00",
        totalResults: 2100,
        videos: [
            {
                id: "8",
                title: "AI Robot Assembly Line",
                thumbnail: "https://via.placeholder.com/300x180/607D8B/white?text=AI+Robot",
                duration: "1:30",
                resolution: "4K",
                tags: ["AI", "robot", "automation", "technology"],
                url: "#"
            },
            {
                id: "9",
                title: "Data Center Server Visualization",
                thumbnail: "https://via.placeholder.com/300x180/795548/white?text=Data+Center",
                duration: "0:50",
                resolution: "4K",
                tags: ["data", "server", "cloud", "infrastructure"],
                url: "#"
            },
            {
                id: "10",
                title: "Virtual Reality Experience",
                thumbnail: "https://via.placeholder.com/300x180/E91E63/white?text=VR",
                duration: "2:00",
                resolution: "4K",
                tags: ["VR", "virtual reality", "innovation", "tech"],
                url: "#"
            },
            {
                id: "11",
                title: "Smartphone Development Process",
                thumbnail: "https://via.placeholder.com/300x180/009688/white?text=Smartphone",
                duration: "1:10",
                resolution: "1080p",
                tags: ["smartphone", "development", "mobile", "tech"],
                url: "#"
            },
            {
                id: "12",
                title: "Coding Software Development",
                thumbnail: "https://via.placeholder.com/300x180/FFC107/white?text=Coding",
                duration: "0:40",
                resolution: "1080p",
                tags: ["coding", "software", "programming", "development"],
                url: "#"
            }
        ]
    }
};

let currentQuery = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadQueries();
});

// Load all search queries into the sidebar
function loadQueries() {
    const queryList = document.getElementById('queryList');
    queryList.innerHTML = '';
    
    Object.keys(scrapingResults).forEach(queryKey => {
        const data = scrapingResults[queryKey];
        const queryItem = document.createElement('div');
        queryItem.className = 'query-item';
        queryItem.setAttribute('data-query', queryKey);
        
        queryItem.innerHTML = `
            <div class="query-text">${data.query}</div>
            <div class="query-meta">
                ${data.videos.length} videos • ${formatDate(data.timestamp)}
            </div>
        `;
        
        queryItem.addEventListener('click', () => selectQuery(queryKey));
        queryList.appendChild(queryItem);
    });
}

// Select a query and display its results
function selectQuery(queryKey) {
    // Update active state
    document.querySelectorAll('.query-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-query="${queryKey}"]`).classList.add('active');
    
    currentQuery = queryKey;
    const data = scrapingResults[queryKey];
    
    // Update results title
    document.getElementById('resultsTitle').textContent = `Results for "${data.query}"`;
    
    // Show and update stats
    updateStats(data);
    
    // Display videos
    displayVideos(data.videos);
}

// Update statistics section
function updateStats(data) {
    const statsSection = document.getElementById('statsSection');
    statsSection.style.display = 'block';
    
    // Calculate statistics
    const totalVideos = data.videos.length;
    const avgDuration = calculateAverageDuration(data.videos);
    const uniqueTags = getUniqueTags(data.videos);
    
    document.getElementById('totalVideos').textContent = totalVideos;
    document.getElementById('avgDuration').textContent = avgDuration;
    document.getElementById('uniqueTags').textContent = uniqueTags.length;
}

// Display videos in a grid
function displayVideos(videos) {
    const resultsContainer = document.getElementById('resultsContainer');
    
    if (videos.length === 0) {
        resultsContainer.innerHTML = `
            <div class="no-results">
                <div style="font-size: 4em; margin-bottom: 20px; opacity: 0.3;">📹</div>
                <h3>No videos found</h3>
                <p>This search query returned no results</p>
            </div>
        `;
        return;
    }
    
    const resultsGrid = document.createElement('div');
    resultsGrid.className = 'results-grid';
    
    videos.forEach(video => {
        const videoCard = document.createElement('div');
        videoCard.className = 'video-card';
        
        videoCard.innerHTML = `
            <div class="video-thumbnail">
                <img src="${video.thumbnail}" alt="${video.title}" onerror="this.style.display='none'; this.parentElement.innerHTML='📹';">
            </div>
            <div class="video-info">
                <div class="video-title">${video.title}</div>
                <div class="video-meta">
                    <span class="video-duration">${video.duration}</span>
                    <span class="video-resolution">${video.resolution}</span>
                </div>
                <div class="video-tags">
                    ${video.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            </div>
        `;
        
        resultsGrid.appendChild(videoCard);
    });
    
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(resultsGrid);
}

// Calculate average duration from videos
function calculateAverageDuration(videos) {
    if (videos.length === 0) return "0s";
    
    const totalSeconds = videos.reduce((sum, video) => {
        const [minutes, seconds] = video.duration.split(':').map(Number);
        return sum + (minutes * 60) + seconds;
    }, 0);
    
    const avgSeconds = Math.round(totalSeconds / videos.length);
    const minutes = Math.floor(avgSeconds / 60);
    const seconds = avgSeconds % 60;
    
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

// Get unique tags from all videos
function getUniqueTags(videos) {
    const allTags = videos.flatMap(video => video.tags);
    return [...new Set(allTags)];
}

// Format date string
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Function to load external data (for when you integrate with your scraper)
function loadScrapingData(dataUrl) {
    fetch(dataUrl)
        .then(response => response.json())
        .then(data => {
            // Replace the sample data with loaded data
            Object.assign(scrapingResults, data);
            loadQueries();
        })
        .catch(error => {
            console.error('Error loading scraping data:', error);
        });
}

// Export functions for potential external use
window.AdobeStockViz = {
    loadScrapingData,
    selectQuery,
    scrapingResults
}; 