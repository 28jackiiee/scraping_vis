// Sample data structure - this will be replaced by data from scraped-data.json
let scrapingResults = {
    "Camera Focus": {
        "Deep Focus": {
            "queries": [
                {
                    "query": "Everything In Focus",
                    "folder": "everything_in_focus",
                    "timestamp": "2024-01-15 14:30:00",
                    "totalResults": 3,
                    "videos": [
                        {
                            id: "1",
                            title: "Beautiful Mountain Landscape",
                            thumbnail: "https://via.placeholder.com/300x180/4CAF50/white?text=Mountain",
                            duration: "0:45",
                            resolution: "4K",
                            tags: [],
                            url: "#"
                        }
                    ]
                }
            ]
        }
    }
};

// New variable to store ranking results
let rankingResults = {};

let currentCategory = null;
let currentSubconcept = null;
let currentQuery = null;
let lastUpdateCheck = 0;
let autoUpdateInterval = null;
let currentViewMode = 'videos'; // 'videos' or 'rankings'
let currentVideoList = []; // Store current video list for navigation
let currentVideoIndex = 0; // Track current video index for navigation

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadInitialData();
    loadRankingResults();
    // Removed automatic update - now using manual button
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

// Load ranking results from ranking_results.json files
async function loadRankingResults() {
    try {
        // Try the API endpoint first
        const apiResponse = await fetch('/api/ranking-results?t=' + Date.now());
        if (apiResponse.ok) {
            const newRankingResults = await apiResponse.json();
            const hasChanges = JSON.stringify(newRankingResults) !== JSON.stringify(rankingResults);
            rankingResults = newRankingResults;
            console.log('Ranking results loaded from API:', rankingResults);
            return hasChanges;
        }
    } catch (error) {
        console.log('API not available, trying direct file access:', error);
    }
    
    // Fallback: Try to load known ranking files directly
    try {
        const knownPaths = [
            'downloads/Camera Angle/Level Angle/level_angle/ranking_results.json',
            // Add more known paths as needed
        ];
        
        const newRankingResults = {};
        let hasChanges = false;
        
        for (const path of knownPaths) {
            try {
                const response = await fetch(path + '?t=' + Date.now());
                if (response.ok) {
                    const data = await response.json();
                    const folderKey = path.replace('downloads/', '').replace('/ranking_results.json', '');
                    newRankingResults[folderKey] = data;
                    console.log(`Loaded ranking results from ${path}`);
                }
            } catch (fileError) {
                console.log(`Could not load ${path}:`, fileError);
            }
        }
        
        hasChanges = JSON.stringify(newRankingResults) !== JSON.stringify(rankingResults);
        rankingResults = newRankingResults;
        console.log('Ranking results loaded directly:', rankingResults);
        return hasChanges;
        
    } catch (error) {
        console.log('Error loading ranking results directly:', error);
        return false;
    }
}

// Manual update function triggered by button click
async function manualUpdate() {
    const button = document.getElementById('updateButton');
    const originalText = button.innerHTML;
    
    // Show loading state
    button.innerHTML = '<span>⏳</span><span>Checking...</span>';
    button.disabled = true;
    
    try {
        // Load both regular data and ranking results
        const [hasUpdates, rankingUpdates] = await Promise.all([
            checkForUpdates(),
            loadRankingResults()
        ]);
        
        if (hasUpdates || rankingUpdates) {
            // Show success state briefly
            button.innerHTML = '<span>✅</span><span>Updated!</span>';
        } else {
            // Show no updates state briefly
            button.innerHTML = '<span>ℹ️</span><span>No updates</span>';
        }
        
        setTimeout(() => {
            button.innerHTML = originalText;
            button.disabled = false;
        }, 2000);
    } catch (error) {
        console.error('Manual update failed:', error);
        // Show error state briefly
        button.innerHTML = '<span>❌</span><span>Error</span>';
        setTimeout(() => {
            button.innerHTML = originalText;
            button.disabled = false;
        }, 2000);
    }
}

// Legacy function - no longer used for auto-updates
function startAutoUpdate() {
    console.log('Auto-update disabled - using manual update button');
}

// Stop automatic updates - no longer needed
function stopAutoUpdate() {
    console.log('Manual update mode - no auto-updates to stop');
}

