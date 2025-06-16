// Sample data structure - this will be replaced by data from scraped-data.json
let scrapingResults = {
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
            }
        ]
    }
};

let currentQuery = null;
let lastUpdateCheck = 0;
let autoUpdateInterval = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadInitialData();
    startAutoUpdate();
});

// Load initial data from scraped-data.json or fall back to sample data
async function loadInitialData() {
    try {
        await loadScrapingData('scraped-data.json');
    } catch (error) {
        console.log('No scraped-data.json found, using sample data');
        loadQueries();
    }
}

// Start automatic update checking
function startAutoUpdate() {
    // Check for updates every 5 seconds
    autoUpdateInterval = setInterval(checkForUpdates, 5000);
    console.log('Auto-update started (checking every 5 seconds)');
}

// Stop automatic updates
function stopAutoUpdate() {
    if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
        autoUpdateInterval = null;
        console.log('Auto-update stopped');
    }
}

// Check for updates to the JSON file
async function checkForUpdates() {
    try {
        const response = await fetch('scraped-data.json?t=' + Date.now());
        if (response.ok) {
            const lastModified = response.headers.get('Last-Modified');
            const currentTime = Date.now();
            
            // Only update if file has been modified recently (within last 10 seconds)
            if (lastModified && currentTime - lastUpdateCheck > 1000) {
                const data = await response.json();
                if (JSON.stringify(data) !== JSON.stringify(scrapingResults)) {
                    console.log('Data updated, refreshing visualization');
                    Object.assign(scrapingResults, data);
                    loadQueries();
                    
                    // Show update notification
                    showUpdateNotification();
                }
                lastUpdateCheck = currentTime;
            }
        }
    } catch (error) {
        // Silently fail - file might not exist yet
    }
}

// Show update notification
function showUpdateNotification() {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('updateNotification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'updateNotification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 1000;
            font-weight: 500;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        notification.textContent = '📹 Videos updated!';
        document.body.appendChild(notification);
    }
    
    // Show notification
    notification.style.opacity = '1';
    
    // Hide after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
    }, 3000);
}