// Check for updates to the JSON file
async function checkForUpdates() {
    try {
        const response = await fetch('scraped-data.json?t=' + Date.now());
        if (response.ok) {
            const currentTime = Date.now();
            const data = await response.json();
            
            // Always check for updates when called manually
            if (JSON.stringify(data) !== JSON.stringify(scrapingResults)) {
                console.log('Data updated, refreshing visualization');
                Object.assign(scrapingResults, data);
                loadQueries();
                
                // Show update notification
                showUpdateNotification();
                return true; // Indicate update occurred
            } else {
                console.log('No new data found');
                return false; // Indicate no update needed
            }
            lastUpdateCheck = currentTime;
        }
    } catch (error) {
        console.error('Error checking for updates:', error);
        throw error; // Re-throw to handle in manualUpdate
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

// Load all categories and subconcepts into the sidebar
function loadQueries() {
    const queryList = document.getElementById('queryList');
    queryList.innerHTML = '';
    
    const categories = Object.keys(scrapingResults);
    
    if (categories.length === 0) {
        queryList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #6c757d;">
                <div style="font-size: 2em; margin-bottom: 10px;">📁</div>
                <p>No categories found</p>
                <small>Add video files to Downloads/query_name/</small>
            </div>
        `;
        return;
    }
    
    categories.forEach(categoryName => {
        const categoryData = scrapingResults[categoryName];
        
        // Create category container
        const categoryItem = document.createElement('div');
        categoryItem.className = 'category-item';
        
        // Count total queries in this category
        const totalQueries = Object.values(categoryData).reduce((sum, subconcept) => 
            sum + subconcept.queries.length, 0
        );
        
        categoryItem.innerHTML = `
            <div class="category-header" data-category="${categoryName}">
                <span class="category-icon">📁</span>
                <span class="category-name">${categoryName}</span>
                <span class="category-count">${totalQueries} queries</span>
                <span class="expand-icon">▶</span>
            </div>
            <div class="subconcepts-container" style="display: none;">
                ${Object.entries(categoryData).map(([subconceptName, subconceptData]) => `
                    <div class="subconcept-item" data-category="${categoryName}" data-subconcept="${subconceptName}">
                        <span class="subconcept-icon">📹</span>
                        <span class="subconcept-name">${subconceptName}</span>
                        <span class="subconcept-count">${subconceptData.queries.length} queries</span>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Add event listeners
        const categoryHeader = categoryItem.querySelector('.category-header');
        const subconceptsContainer = categoryItem.querySelector('.subconcepts-container');
        const expandIcon = categoryItem.querySelector('.expand-icon');
        
        // Toggle category expansion
        categoryHeader.addEventListener('click', () => {
            const isExpanded = subconceptsContainer.style.display !== 'none';
            subconceptsContainer.style.display = isExpanded ? 'none' : 'block';
            expandIcon.textContent = isExpanded ? '▶' : '▼';
            categoryItem.classList.toggle('expanded', !isExpanded);
        });
        
        // Add subconcept click handlers
        categoryItem.querySelectorAll('.subconcept-item').forEach(subconceptElement => {
            subconceptElement.addEventListener('click', (e) => {
                e.stopPropagation();
                const category = subconceptElement.getAttribute('data-category');
                const subconcept = subconceptElement.getAttribute('data-subconcept');
                selectSubconcept(category, subconcept);
            });
        });
        
        queryList.appendChild(categoryItem);
    });
}

// Select a subconcept and display its queries
function selectSubconcept(categoryName, subconceptName) {
    console.log('selectSubconcept called:', categoryName, subconceptName);
    console.log('Current view mode:', currentViewMode);
    console.log('Current query:', currentQuery);
    
    // Update active state
    document.querySelectorAll('.subconcept-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const subconceptElement = document.querySelector(`[data-category="${categoryName}"][data-subconcept="${subconceptName}"]`);
    if (subconceptElement) {
        subconceptElement.classList.add('active');
        console.log('Set active subconcept element');
    } else {
        console.log('Could not find subconcept element:', `[data-category="${categoryName}"][data-subconcept="${subconceptName}"]`);
    }
    
    currentCategory = categoryName;
    currentSubconcept = subconceptName;
    currentQuery = null;
    currentViewMode = null; // Reset view mode when navigating away from queries
    
    const subconceptData = scrapingResults[categoryName][subconceptName];
    console.log('Subconcept data:', subconceptData);
    
    // Update results title - check if element exists first
    const resultsTitle = document.getElementById('resultsTitle');
    if (resultsTitle) {
        resultsTitle.textContent = `${categoryName} → ${subconceptName}`;
        console.log('Updated results title');
    } else {
        console.log('resultsTitle element not found - will be created with new content structure');
    }
    
    // Reset main content structure to ensure proper navigation
    const mainContent = document.querySelector('.main-content');
    console.log('Main content before reset:', mainContent.innerHTML.substring(0, 100));
    mainContent.innerHTML = `
        <div class="results-section">
            <div id="resultsContainer"></div>
        </div>
    `;
    console.log('Main content after reset');
    
    // Display queries for this subconcept
    displayQueries(subconceptData.queries);
    console.log('displayQueries completed');
}

// Select a specific query and display its videos
function selectQuery(queryData) {
    currentQuery = queryData;
    
    // Update main content
    const mainContent = document.querySelector('.main-content');
    mainContent.innerHTML = `
        <div class="results-section">
            <div class="view-mode-tabs">
                <button id="videoViewBtn" class="view-tab active" onclick="switchViewMode('videos')">
                    📹 Videos
                </button>
                <button id="rankingViewBtn" class="view-tab" onclick="switchViewMode('rankings')">
                    🏆 Rankings
                </button>
                <button id="labelingViewBtn" class="view-tab" onclick="switchViewMode('labeling')">
                    🏷️ Labeling
                </button>
            </div>
            <h2>Results for "${queryData.query}"</h2>
            <div id="resultsContainer"></div>
        </div>
    `;
    
    // Default to video view
    currentViewMode = 'videos';
    displayVideos(queryData.videos);
}

// Display queries in the main area
function displayQueries(queries) {
    const resultsContainer = document.getElementById('resultsContainer');
    
    if (queries.length === 0) {
        resultsContainer.innerHTML = `
            <div class="no-results">
                <div style="font-size: 4em; margin-bottom: 20px; opacity: 0.3;">📋</div>
                <h3>No queries found</h3>
                <p>This subconcept has no queries yet</p>
            </div>
        `;
        return;
    }
    
    // Sort queries: starred ones first, then by name
    const sortedQueries = [...queries].sort((a, b) => {
        const aStarred = isQueryStarred(a.folder);
        const bStarred = isQueryStarred(b.folder);
        
        if (aStarred && !bStarred) return -1;
        if (!aStarred && bStarred) return 1;
        return a.query.localeCompare(b.query);
    });
    
    const queriesGrid = document.createElement('div');
    queriesGrid.className = 'queries-grid';
    
    sortedQueries.forEach(queryData => {
        const queryCard = document.createElement('div');
        queryCard.className = 'query-card';
        const isStarred = isQueryStarred(queryData.folder);
        
        queryCard.innerHTML = `
            <div class="query-card-header">
                <div class="query-title-section">
                    <button class="star-button ${isStarred ? 'starred' : ''}" data-folder="${queryData.folder}" title="${isStarred ? 'Remove from favorites' : 'Add to favorites'}">
                        ${isStarred ? '⭐' : '☆'}
                    </button>
                    <h3 class="query-title">Query: "${queryData.query}"</h3>
                </div>
                <span class="query-count">${queryData.totalResults} videos</span>
            </div>
            <div class="query-meta">
                <span class="query-timestamp">${formatDate(queryData.timestamp)}</span>
                <span class="query-folder">${queryData.folder}</span>
            </div>
            <div class="query-preview">
                ${queryData.videos.slice(0, 4).map(video => `
                    <div class="preview-thumbnail">
                        <img src="${video.thumbnail || generateVideoThumbnail(video)}" alt="${video.title}">
                    </div>
                `).join('')}
                ${queryData.videos.length > 4 ? `<div class="preview-more">+${queryData.videos.length - 4}</div>` : ''}
            </div>
        `;
        
        // Add star button click handler
        const starButton = queryCard.querySelector('.star-button');
        starButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent query selection
            console.log('Query star button clicked for folder:', queryData.folder);
            toggleQueryStar(queryData.folder);
            // Refresh the queries display to show new sorting
            displayQueries(queries);
        });
        
        // Add query card click handler (excluding star button)
        queryCard.addEventListener('click', (e) => {
            if (!e.target.closest('.star-button')) {
                console.log('Query card clicked:', queryData.query);
                selectQuery(queryData);
            }
        });
        
        queriesGrid.appendChild(queryCard);
    });
    
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(queriesGrid);
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
    
    // Sort videos: starred ones first, then by title
    const sortedVideos = [...videos].sort((a, b) => {
        const aStarred = isVideoStarred(a.id);
        const bStarred = isVideoStarred(b.id);
        
        if (aStarred && !bStarred) return -1;
        if (!aStarred && bStarred) return 1;
        return a.title.localeCompare(b.title);
    });
    
    // Store sorted video list for navigation
    currentVideoList = sortedVideos;
    
    const resultsGrid = document.createElement('div');
    resultsGrid.className = 'results-grid';
    
    sortedVideos.forEach((video, index) => {
        const videoCard = document.createElement('div');
        videoCard.className = 'video-card';
        const isStarred = isVideoStarred(video.id);
        
        // Determine thumbnail source
        const thumbnailSrc = video.thumbnail || generateVideoThumbnail(video);
        
        // Create video preview modal
        const isLocalFile = video.localPath || video.url.startsWith('file://');
        
        videoCard.innerHTML = `
            <div class="video-thumbnail" data-video-id="${video.id}">
                <img src="${thumbnailSrc}" alt="${video.title}" onerror="this.src='${generateVideoThumbnail(video)}';">
                <video class="hover-preview" muted loop playsinline preload="metadata" src="${video.url}"></video>
                <div class="play-button">▶</div>
                <div class="video-duration-overlay">${video.duration}</div>
            </div>
            <div class="video-info">
                <div class="video-info-header">
                    <button class="star-button video-star ${isStarred ? 'starred' : ''}" data-video-id="${video.id}" title="${isStarred ? 'Remove from favorites' : 'Add to favorites'}">
                        ${isStarred ? '⭐' : '☆'}
                    </button>
                    <div class="video-title">${video.title}</div>
                </div>
                <div class="video-meta">
                    <span class="video-resolution">${video.resolution}</span>
                    ${video.fileSize ? `<span class="video-filesize">${video.fileSize}</span>` : ''}
                </div>
                ${video.filename ? `<div class="video-filename" title="${video.filename}">${video.filename}</div>` : ''}
            </div>
        `;
        
        // Add star button click handler
        const starButton = videoCard.querySelector('.video-star');
        starButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent video modal opening
            console.log('Video star button clicked for video ID:', video.id);
            toggleVideoStar(video.id);
            // Refresh the videos display to show new sorting
            displayVideos(videos);
        });
        
        // Add click handler for video preview
        const thumbnail = videoCard.querySelector('.video-thumbnail');
        const previewEl = videoCard.querySelector('.hover-preview');
        thumbnail.addEventListener('click', () => {
            console.log('Video thumbnail clicked:', video.title, 'Setting index to:', index);
            currentVideoIndex = index;
            showVideoModal(video);
        });
        if (previewEl) {
            thumbnail.addEventListener('mouseenter', () => {
                try { previewEl.currentTime = 0; previewEl.play(); } catch(e) {}
            });
            thumbnail.addEventListener('mouseleave', () => {
                previewEl.pause();
            });
        }
        
        resultsGrid.appendChild(videoCard);
    });
    
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(resultsGrid);
}

// Fetch numeric Adobe Stock ID for a given video by reading query_metadata.json in its folder
async function fetchAdobeId(video) {
    try {
        if (!video.url) return null;

        // Derive folder path of the query (strip filename)
        const lastSlash = video.url.lastIndexOf('/')
        if (lastSlash === -1) return null;
        const folderPath = video.url.substring(0, lastSlash);

        const metadataPath = `${folderPath}/query_metadata.json`;

        const response = await fetch(metadataPath + '?t=' + Date.now());
        if (!response.ok) return null;

        const metadata = await response.json();
        const mappings = metadata.video_file_mappings || {};

        // Attempt to match by filename (ignoring extension and case)
        const videoName = (video.filename || '').replace(/\.mp4$/i, '').toLowerCase();

        for (const [idKey, info] of Object.entries(mappings)) {
            const mapName = (info.filename || '').replace(/\.mp4$/i, '').toLowerCase();
            if (videoName && (mapName.includes(videoName) || videoName.includes(mapName))) {
                return idKey;
            }
        }

        // Fallback: Attempt to match by title if filename not successful
        const videoTitle = (video.title || '').toLowerCase();
        for (const [idKey, info] of Object.entries(mappings)) {
            const mapTitle = (info.title || '').toLowerCase();
            if (videoTitle && (mapTitle.includes(videoTitle) || videoTitle.includes(mapTitle))) {
                return idKey;
            }
        }
    } catch (err) {
        console.warn('Could not fetch Adobe ID:', err);
    }
    return null;
}

// Show video in modal
async function showVideoModal(video) {
    console.log('Opening video modal for:', video.title, 'Index:', currentVideoIndex);
    
    // Create modal if it doesn't exist
    let modal = document.getElementById('videoModal');
    if (!modal) {
        console.log('Creating new modal');
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
                    <div class="video-container">
                        <button class="nav-arrow nav-arrow-left" id="prevVideoBtn" title="Previous video">‹</button>
                        <video id="modalVideo" controls style="width: 100%; max-height: 70vh;">
                            Your browser does not support the video tag.
                        </video>
                        <button class="nav-arrow nav-arrow-right" id="nextVideoBtn" title="Next video">›</button>
                    </div>
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
        
        // Add navigation handlers
        const prevBtn = modal.querySelector('#prevVideoBtn');
        const nextBtn = modal.querySelector('#nextVideoBtn');
        
        if (prevBtn && nextBtn) {
            prevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('Previous button clicked');
                navigateVideo(-1);
            });
            
            nextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('Next button clicked');
                navigateVideo(1);
            });
        }
    }
    
    // Remove any existing keydown listeners to prevent duplicates
    document.removeEventListener('keydown', handleModalKeydown);
    // Add fresh keydown listener
    document.addEventListener('keydown', handleModalKeydown);
    
    // Update navigation button visibility
    updateNavigationButtons();
    
    // Update modal content
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) {
        modalTitle.textContent = video.title;
    }
    
    const videoElement = document.getElementById('modalVideo');
    if (videoElement) {
        videoElement.src = video.url;
    }
    
    // Ensure we have the Adobe Stock numeric ID
    if (!video.adobeId) {
        video.adobeId = await fetchAdobeId(video);
    }

    const details = `
        <div class="detail-row"><strong>Duration:</strong> ${video.duration}</div>
        <div class="detail-row"><strong>Resolution:</strong> ${video.resolution}</div>
        ${video.fileSize ? `<div class="detail-row"><strong>File Size:</strong> ${video.fileSize}</div>` : ''}
        ${video.filename ? `<div class="detail-row"><strong>Filename:</strong> ${video.filename}</div>` : ''}
        ${video.adobeId ? `<div class="detail-row"><strong>Video ID:</strong> ${video.adobeId}</div>` : ''}
    `;
    const modalDetails = document.getElementById('modalDetails');
    if (modalDetails) {
        modalDetails.innerHTML = details;
    }
    
    // Show modal
    modal.style.display = 'block';
    
    // Auto-play if possible
    if (videoElement) {
        videoElement.play().catch(() => {
            console.log('Auto-play failed (this is normal)');
        });
    }
    
    console.log('Modal opened successfully');
}

// Handle keyboard navigation in modal
function handleModalKeydown(e) {
    const modal = document.getElementById('videoModal');
    if (!modal || modal.style.display === 'none') return;
    
    console.log('Key pressed in modal:', e.key);
    
    switch(e.key) {
        case 'Escape':
            closeVideoModal();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            navigateVideo(-1);
            break;
        case 'ArrowRight':
            e.preventDefault();
            navigateVideo(1);
            break;
    }
}

// Navigate to previous or next video
function navigateVideo(direction) {
    console.log('Navigate called with direction:', direction);
    console.log('Current video list length:', currentVideoList?.length);
    console.log('Current video index:', currentVideoIndex);
    
    if (!currentVideoList || currentVideoList.length <= 1) {
        console.log('Navigation not possible - insufficient videos');
        return;
    }
    
    const oldIndex = currentVideoIndex;
    currentVideoIndex += direction;
    
    // Wrap around if needed
    if (currentVideoIndex < 0) {
        currentVideoIndex = currentVideoList.length - 1;
    } else if (currentVideoIndex >= currentVideoList.length) {
        currentVideoIndex = 0;
    }
    
    console.log('Navigating from index', oldIndex, 'to', currentVideoIndex);
    
    const nextVideo = currentVideoList[currentVideoIndex];
    if (nextVideo) {
        console.log('Loading video:', nextVideo.title);
        showVideoModal(nextVideo);
    } else {
        console.error('Next video not found at index:', currentVideoIndex);
    }
}

// Update navigation button visibility and state
function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevVideoBtn');
    const nextBtn = document.getElementById('nextVideoBtn');
    
    console.log('Updating navigation buttons. Found prev:', !!prevBtn, 'next:', !!nextBtn);
    console.log('Video list length:', currentVideoList?.length);
    
    if (!prevBtn || !nextBtn) {
        console.log('Navigation buttons not found in DOM');
        return;
    }
    
    if (!currentVideoList || currentVideoList.length <= 1) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        console.log('Navigation buttons hidden - not enough videos');
    } else {
        prevBtn.style.display = 'block';
        nextBtn.style.display = 'block';
        console.log('Navigation buttons shown');
    }
}

// Close video modal
function closeVideoModal() {
    console.log('Closing video modal');
    const modal = document.getElementById('videoModal');
    if (modal) {
        modal.style.display = 'none';
        const video = document.getElementById('modalVideo');
        if (video) {
            video.pause();
            video.src = '';
        }
    }
    
    // Remove keydown listener when modal closes
    document.removeEventListener('keydown', handleModalKeydown);
    console.log('Modal closed and event listeners cleaned up');
}

// Generate a placeholder thumbnail for videos
function generateVideoThumbnail(video) {
    const colors = ['4CAF50', '2196F3', '9C27B0', '3F51B5', 'FF5722', '607D8B', '795548', 'E91E63', '009688', 'FFC107'];
    const colorIndex = Math.abs(video.id.charCodeAt(0)) % colors.length;
    const color = colors[colorIndex];
    const title = encodeURIComponent(video.title.substring(0, 15));
    return `https://via.placeholder.com/300x180/${color}/white?text=${title}`;
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

    /* --- Hover video preview styles --- */
    .hover-preview {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0;
        transition: opacity 0.2s ease-in-out;
        pointer-events: none;
    }

    .video-thumbnail:hover .hover-preview {
        opacity: 1;
    }

    .video-thumbnail:hover img,
    .video-thumbnail:hover .play-button,
    .video-thumbnail:hover .video-duration-overlay {
        opacity: 0;
    }
`;

// Add additional styles to the page
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

// Export functions for potential external use
window.AdobeStockViz = {
    loadScrapingData,
    selectSubconcept,
    selectQuery,
    scrapingResults,
    startAutoUpdate,
    stopAutoUpdate,
    checkForUpdates
};

// Star management functions
function getStarredQueries() {
    const starred = localStorage.getItem('starredQueries');
    return starred ? JSON.parse(starred) : [];
}

function setStarredQueries(starredList) {
    localStorage.setItem('starredQueries', JSON.stringify(starredList));
}

function isQueryStarred(folder) {
    const starred = getStarredQueries();
    return starred.includes(folder);
}

function toggleQueryStar(folder) {
    console.log('Toggling star for query folder:', folder);
    let starred = getStarredQueries();
    console.log('Current starred queries:', starred);
    
    if (starred.includes(folder)) {
        // Remove from starred
        starred = starred.filter(f => f !== folder);
        console.log('Removed from starred queries');
    } else {
        // Add to starred
        starred.push(folder);
        console.log('Added to starred queries');
    }
    
    setStarredQueries(starred);
    console.log('Updated starred queries:', starred);
}

// Video star management functions
function getStarredVideos() {
    const starred = localStorage.getItem('starredVideos');
    return starred ? JSON.parse(starred) : [];
}

function setStarredVideos(starredList) {
    localStorage.setItem('starredVideos', JSON.stringify(starredList));
}

function isVideoStarred(videoId) {
    const starred = getStarredVideos();
    return starred.includes(videoId);
}

function toggleVideoStar(videoId) {
    console.log('Toggling star for video ID:', videoId);
    let starred = getStarredVideos();
    console.log('Current starred videos:', starred);
    
    if (starred.includes(videoId)) {
        // Remove from starred
        starred = starred.filter(id => id !== videoId);
        console.log('Removed video from starred');
    } else {
        // Add to starred
        starred.push(videoId);
        console.log('Added video to starred');
    }
    
    setStarredVideos(starred);
    console.log('Updated starred videos:', starred);
}

// Switch between video view and ranking view
function switchViewMode(mode) {
    console.log('switchViewMode called with mode:', mode);
    console.log('Current query:', currentQuery);
    console.log('Current view mode before switch:', currentViewMode);
    
    currentViewMode = mode;
    const videoBtn = document.getElementById('videoViewBtn');
    const rankingBtn = document.getElementById('rankingViewBtn');
    const labelingBtn = document.getElementById('labelingViewBtn');
    
    console.log('Video button found:', !!videoBtn);
    console.log('Ranking button found:', !!rankingBtn);
    console.log('Labeling button found:', !!labelingBtn);
    
    if (mode === 'videos') {
        console.log('Switching to videos mode');
        if (videoBtn) videoBtn.classList.add('active');
        if (rankingBtn) rankingBtn.classList.remove('active');
        if (labelingBtn) labelingBtn.classList.remove('active');
        if (currentQuery) {
            console.log('Calling displayVideos with:', currentQuery.videos.length, 'videos');
            
            // Ensure proper DOM structure exists for video display
            let resultsContainer = document.getElementById('resultsContainer');
            if (!resultsContainer) {
                console.log('resultsContainer not found, recreating proper structure');
                const mainContent = document.querySelector('.main-content');
                mainContent.innerHTML = `
                    <div class="results-section">
                        <div class="view-mode-tabs">
                            <button id="videoViewBtn" class="view-tab active" onclick="switchViewMode('videos')">
                                📹 Videos
                            </button>
                            <button id="rankingViewBtn" class="view-tab" onclick="switchViewMode('rankings')">
                                🏆 Rankings
                            </button>
                            <button id="labelingViewBtn" class="view-tab" onclick="switchViewMode('labeling')">
                                🏷️ Labeling
                            </button>
                        </div>
                        <h2>Results for "${currentQuery.query}"</h2>
                        <div id="resultsContainer"></div>
                    </div>
                `;
            }
            
            displayVideos(currentQuery.videos);
        } else {
            console.log('No current query available for video display');
        }
    } else if (mode === 'rankings') {
        console.log('Switching to rankings mode');
        if (rankingBtn) rankingBtn.classList.add('active');
        if (videoBtn) videoBtn.classList.remove('active');
        if (labelingBtn) labelingBtn.classList.remove('active');
        if (currentQuery) {
            console.log('Calling displayRankings with query:', currentQuery.query);
            displayRankings(currentQuery);
        } else {
            console.log('No current query available for rankings display');
        }
    } else if (mode === 'labeling') {
        console.log('Switching to labeling mode');
        if (labelingBtn) labelingBtn.classList.add('active');
        if (videoBtn) videoBtn.classList.remove('active');
        if (rankingBtn) rankingBtn.classList.remove('active');
        if (currentQuery) {
            console.log('Calling displayLabeling with query:', currentQuery.query);
            displayLabeling(currentQuery);
        } else {
            console.log('No current query available for labeling display');
        }
    }
    console.log('switchViewMode completed');
}

// Display ranking results for a query
function displayRankings(queryData) {
    const mainContent = document.querySelector('.main-content');
    
    // Look for ranking results for this query
    const queryFolder = queryData.folder;
    const ranking = findRankingForQuery(queryFolder);
    
    if (!ranking) {
        mainContent.innerHTML = `
            <div class="results-section">
                <div class="view-mode-tabs">
                    <button id="videoViewBtn" class="view-tab" onclick="switchViewMode('videos')">
                        📹 Videos
                    </button>
                    <button id="rankingViewBtn" class="view-tab active" onclick="switchViewMode('rankings')">
                        🏆 Rankings
                    </button>
                    <button id="labelingViewBtn" class="view-tab" onclick="switchViewMode('labeling')">
                        🏷️ Labeling
                    </button>
                </div>
                <h2>🏆 VQA Score Rankings</h2>
                <div style="text-align: center; padding: 40px; color: #6c757d;">
                    <div style="font-size: 3em; margin-bottom: 20px;">📊</div>
                    <h3>No ranking results found</h3>
                    <p>No ranking_results.json file found for "${queryData.query}"</p>
                    <small>Generate rankings using VQA scoring first</small>
                </div>
            </div>
        `;
        return;
    }
    
    const { metadata, statistics, results } = ranking;
    
    // Sort ranking results: starred videos first, then by rank
    const sortedResults = [...results].sort((a, b) => {
        const videoDataA = findVideoDataForRanking(a.filename);
        const videoDataB = findVideoDataForRanking(b.filename);
        
        const aStarred = videoDataA ? isVideoStarred(videoDataA.id) : false;
        const bStarred = videoDataB ? isVideoStarred(videoDataB.id) : false;
        
        if (aStarred && !bStarred) return -1;
        if (!aStarred && bStarred) return 1;
        return a.rank - b.rank;
    });
    
    // Store current video list for navigation (from ranking results)
    currentVideoList = sortedResults.map(result => findVideoDataForRanking(result.filename)).filter(Boolean);
    
    mainContent.innerHTML = `
        <div class="results-section">
            <div class="view-mode-tabs">
                <button id="videoViewBtn" class="view-tab" onclick="switchViewMode('videos')">
                    📹 Videos
                </button>
                <button id="rankingViewBtn" class="view-tab active" onclick="switchViewMode('rankings')">
                    🏆 Rankings
                </button>
                <button id="labelingViewBtn" class="view-tab" onclick="switchViewMode('labeling')">
                    🏷️ Labeling
                </button>
            </div>
            <div class="ranking-header">
                <h2>🏆 VQA Score Rankings</h2>
                <div class="query-info">
                    <h3>"${metadata.search_query}"</h3>
                    <p>Generated: ${formatDate(metadata.generated)}</p>
                </div>
            </div>
            
            <div class="ranking-stats">
                <div class="stat-card">
                    <div class="stat-value">${results.length}</div>
                    <div class="stat-label">Videos Ranked</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${statistics.highest_score.toFixed(4)}</div>
                    <div class="stat-label">Highest Score</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${statistics.lowest_score.toFixed(4)}</div>
                    <div class="stat-label">Lowest Score</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${statistics.average_score.toFixed(4)}</div>
                    <div class="stat-label">Average Score</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${metadata.processing_fps}</div>
                    <div class="stat-label">Processing FPS</div>
                </div>
            </div>
            
            <div class="ranking-list">
                ${sortedResults.map((video, index) => createRankingCard(video, metadata, index)).join('')}
            </div>
        </div>
    `;
    
    // Add click handlers for video thumbnails and star buttons in ranking cards
    setTimeout(() => {
        const rankingThumbnails = document.querySelectorAll('.ranking-thumbnail');
        rankingThumbnails.forEach((thumbnail, index) => {
            thumbnail.addEventListener('click', () => {
                try {
                    const videoDataStr = thumbnail.getAttribute('data-video-data');
                    if (videoDataStr) {
                        const videoData = JSON.parse(videoDataStr);
                        currentVideoIndex = index;
                        showVideoModal(videoData);
                    }
                } catch (error) {
                    console.error('Error playing video from ranking:', error);
                }
            });
        });
        
        // Add star button handlers
        const starButtons = document.querySelectorAll('.ranking-star');
        starButtons.forEach(starButton => {
            starButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent video modal opening
                const videoId = starButton.getAttribute('data-video-id');
                toggleVideoStar(videoId);
                // Refresh the rankings display to show new sorting
                displayRankings(queryData);
            });
        });
    }, 100); // Small delay to ensure DOM is ready
}

// Create a ranking card for a video
function createRankingCard(video, metadata, index) {
    const scorePercentage = (video.score * 100).toFixed(2);
    const scoreClass = getScoreClass(video.score);
    
    // Find the corresponding video data from the current query
    const videoData = findVideoDataForRanking(video.filename);
    const thumbnailSrc = videoData ? (videoData.thumbnail || generateVideoThumbnail(videoData)) : null;
    const isStarred = videoData ? isVideoStarred(videoData.id) : false;
    
    return `
        <div class="ranking-card">
            <div class="rank-badge rank-${video.rank}">
                #${video.rank}
            </div>
            ${thumbnailSrc ? `
            <div class="ranking-video-preview">
                <div class="ranking-thumbnail" data-video-data='${JSON.stringify(videoData)}'>
                    <img src="${thumbnailSrc}" alt="${formatVideoTitle(video.filename)}" onerror="this.style.display='none';">
                    <div class="ranking-play-button">▶</div>
                    <div class="ranking-duration-overlay">${videoData.duration || '0:00'}</div>
                </div>
            </div>
            ` : ''}
            <div class="ranking-content">
                <div class="ranking-main">
                    <div class="ranking-title-section">
                        ${videoData ? `
                        <button class="star-button ranking-star ${isStarred ? 'starred' : ''}" data-video-id="${videoData.id}" title="${isStarred ? 'Remove from favorites' : 'Add to favorites'}">
                            ${isStarred ? '⭐' : '☆'}
                        </button>
                        ` : ''}
                        <div class="video-title-ranking">${formatVideoTitle(video.filename)}</div>
                    </div>
                    <div class="score-container">
                        <div class="score-badge ${scoreClass}">
                            ${scorePercentage}%
                        </div>
                        <div class="score-bar">
                            <div class="score-fill ${scoreClass}" style="width: ${scorePercentage}%"></div>
                        </div>
                    </div>
                </div>
                <div class="ranking-metadata">
                    <div class="metadata-grid">
                        <div class="metadata-item">
                            <span class="metadata-label">Score:</span>
                            <span class="metadata-value">${video.score.toFixed(6)}</span>
                        </div>
                        <div class="metadata-item">
                            <span class="metadata-label">FPS:</span>
                            <span class="metadata-value">${video.fps}</span>
                        </div>
                        <div class="metadata-item">
                            <span class="metadata-label">Task:</span>
                            <span class="metadata-value">${video.task}</span>
                        </div>
                        <div class="metadata-item">
                            <span class="metadata-label">Query:</span>
                            <span class="metadata-value">"${video.text_description}"</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Find video data that matches a ranking filename
function findVideoDataForRanking(filename) {
    if (!currentQuery || !currentQuery.videos) {
        return null;
    }
    
    // Try to match by exact filename
    let videoData = currentQuery.videos.find(video => video.filename === filename);
    
    // If no exact match, try partial matches
    if (!videoData) {
        videoData = currentQuery.videos.find(video => 
            video.filename.includes(filename.replace('.mp4', '')) || 
            filename.includes(video.filename.replace('.mp4', ''))
        );
    }
    
    return videoData;
}

// Find ranking results for a query folder
function findRankingForQuery(queryFolder) {
    // Look for matching ranking results
    for (const [folderPath, ranking] of Object.entries(rankingResults)) {
        // Check if the folder path matches or contains the query folder
        if (folderPath.includes(queryFolder) || 
            folderPath.endsWith(queryFolder) ||
            queryFolder.includes(folderPath.split('/').pop())) {
            return ranking;
        }
    }
    return null;
}

// Format video filename for display
function formatVideoTitle(filename) {
    return filename
        .replace(/\.mp4$/i, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}

// Get CSS class based on score
function getScoreClass(score) {
    if (score >= 0.8) return 'score-excellent';
    if (score >= 0.6) return 'score-good';
    if (score >= 0.4) return 'score-fair';
    if (score >= 0.2) return 'score-poor';
    return 'score-very-poor';
}

// ===== VIDEO LABELING FUNCTIONS =====

// Get labeled videos from localStorage
function getLabeledVideos() {
    try {
        const labeled = localStorage.getItem('labeledVideos');
        return labeled ? JSON.parse(labeled) : {};
    } catch (error) {
        console.error('Error getting labeled videos:', error);
        return {};
    }
}

// Set labeled videos in localStorage
function setLabeledVideos(labeledDict) {
    try {
        localStorage.setItem('labeledVideos', JSON.stringify(labeledDict));
    } catch (error) {
        console.error('Error setting labeled videos:', error);
    }
}

// Check if a video is labeled as "Yes"
function isVideoLabeled(videoId) {
    const labeled = getLabeledVideos();
    return labeled[videoId] === 'yes';
}

// Toggle video label between "No" and "Yes"
function toggleVideoLabel(videoId) {
    const labeled = getLabeledVideos();
    const currentLabel = labeled[videoId] || 'no';
    const newLabel = currentLabel === 'yes' ? 'no' : 'yes';
    
    labeled[videoId] = newLabel;
    setLabeledVideos(labeled);
    
    console.log(`Video ${videoId} labeled as: ${newLabel}`);
    return newLabel;
}

// Get all videos labeled as "Yes" for current query
function getYesLabeledVideos() {
    if (!currentQuery || !currentQuery.videos) return [];
    
    const labeled = getLabeledVideos();
    return currentQuery.videos.filter(video => labeled[video.id] === 'yes');
}

// Display labeling interface for videos
function displayLabeling(queryData) {
    const mainContent = document.querySelector('.main-content');
    
    if (!queryData.videos || queryData.videos.length === 0) {
        mainContent.innerHTML = `
            <div class="results-section">
                <div class="view-mode-tabs">
                    <button id="videoViewBtn" class="view-tab" onclick="switchViewMode('videos')">
                        📹 Videos
                    </button>
                    <button id="rankingViewBtn" class="view-tab" onclick="switchViewMode('rankings')">
                        🏆 Rankings
                    </button>
                    <button id="labelingViewBtn" class="view-tab active" onclick="switchViewMode('labeling')">
                        🏷️ Labeling
                    </button>
                </div>
                <h2>🏷️ Video Labeling</h2>
                <div style="text-align: center; padding: 40px; color: #6c757d;">
                    <div style="font-size: 3em; margin-bottom: 20px;">📹</div>
                    <h3>No videos to label</h3>
                    <p>This query has no videos to label</p>
                </div>
            </div>
        `;
        return;
    }

    const labeledVideos = getLabeledVideos();
    const yesCount = queryData.videos.filter(video => labeledVideos[video.id] === 'yes').length;
    
    // Sort videos: labeled "Yes" first, then "No", then unlabeled
    const sortedVideos = [...queryData.videos].sort((a, b) => {
        const aLabel = labeledVideos[a.id] || 'no';
        const bLabel = labeledVideos[b.id] || 'no';
        
        if (aLabel === 'yes' && bLabel !== 'yes') return -1;
        if (aLabel !== 'yes' && bLabel === 'yes') return 1;
        return a.title.localeCompare(b.title);
    });

    mainContent.innerHTML = `
        <div class="results-section">
            <div class="view-mode-tabs">
                <button id="videoViewBtn" class="view-tab" onclick="switchViewMode('videos')">
                    📹 Videos
                </button>
                <button id="rankingViewBtn" class="view-tab" onclick="switchViewMode('rankings')">
                    🏆 Rankings
                </button>
                <button id="labelingViewBtn" class="view-tab active" onclick="switchViewMode('labeling')">
                    🏷️ Labeling
                </button>
            </div>
            <div class="labeling-header">
                <h2>🏷️ Video Labeling</h2>
                <div class="labeling-info">
                    <h3>"${queryData.query}"</h3>
                    <div class="labeling-stats">
                        <span class="stat-badge yes-count">${yesCount} labeled Yes</span>
                        <span class="stat-badge total-count">${queryData.videos.length} total videos</span>
                    </div>
                </div>
                <div class="labeling-actions">
                    <button id="exportLabelsBtn" class="export-button" ${yesCount === 0 ? 'disabled' : ''}>
                        📤 Export ${yesCount} Videos
                    </button>
                    <button id="clearLabelsBtn" class="clear-button">
                        🗑️ Clear All Labels
                    </button>
                </div>
            </div>
            <div id="labelingContainer" class="labeling-grid"></div>
        </div>
    `;

    // Create labeling grid
    const labelingContainer = document.getElementById('labelingContainer');
    const labelingGrid = document.createElement('div');
    labelingGrid.className = 'results-grid';

    sortedVideos.forEach((video, index) => {
        const currentLabel = labeledVideos[video.id] || 'no';
        const thumbnailSrc = video.thumbnail || generateVideoThumbnail(video);
        
        const videoCard = document.createElement('div');
        videoCard.className = `video-card labeling-card ${currentLabel === 'yes' ? 'labeled-yes' : 'labeled-no'}`;
        
        videoCard.innerHTML = `
            <div class="video-thumbnail" data-video-id="${video.id}">
                <img src="${thumbnailSrc}" alt="${video.title}" onerror="this.src='${generateVideoThumbnail(video)}';">
                <div class="play-button">▶</div>
                <div class="video-duration-overlay">${video.duration}</div>
                <div class="label-overlay ${currentLabel === 'yes' ? 'label-yes' : 'label-no'}">
                    ${currentLabel === 'yes' ? '✅ YES' : '❌ NO'}
                </div>
            </div>
            <div class="video-info">
                <div class="video-title">${video.title}</div>
                <div class="video-meta">
                    <span class="video-resolution">${video.resolution}</span>
                    ${video.fileSize ? `<span class="video-filesize">${video.fileSize}</span>` : ''}
                </div>
                ${video.filename ? `<div class="video-filename" title="${video.filename}">${video.filename}</div>` : ''}
                <div class="labeling-controls">
                    <button class="label-button label-no ${currentLabel === 'no' ? 'active' : ''}" data-video-id="${video.id}" data-label="no">
                        ❌ No
                    </button>
                    <button class="label-button label-yes ${currentLabel === 'yes' ? 'active' : ''}" data-video-id="${video.id}" data-label="yes">
                        ✅ Yes
                    </button>
                </div>
            </div>
        `;
        
        // Add click handler for video preview
        const thumbnail = videoCard.querySelector('.video-thumbnail');
        thumbnail.addEventListener('click', () => {
            currentVideoIndex = index;
            currentVideoList = sortedVideos;
            showLabelingVideoModal(video);
        });
        
        // Add click handlers for label buttons
        const labelButtons = videoCard.querySelectorAll('.label-button');
        labelButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const videoId = button.getAttribute('data-video-id');
                const targetLabel = button.getAttribute('data-label');
                
                // Update the label
                const labeled = getLabeledVideos();
                labeled[videoId] = targetLabel;
                setLabeledVideos(labeled);
                
                // Refresh the labeling display
                displayLabeling(queryData);
            });
        });
        
        labelingGrid.appendChild(videoCard);
    });
    
    labelingContainer.appendChild(labelingGrid);
    
    // Add action button handlers
    setTimeout(() => {
        const exportBtn = document.getElementById('exportLabelsBtn');
        const clearBtn = document.getElementById('clearLabelsBtn');
        
        if (exportBtn) {
            exportBtn.addEventListener('click', () => exportLabeledVideos(queryData));
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear all labels for this query?')) {
                    clearQueryLabels(queryData);
                    displayLabeling(queryData);
                }
            });
        }
    }, 100);
}