// Load all search queries into the sidebar
function loadQueries() {
    const queryList = document.getElementById('queryList');
    queryList.innerHTML = '';
    
    const queryKeys = Object.keys(scrapingResults);
    
    if (queryKeys.length === 0) {
        queryList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #6c757d;">
                <div style="font-size: 2em; margin-bottom: 10px;">📁</div>
                <p>No query folders found</p>
                <small>Add video files to Downloads/query_name/</small>
            </div>
        `;
        return;
    }
    
    queryKeys.forEach(queryKey => {
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
    
    const queryElement = document.querySelector(`[data-query="${queryKey}"]`);
    if (queryElement) {
        queryElement.classList.add('active');
    }
    
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
        
        // Determine thumbnail source
        const thumbnailSrc = video.thumbnail || generateVideoThumbnail(video);
        
        // Create video preview modal
        const isLocalFile = video.localPath || video.url.startsWith('file://');
        
        videoCard.innerHTML = `
            <div class="video-thumbnail" data-video-id="${video.id}">
                <img src="${thumbnailSrc}" alt="${video.title}" onerror="this.src='${generateVideoThumbnail(video)}';">
                <div class="play-button">▶</div>
                <div class="video-duration-overlay">${video.duration}</div>
            </div>
            <div class="video-info">
                <div class="video-title">${video.title}</div>
                <div class="video-meta">
                    <span class="video-resolution">${video.resolution}</span>
                    ${video.fileSize ? `<span class="video-filesize">${video.fileSize}</span>` : ''}
                </div>
                <div class="video-tags">
                    ${video.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
                ${video.filename ? `<div class="video-filename" title="${video.filename}">${video.filename}</div>` : ''}
            </div>
        `;
        
        // Add click handler for video preview
        const thumbnail = videoCard.querySelector('.video-thumbnail');
        thumbnail.addEventListener('click', () => {
            showVideoModal(video);
        });
        
        resultsGrid.appendChild(videoCard);
    });
    
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(resultsGrid);
}

// Show video in modal
function showVideoModal(video) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('videoModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'videoModal';
        modal.className = 'video-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="modalTitle"></h3>
                    <span class="close">&times;</span>
                </div>
                <div class="modal-body">
                    <video id="modalVideo" controls style="width: 100%; max-height: 70vh;">
                        Your browser does not support the video tag.
                    </video>
                    <div class="video-details" id="modalDetails"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Add close handlers
        const closeBtn = modal.querySelector('.close');
        closeBtn.addEventListener('click', closeVideoModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeVideoModal();
        });
        
        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeVideoModal();
        });
    }
    
    // Update modal content
    document.getElementById('modalTitle').textContent = video.title;
    
    const videoElement = document.getElementById('modalVideo');
    videoElement.src = video.url;
    
    const details = `
        <div class="detail-row"><strong>Duration:</strong> ${video.duration}</div>
        <div class="detail-row"><strong>Resolution:</strong> ${video.resolution}</div>
        ${video.fileSize ? `<div class="detail-row"><strong>File Size:</strong> ${video.fileSize}</div>` : ''}
        <div class="detail-row"><strong>Tags:</strong> ${video.tags.join(', ')}</div>
        ${video.filename ? `<div class="detail-row"><strong>Filename:</strong> ${video.filename}</div>` : ''}
    `;
    document.getElementById('modalDetails').innerHTML = details;
    
    // Show modal
    modal.style.display = 'block';
    
    // Auto-play if possible
    videoElement.play().catch(() => {
        // Auto-play failed, that's okay
    });
}

// Close video modal
function closeVideoModal() {
    const modal = document.getElementById('videoModal');
    if (modal) {
        modal.style.display = 'none';
        const video = document.getElementById('modalVideo');
        video.pause();
        video.src = '';
    }
}

// Generate a placeholder thumbnail for videos
function generateVideoThumbnail(video) {
    const colors = ['4CAF50', '2196F3', '9C27B0', '3F51B5', 'FF5722', '607D8B', '795548', 'E91E63', '009688', 'FFC107'];
    const colorIndex = Math.abs(video.id.charCodeAt(0)) % colors.length;
    const color = colors[colorIndex];
    const title = encodeURIComponent(video.title.substring(0, 15));
    return `https://via.placeholder.com/300x180/${color}/white?text=${title}`;
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

// Function to load external data
async function loadScrapingData(dataUrl) {
    try {
        const response = await fetch(dataUrl + '?t=' + Date.now());
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        
        // Replace the sample data with loaded data
        scrapingResults = data;
        loadQueries();
        
        console.log('Loaded data from', dataUrl);
        return data;
    } catch (error) {
        console.error('Error loading scraping data:', error);
        throw error;
    }
}

// Add styles for video modal and improved cards
const additionalStyles = `
    .video-thumbnail {
        position: relative;
        cursor: pointer;
        overflow: hidden;
    }
    
    .video-thumbnail:hover .play-button {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1.1);
    }
    
    .play-button {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 60px;
        height: 60px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        opacity: 0.8;
        transition: all 0.3s ease;
        pointer-events: none;
    }
    
    .video-duration-overlay {
        position: absolute;
        bottom: 8px;
        right: 8px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 0.8em;
        font-weight: 500;
    }
    
    .video-filesize {
        font-size: 0.8em;
        color: #6c757d;
        margin-left: 10px;
    }
    
    .video-filename {
        font-size: 0.7em;
        color: #999;
        margin-top: 8px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    
    .video-card:hover .video-filename {
        color: #666;
    }
    
    .video-modal {
        display: none;
        position: fixed;
        z-index: 1000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.8);
        animation: fadeIn 0.3s ease;
    }
    
    .modal-content {
        position: relative;
        background-color: #fefefe;
        margin: 5% auto;
        padding: 0;
        border-radius: 12px;
        width: 90%;
        max-width: 800px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        overflow: hidden;
    }
    
    .modal-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .modal-header h3 {
        margin: 0;
        font-size: 1.3em;
    }
    
    .close {
        font-size: 28px;
        font-weight: bold;
        cursor: pointer;
        line-height: 1;
        opacity: 0.8;
        transition: opacity 0.3s ease;
    }
    
    .close:hover {
        opacity: 1;
    }
    
    .modal-body {
        padding: 20px;
    }
    
    .video-details {
        margin-top: 20px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 8px;
    }
    
    .detail-row {
        margin-bottom: 8px;
        font-size: 0.9em;
    }
    
    .detail-row:last-child {
        margin-bottom: 0;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    @media (max-width: 768px) {
        .modal-content {
            width: 95%;
            margin: 10% auto;
        }
    }
`;

// Add additional styles to the page
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

// Export functions for potential external use
window.AdobeStockViz = {
    loadScrapingData,
    selectQuery,
    scrapingResults,
    startAutoUpdate,
    stopAutoUpdate,
    checkForUpdates
}; 