// Clear all labels for current query
function clearQueryLabels(queryData) {
    const labeled = getLabeledVideos();
    queryData.videos.forEach(video => {
        delete labeled[video.id];
    });
    setLabeledVideos(labeled);
}

// Export labeled videos to JSON file
async function exportLabeledVideos(queryData) {
    const yesVideos = getYesLabeledVideos();
    
    if (yesVideos.length === 0) {
        alert('No videos labeled as "Yes" to export');
        return;
    }
    
    // Create export data structure
    const exportData = {
        query: queryData.query,
        folder: queryData.folder,
        timestamp: new Date().toISOString(),
        exported_videos: yesVideos.map(video => ({
            id: video.id,
            title: video.title,
            filename: video.filename,
            url: video.url,
            thumbnail: video.thumbnail,
            duration: video.duration,
            resolution: video.resolution,
            fileSize: video.fileSize
        }))
    };
    
    try {
        // Send to backend to save the file
        const response = await fetch('/api/export-labels', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                queryFolder: queryData.folder,
                data: exportData
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            alert(`Successfully exported ${yesVideos.length} videos to ${result.filename}`);
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Export failed');
        }
    } catch (error) {
        console.error('Export error:', error);
        alert(`Export failed: ${error.message}`);
    }
}

// Show video in labeling modal with labeling controls
async function showLabelingVideoModal(video) {
    console.log('Opening labeling video modal for:', video.title, 'Index:', currentVideoIndex);
    
    // Create modal if it doesn't exist
    let modal = document.getElementById('labelingVideoModal');
    if (!modal) {
        console.log('Creating new labeling modal');
        modal = document.createElement('div');
        modal.id = 'labelingVideoModal';
        modal.className = 'video-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="labelingModalTitle"></h3>
                    <span class="close">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="video-container">
                        <button class="nav-arrow nav-arrow-left" id="prevLabelingVideoBtn" title="Previous video">‹</button>
                        <video id="labelingModalVideo" controls style="width: 100%; max-height: 60vh;">
                            Your browser does not support the video tag.
                        </video>
                        <button class="nav-arrow nav-arrow-right" id="nextLabelingVideoBtn" title="Next video">›</button>
                    </div>
                    <div class="labeling-modal-controls">
                        <div class="current-label-status">
                            <span class="label-status-text">Current Label:</span>
                            <span id="currentLabelDisplay" class="current-label-badge">No</span>
                        </div>
                        <div class="labeling-modal-buttons">
                            <button id="labelingModalNoBtn" class="label-button label-no">
                                ❌ No
                            </button>
                            <button id="labelingModalYesBtn" class="label-button label-yes">
                                ✅ Yes
                            </button>
                        </div>
                    </div>
                    <div class="video-details" id="labelingModalDetails"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Add close handlers
        const closeBtn = modal.querySelector('.close');
        closeBtn.addEventListener('click', closeLabelingVideoModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeLabelingVideoModal();
        });
        
        // Add navigation handlers
        const prevBtn = modal.querySelector('#prevLabelingVideoBtn');
        const nextBtn = modal.querySelector('#nextLabelingVideoBtn');
        
        if (prevBtn && nextBtn) {
            prevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('Previous button clicked in labeling modal');
                navigateLabelingVideo(-1);
            });
            
            nextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('Next button clicked in labeling modal');
                navigateLabelingVideo(1);
            });
        }
        
        // Add labeling button handlers
        const noBtn = modal.querySelector('#labelingModalNoBtn');
        const yesBtn = modal.querySelector('#labelingModalYesBtn');
        
        noBtn.addEventListener('click', () => {
            updateVideoLabelInModal(video.id, 'no');
        });
        
        yesBtn.addEventListener('click', () => {
            updateVideoLabelInModal(video.id, 'yes');
        });
    }
    
    // Remove any existing keydown listeners to prevent duplicates
    document.removeEventListener('keydown', handleLabelingModalKeydown);
    // Add fresh keydown listener
    document.addEventListener('keydown', handleLabelingModalKeydown);
    
    // Update navigation button visibility
    updateLabelingNavigationButtons();
    
    // Update modal content
    const modalTitle = document.getElementById('labelingModalTitle');
    if (modalTitle) {
        modalTitle.textContent = video.title;
    }
    
    const videoElement = document.getElementById('labelingModalVideo');
    if (videoElement) {
        videoElement.src = video.url;
    }
    
    // Update labeling controls
    updateLabelingModalControls(video.id);
    
    // Ensure we have the Adobe Stock numeric ID
    if (!video.adobeId) {
        video.adobeId = await fetchAdobeId(video);
    }

    const details = `
        <div class="detail-row"><strong>Duration:</strong> ${video.duration}</div>
        <div class="detail-row"><strong>Resolution:</strong> ${video.resolution}</div>
        ${video.fileSize ? `<div class="detail-row"><strong>File Size:</strong> ${video.fileSize}</div>` : ''}
        ${video.filename ? `<div class="detail-row"><strong>Filename:</strong> ${video.filename}</div>` : ''}
        ${video.adobeId ? `<div class="detail-row"><strong>Video ID:</strong> ${video.adobeId}</div>` : ''}
    `;
    const modalDetails = document.getElementById('labelingModalDetails');
    if (modalDetails) {
        modalDetails.innerHTML = details;
    }
    
    // Show modal
    modal.style.display = 'block';
    
    // Auto-play if possible
    if (videoElement) {
        videoElement.play().catch(() => {
            console.log('Auto-play failed (this is normal)');
        });
    }
    
    console.log('Labeling modal opened successfully');
}

// Update labeling controls in the modal
function updateLabelingModalControls(videoId) {
    const labeled = getLabeledVideos();
    const currentLabel = labeled[videoId] || 'no';
    
    const currentLabelDisplay = document.getElementById('currentLabelDisplay');
    const noBtn = document.getElementById('labelingModalNoBtn');
    const yesBtn = document.getElementById('labelingModalYesBtn');
    
    if (currentLabelDisplay) {
        currentLabelDisplay.textContent = currentLabel === 'yes' ? 'Yes' : 'No';
        currentLabelDisplay.className = `current-label-badge ${currentLabel === 'yes' ? 'label-yes' : 'label-no'}`;
    }
    
    if (noBtn && yesBtn) {
        noBtn.classList.toggle('active', currentLabel === 'no');
        yesBtn.classList.toggle('active', currentLabel === 'yes');
    }
}

// Update video label from modal and refresh displays
function updateVideoLabelInModal(videoId, newLabel) {
    const labeled = getLabeledVideos();
    labeled[videoId] = newLabel;
    setLabeledVideos(labeled);
    
    console.log(`Video ${videoId} labeled as: ${newLabel} from modal`);
    
    // Update the modal controls
    updateLabelingModalControls(videoId);
    
    // If the main labeling view is still visible, refresh it
    if (currentViewMode === 'labeling' && currentQuery) {
        // Small delay to ensure modal updates first
        setTimeout(() => {
            displayLabeling(currentQuery);
        }, 100);
    }
}

// Toggle video label between Yes/No in modal (for space bar)
function toggleVideoLabelInModal(videoId) {
    const labeled = getLabeledVideos();
    const currentLabel = labeled[videoId] || 'no';
    const newLabel = currentLabel === 'yes' ? 'no' : 'yes';
    
    updateVideoLabelInModal(videoId, newLabel);
    console.log(`Video ${videoId} toggled from ${currentLabel} to ${newLabel}`);
}

// Handle keyboard navigation in labeling modal
function handleLabelingModalKeydown(e) {
    const modal = document.getElementById('labelingVideoModal');
    if (!modal || modal.style.display === 'none') return;
    
    console.log('Key pressed in labeling modal:', e.key);
    
    switch(e.key) {
        case 'Escape':
            closeLabelingVideoModal();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            navigateLabelingVideo(-1);
            break;
        case 'ArrowRight':
            e.preventDefault();
            navigateLabelingVideo(1);
            break;
        case ' ': // Space bar
            e.preventDefault();
            if (currentVideoList && currentVideoList[currentVideoIndex]) {
                toggleVideoLabelInModal(currentVideoList[currentVideoIndex].id);
            }
            break;
        case '1':
        case 'n':
        case 'N':
            e.preventDefault();
            if (currentVideoList && currentVideoList[currentVideoIndex]) {
                updateVideoLabelInModal(currentVideoList[currentVideoIndex].id, 'no');
            }
            break;
        case '2':
        case 'y':
        case 'Y':
            e.preventDefault();
            if (currentVideoList && currentVideoList[currentVideoIndex]) {
                updateVideoLabelInModal(currentVideoList[currentVideoIndex].id, 'yes');
            }
            break;
    }
}

// Navigate to previous or next video in labeling modal
function navigateLabelingVideo(direction) {
    console.log('Navigate labeling called with direction:', direction);
    console.log('Current video list length:', currentVideoList?.length);
    console.log('Current video index:', currentVideoIndex);
    
    if (!currentVideoList || currentVideoList.length <= 1) {
        console.log('Navigation not possible - insufficient videos');
        return;
    }
    
    const oldIndex = currentVideoIndex;
    currentVideoIndex += direction;
    
    // Wrap around if needed
    if (currentVideoIndex < 0) {
        currentVideoIndex = currentVideoList.length - 1;
    } else if (currentVideoIndex >= currentVideoList.length) {
        currentVideoIndex = 0;
    }
    
    console.log('Navigating from index', oldIndex, 'to', currentVideoIndex);
    
    const nextVideo = currentVideoList[currentVideoIndex];
    if (nextVideo) {
        console.log('Loading video:', nextVideo.title);
        showLabelingVideoModal(nextVideo);
    } else {
        console.error('Next video not found at index:', currentVideoIndex);
    }
}

// Update navigation button visibility for labeling modal
function updateLabelingNavigationButtons() {
    const prevBtn = document.getElementById('prevLabelingVideoBtn');
    const nextBtn = document.getElementById('nextLabelingVideoBtn');
    
    console.log('Updating labeling navigation buttons. Found prev:', !!prevBtn, 'next:', !!nextBtn);
    console.log('Video list length:', currentVideoList?.length);
    
    if (!prevBtn || !nextBtn) {
        console.log('Labeling navigation buttons not found in DOM');
        return;
    }
    
    if (!currentVideoList || currentVideoList.length <= 1) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        console.log('Labeling navigation buttons hidden - not enough videos');
    } else {
        prevBtn.style.display = 'block';
        nextBtn.style.display = 'block';
        console.log('Labeling navigation buttons shown');
    }
}

// Close labeling video modal
function closeLabelingVideoModal() {
    console.log('Closing labeling video modal');
    const modal = document.getElementById('labelingVideoModal');
    if (modal) {
        modal.style.display = 'none';
        const video = document.getElementById('labelingModalVideo');
        if (video) {
            video.pause();
            video.src = '';
        }
    }
    
    // Remove keydown listener when modal closes
    document.removeEventListener('keydown', handleLabelingModalKeydown);
    console.log('Labeling modal closed and event listeners cleaned up');
}