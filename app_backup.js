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

// New variables for enhanced ranking functionality
let truePosGoal = 100; // Default goal for true positive videos
let videosDisplayed = 100; // Number of videos to display for annotation setup
let sampleSize = 100; // Sample size for each range
let samplingResults = {}; // Store sampling results for each range
let currentDatasetPools = []; // Store dataset pools that meet the goal

// Preview state for labeling modal
let currentPreviewLabel = null; // Preview label (not yet committed)
let hasPreviewChanges = false; // Whether there are uncommitted preview changes

let currentCategory = null;
let currentSubconcept = null;
let currentQuery = null;
let lastUpdateCheck = 0;
let autoUpdateInterval = null;
let currentViewMode = 'videos'; // 'videos' or 'rankings'
let currentVideoList = []; // Store current video list for navigation
let currentVideoIndex = 0; // Track current video index for navigation

// Pagination variables
let currentPage = 1;
let videosPerPage = 100;
let totalPages = 1;
let allVideos = []; // Store all videos for current query

// ===== INITIALIZATION FUNCTIONS =====

// Initialize labels on app startup
async function initializeLabels() {
    try {
        console.log('Initializing labels...');
        await initializeLabelCache(); // Use the new optimized cache system
        console.log('Labels initialized successfully');
    } catch (error) {
        console.warn('Error initializing labels:', error);
    }
}

// Page load handler
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM content loaded');
    
    // Initialize labels
    await initializeLabels();
    
    // Load initial data
    loadInitialData();
});

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadInitialData();
    loadRankingResults();
    // Removed automatic update - now using manual button
});

// Load initial data from annotation API endpoint or fall back to scraped-data.json
async function loadInitialData() {
    try {
        // Try to load from the new annotation data API endpoint first
        await loadAnnotationData();
    } catch (error) {
        console.log('No annotation data API available, trying scraped-data.json');
        try {
            await loadScrapingData('scraped-data.json');
        } catch (error) {
            console.log('No scraped-data.json found, using sample data');
            loadQueries();
        }
    }
}

// Load annotation data from the new API endpoint
async function loadAnnotationData() {
    try {
        const response = await fetch('/api/annotation-data?t=' + Date.now());
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        
        // Replace the sample data with loaded data
        scrapingResults = data;
        loadQueries();
        
        console.log('Loaded annotation data from API:', data);
        return data;
    } catch (error) {
        console.error('Error loading annotation data:', error);
        throw error;
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

// Check for updates to the JSON file and annotation data
async function checkForUpdates() {
    try {
        // Check both annotation data and scraped data
        const [annotationResponse, scrapedResponse] = await Promise.all([
            fetch('/api/annotation-data?t=' + Date.now()).catch(() => null),
            fetch('scraped-data.json?t=' + Date.now()).catch(() => null)
        ]);
        
        let hasUpdates = false;
        let combinedData = {};
        
        // Load annotation data if available
        if (annotationResponse && annotationResponse.ok) {
            const annotationData = await annotationResponse.json();
            Object.assign(combinedData, annotationData);
            console.log('Checked annotation data');
        }
        
        // Load scraped data if available and merge
        if (scrapedResponse && scrapedResponse.ok) {
            const scrapedData = await scrapedResponse.json();
            // Merge scraped data with annotation data
            for (const [category, categoryData] of Object.entries(scrapedData)) {
                if (!combinedData[category]) {
                    combinedData[category] = {};
                }
                for (const [subconcept, subconceptData] of Object.entries(categoryData)) {
                    if (!combinedData[category][subconcept]) {
                        combinedData[category][subconcept] = { queries: [] };
                    }
                    // Add scraped queries to existing annotation queries
                    combinedData[category][subconcept].queries.push(...subconceptData.queries);
                }
            }
            console.log('Checked scraped data');
        }
        
        // Check if data has changed
        if (JSON.stringify(combinedData) !== JSON.stringify(scrapingResults)) {
            console.log('Data updated, refreshing visualization');
            Object.assign(scrapingResults, combinedData);
            loadQueries();
            
            // Show update notification
            showUpdateNotification();
            hasUpdates = true;
        } else {
            console.log('No new data found');
        }
        
        return hasUpdates;
    } catch (error) {
        console.error('Error checking for updates:', error);
        throw error;
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
    
    // Reset pagination when selecting a new query
    resetPagination();
    
    // Update main content
    const mainContent = document.querySelector('.main-content');
    mainContent.innerHTML = `
        <div class="results-section">
            <div class="view-mode-tabs">
                <button id="videoViewBtn" class="view-tab active" onclick="switchViewMode('videos')">
                    Videos
                </button>
                <button id="rankingViewBtn" class="view-tab" onclick="switchViewMode('rankings')">
                    Rankings
                </button>
                <button id="labelingViewBtn" class="view-tab" onclick="switchViewMode('labeling')">
                    Labeling
                </button>
            </div>
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
                    <h3 class="query-title">${queryData.folder}</h3>
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
    
    // Store all videos and reset pagination
    allVideos = videos;
    currentPage = 1;
    totalPages = Math.ceil(videos.length / videosPerPage);
    
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
    allVideos = sortedVideos;
    
    // Display current page of videos
    displayCurrentPage();
}

// Display the current page of videos
function displayCurrentPage() {
    const resultsContainer = document.getElementById('resultsContainer');
    
    // Calculate start and end indices for current page
    const startIndex = (currentPage - 1) * videosPerPage;
    const endIndex = startIndex + videosPerPage;
    const currentPageVideos = allVideos.slice(startIndex, endIndex);
    
    // Ensure currentVideoList is properly set for navigation
    currentVideoList = allVideos;
    
    // Create pagination controls
    const paginationHtml = createPaginationControls();
    
    // Create results grid
    const resultsGrid = document.createElement('div');
    resultsGrid.className = 'results-grid';
    
    currentPageVideos.forEach((video, pageIndex) => {
        const globalIndex = startIndex + pageIndex; // Global index for navigation
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
            displayVideos(allVideos);
        });
        
        // Add click handler for video preview
        const thumbnail = videoCard.querySelector('.video-thumbnail');
        const previewEl = videoCard.querySelector('.hover-preview');
        thumbnail.addEventListener('click', () => {
            console.log('Video thumbnail clicked:', video.title, 'Setting index to:', globalIndex);
            currentVideoIndex = globalIndex;
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
    
    // Update results container with pagination and grid
    resultsContainer.innerHTML = `
        <div class="pagination-info">
            <span>Showing ${startIndex + 1}-${Math.min(endIndex, allVideos.length)} of ${allVideos.length} videos</span>
        </div>
        ${paginationHtml}
        <div class="results-grid-container"></div>
        ${totalPages > 1 ? paginationHtml : ''}
    `;
    
    const gridContainer = resultsContainer.querySelector('.results-grid-container');
    gridContainer.appendChild(resultsGrid);
    
    // Add pagination event listeners
    addPaginationEventListeners();
    
    console.log('Current page displayed, video list synchronized:', currentVideoList.length, 'videos');
}

// Create pagination controls HTML
function createPaginationControls() {
    if (totalPages <= 1) return '';
    
    let paginationHtml = '<div class="pagination-controls">';
    
    // Previous button
    if (currentPage > 1) {
        paginationHtml += `<button class="pagination-btn" data-page="${currentPage - 1}">‹ Previous</button>`;
    } else {
        paginationHtml += `<button class="pagination-btn disabled">‹ Previous</button>`;
    }
    
    // Page numbers
    const maxVisiblePages = 7;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Adjust start page if we're near the end
    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // First page + ellipsis if needed
    if (startPage > 1) {
        paginationHtml += `<button class="pagination-btn" data-page="1">1</button>`;
        if (startPage > 2) {
            paginationHtml += `<span class="pagination-ellipsis">...</span>`;
        }
    }
    
    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === currentPage ? 'active' : '';
        paginationHtml += `<button class="pagination-btn ${isActive}" data-page="${i}">${i}</button>`;
    }
    
    // Last page + ellipsis if needed
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHtml += `<span class="pagination-ellipsis">...</span>`;
        }
        paginationHtml += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
    }
    
    // Next button
    if (currentPage < totalPages) {
        paginationHtml += `<button class="pagination-btn" data-page="${currentPage + 1}">Next ›</button>`;
    } else {
        paginationHtml += `<button class="pagination-btn disabled">Next ›</button>`;
    }
    
    paginationHtml += '</div>';
    return paginationHtml;
}

// Add event listeners to pagination controls
function addPaginationEventListeners() {
    const paginationBtns = document.querySelectorAll('.pagination-btn:not(.disabled)');
    paginationBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetPage = parseInt(btn.getAttribute('data-page'));
            if (targetPage && targetPage !== currentPage) {
                goToPage(targetPage);
            }
        });
    });
}

// Navigate to a specific page
function goToPage(page) {
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    displayCurrentPage();
    
    // Scroll to top of results
    const resultsContainer = document.getElementById('resultsContainer');
    if (resultsContainer) {
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
    
    // Validate that we have a valid video and video list
    if (!video || !currentVideoList || currentVideoList.length === 0) {
        console.error('Invalid video or video list for modal');
        return;
    }
    
    // Ensure currentVideoIndex is valid for the current video list
    if (currentVideoIndex < 0 || currentVideoIndex >= currentVideoList.length) {
        console.log('Current video index out of bounds, finding video in list');
        // Try to find the video in the current list
        const foundIndex = currentVideoList.findIndex(v => v.id === video.id);
        if (foundIndex !== -1) {
            currentVideoIndex = foundIndex;
            console.log('Found video at index:', currentVideoIndex);
        } else {
            console.warn('Video not found in current list, using first video');
            currentVideoIndex = 0;
            video = currentVideoList[0];
        }
    }
    
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
        // Clear any previous source and load new video
        videoElement.pause();
        videoElement.src = '';
        videoElement.src = video.url;
        videoElement.load(); // Force reload of the video
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
    
    // Auto-play if possible (with error handling)
    if (videoElement) {
        // Wait a moment for the video to load before trying to play
        setTimeout(() => {
            videoElement.play().catch((error) => {
                console.log('Auto-play failed (this is normal):', error);
            });
        }, 100);
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
    
    // Check if we're going past the boundaries
    if (currentVideoIndex < 0) {
        // Going before the first video - go to previous page if possible
        if (currentPage > 1) {
            // Go to previous page and set index to the last video of that page
            const newPage = currentPage - 1;
            const lastIndexOnPrevPage = Math.min(newPage * videosPerPage - 1, currentVideoList.length - 1);
            goToPageAndShowVideo(newPage, lastIndexOnPrevPage);
            return;
        } else {
            // Already on first page, wrap to last video of current page
            const lastIndexOnCurrentPage = Math.min(currentPage * videosPerPage - 1, currentVideoList.length - 1);
            currentVideoIndex = lastIndexOnCurrentPage;
        }
    } else if (currentVideoIndex >= currentVideoList.length) {
        // Going past the last video - go to next page if possible
        if (currentPage < totalPages) {
            // Go to next page and set index to the first video of that page
            const newPage = currentPage + 1;
            const firstIndexOnNextPage = (newPage - 1) * videosPerPage;
            goToPageAndShowVideo(newPage, firstIndexOnNextPage);
            return;
        } else {
            // Already on last page, wrap to first video of current page
            currentVideoIndex = (currentPage - 1) * videosPerPage;
        }
    } else {
        // Calculate what page the new index would be on
        const newPage = Math.floor(currentVideoIndex / videosPerPage) + 1;
        
        if (newPage !== currentPage) {
            // Navigation crosses page boundary within the video list
            goToPageAndShowVideo(newPage, currentVideoIndex);
            return;
        }
    }
    
    // Ensure index is within bounds
    currentVideoIndex = Math.max(0, Math.min(currentVideoIndex, currentVideoList.length - 1));
    
    console.log('Navigating from index', oldIndex, 'to', currentVideoIndex, 'on page', currentPage);
    
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

// ===== BOOKMARK MANAGEMENT FUNCTIONS =====

// Clear all bookmark indicators from the UI
function clearAllBookmarkIndicators() {
    // Remove all bookmark indicators from video cards
    const bookmarkIndicators = document.querySelectorAll('.bookmark-indicator');
    bookmarkIndicators.forEach(indicator => {
        indicator.remove();
    });
    
    // Remove bookmarked class from all video cards
    const bookmarkedCards = document.querySelectorAll('.video-card.bookmarked');
    bookmarkedCards.forEach(card => {
        card.classList.remove('bookmarked');
    });
    
    console.log('Cleared all bookmark indicators from UI');
}

// Update bookmark indicators for a specific video
function updateBookmarkIndicators(videoId) {
    // First clear all existing bookmark indicators
    clearAllBookmarkIndicators();
    
    // Then add bookmark indicators for the new bookmark
    if (videoId) {
        const videoCards = document.querySelectorAll(`[data-video-id="${videoId}"]`);
        videoCards.forEach(cardOrThumbnail => {
            const videoCard = cardOrThumbnail.closest('.video-card');
            if (videoCard) {
                // Add bookmarked class
                videoCard.classList.add('bookmarked');
                
                // Add bookmark indicator if it doesn't exist
                if (!videoCard.querySelector('.bookmark-indicator')) {
                    const thumbnail = videoCard.querySelector('.video-thumbnail');
                    if (thumbnail) {
                        const bookmarkIndicator = document.createElement('div');
                        bookmarkIndicator.className = 'bookmark-indicator';
                        bookmarkIndicator.innerHTML = '🔖 Bookmarked';
                        thumbnail.appendChild(bookmarkIndicator);
                    }
                }
            }
        });
        
        console.log(`Updated bookmark indicators for video ${videoId}`);
    }
}

// Get bookmark from localStorage
function getBookmark() {
    const bookmark = localStorage.getItem('videoBookmark');
    return bookmark ? JSON.parse(bookmark) : null;
}

// Set bookmark in localStorage with proper UI cleanup
function setBookmark(bookmarkData) {
    // Get the old bookmark to clear its indicators
    const oldBookmark = getBookmark();
    
    // Save the new bookmark
    localStorage.setItem('videoBookmark', JSON.stringify(bookmarkData));
    console.log('Bookmark saved:', bookmarkData);
    
    // Clear old bookmark indicators and set new ones
    updateBookmarkIndicators(bookmarkData.videoId);
    
    // Update bookmark buttons in modal if open
    if (bookmarkData.videoId) {
        updateBookmarkButtons(bookmarkData.videoId);
    }
    
    // Show success notification
    showBookmarkNotification('Video bookmarked! Use "Jump to Bookmark" to return here later.');
    
    // Refresh labeling display if we're currently in labeling mode (but preserve page)
    if (currentViewMode === 'labeling' && currentQuery) {
        setTimeout(() => {
            // Only refresh the header area, not the whole page
            updateLabelingStats();
            
            // Update the jump to bookmark button visibility
            const jumpBtn = document.getElementById('jumpToBookmarkBtn');
            const bookmark = getBookmark();
            const hasBookmarkForThisQuery = bookmark && bookmark.queryFolder === currentQuery.folder;
            
            if (jumpBtn) {
                jumpBtn.style.display = hasBookmarkForThisQuery ? 'block' : 'none';
            } else if (hasBookmarkForThisQuery) {
                // Add the button if it doesn't exist but should
                const labelingActions = document.querySelector('.labeling-actions');
                if (labelingActions) {
                    const newJumpBtn = document.createElement('button');
                    newJumpBtn.id = 'jumpToBookmarkBtn';
                    newJumpBtn.className = 'jump-bookmark-button';
                    newJumpBtn.innerHTML = '🔖 Jump to Bookmark';
                    newJumpBtn.addEventListener('click', () => jumpToBookmarkInCurrentQuery(currentQuery));
                    labelingActions.insertBefore(newJumpBtn, labelingActions.firstChild);
                }
            }
        }, 100);
    }
}

// Clear bookmark from localStorage with proper UI cleanup
function clearBookmark() {
    const oldBookmark = getBookmark();
    
    localStorage.removeItem('videoBookmark');
    console.log('Bookmark cleared');
    
    // Clear all bookmark indicators from UI
    clearAllBookmarkIndicators();
    
    // Update bookmark buttons in modal if open
    if (oldBookmark && oldBookmark.videoId) {
        updateBookmarkButtons(oldBookmark.videoId);
    }
    
    // Show notification
    showBookmarkNotification('Bookmark removed.');
    
    // Refresh labeling display if we're currently in labeling mode
    if (currentViewMode === 'labeling' && currentQuery) {
        setTimeout(() => {
            // Remove the jump to bookmark button
            const jumpBtn = document.getElementById('jumpToBookmarkBtn');
            if (jumpBtn) {
                jumpBtn.remove();
            }
        }, 100);
    }
}

// Check if current video is bookmarked
function isVideoBookmarked(videoId) {
    const bookmark = getBookmark();
    return bookmark && bookmark.videoId === videoId;
}

// Bookmark current video and position (improved version)
function bookmarkCurrentVideo(video) {
    if (!video || !currentQuery) {
        console.error('Cannot bookmark: missing video or query data');
        return;
    }
    
    console.log('Bookmarking video:', video.title, 'ID:', video.id);
    
    const bookmarkData = {
        // Navigation context
        category: currentCategory,
        subconcept: currentSubconcept,
        query: currentQuery.query,
        queryFolder: currentQuery.folder,
        
        // Video details
        videoId: video.id,
        videoIndex: currentVideoIndex,
        
        // Page context
        currentPage: currentPage,
        viewMode: currentViewMode,
        
        // Metadata
        timestamp: new Date().toISOString(),
        videoTitle: video.title
    };
    
    setBookmark(bookmarkData);
}

// Remove bookmark for current video (improved version)
function removeBookmark() {
    clearBookmark();
}

// Show bookmark notification
function showBookmarkNotification(message) {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('bookmarkNotification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'bookmarkNotification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #007bff;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 1001;
            font-weight: 500;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(notification);
    }
    
    notification.textContent = message;
    
    // Show notification
    notification.style.opacity = '1';
    
    // Hide after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
    }, 3000);
}

// Jump to bookmarked video
async function jumpToBookmark() {
    const bookmark = getBookmark();
    if (!bookmark) {
        alert('No bookmark found');
        return;
    }
    
    console.log('Jumping to bookmark:', bookmark);
    
    try {
        // First, navigate to the correct category and subconcept
        if (bookmark.category && bookmark.subconcept) {
            console.log('Navigating to category/subconcept:', bookmark.category, bookmark.subconcept);
            selectSubconcept(bookmark.category, bookmark.subconcept);
            
            // Wait a moment for the subconcept to load
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Find and select the correct query
        if (bookmark.queryFolder && currentCategory && currentSubconcept) {
            const subconceptData = scrapingResults[currentCategory][currentSubconcept];
            const targetQuery = subconceptData.queries.find(q => q.folder === bookmark.queryFolder);
            
            if (targetQuery) {
                console.log('Selecting target query:', targetQuery.query);
                selectQuery(targetQuery);
                
                // Wait for query to load
                await new Promise(resolve => setTimeout(resolve, 200));
                
                // Switch to the bookmarked view mode
                if (bookmark.viewMode) {
                    console.log('Switching to view mode:', bookmark.viewMode);
                    switchViewMode(bookmark.viewMode);
                    
                    // Wait for view mode to load
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
                
                // Navigate to the correct page
                if (bookmark.currentPage && bookmark.currentPage !== currentPage) {
                    console.log('Navigating to page:', bookmark.currentPage);
                    if (bookmark.viewMode === 'labeling') {
                        goToLabelingPage(bookmark.currentPage, targetQuery);
                    } else {
                        goToPage(bookmark.currentPage);
                    }
                    
                    // Wait for page to load
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
                
                // Find and highlight the bookmarked video
                if (bookmark.videoId) {
                    console.log('Looking for bookmarked video:', bookmark.videoId);
                    const videoCards = document.querySelectorAll('.video-card');
                    let found = false;
                    
                    videoCards.forEach(card => {
                        const thumbnail = card.querySelector('.video-thumbnail');
                        if (thumbnail && thumbnail.getAttribute('data-video-id') === bookmark.videoId) {
                            // Highlight the bookmarked video
                            card.style.border = '3px solid #007bff';
                            card.style.boxShadow = '0 0 20px rgba(0,123,255,0.5)';
                            
                            // Scroll to the video
                            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            
                            // Remove highlight after 5 seconds
                            setTimeout(() => {
                                card.style.border = '';
                                card.style.boxShadow = '';
                            }, 5000);
                            
                            found = true;
                        }
                    });
                    
                    if (found) {
                        showBookmarkNotification(`Jumped to bookmarked video: "${bookmark.videoTitle}"`);
                    } else {
                        showBookmarkNotification('Bookmark location found, but video not visible on current page');
                    }
                } else {
                    showBookmarkNotification('Jumped to bookmarked location');
                }
            } else {
                alert(`Query "${bookmark.query}" not found in current data`);
            }
        } else {
            alert('Bookmark data incomplete or category/subconcept not found');
        }
    } catch (error) {
        console.error('Error jumping to bookmark:', error);
        alert('Error navigating to bookmark: ' + error.message);
    }
}

// Switch between video view and ranking view
function switchViewMode(mode) {
    console.log('switchViewMode called with mode:', mode);
    console.log('Current query:', currentQuery);
    console.log('Current view mode before switch:', currentViewMode);
    
    currentViewMode = mode;
    
    // Reset pagination when switching view modes
    resetPagination();
    
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
                                Videos
                            </button>
                            <button id="rankingViewBtn" class="view-tab" onclick="switchViewMode('rankings')">
                                Rankings
                            </button>
                            <button id="labelingViewBtn" class="view-tab" onclick="switchViewMode('labeling')">
                                Labeling
                            </button>
                        </div>
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
            
            // If we're currently viewing a dataset pool, restore the original query
            if (currentQuery.isDatasetPool && currentQuery.originalQuery) {
                console.log('Restoring original query from dataset pool');
                // Restore the original allVideos for proper sampling analysis
                if (currentQuery.originalAllVideos) {
                    allVideos = currentQuery.originalAllVideos;
                }
                currentQuery = currentQuery.originalQuery;
                
                // Force refresh annotation data from backend to ensure we have the latest labels
                // This ensures the Dataset Pool Analysis section updates with new annotations
                forceRefreshAnnotationData().then(() => {
                    console.log('Annotation data refreshed, displaying rankings');
                    displayRankings(currentQuery);
                }).catch(error => {
                    console.warn('Error refreshing annotation data:', error);
                    // Still display rankings even if refresh fails
                    displayRankings(currentQuery);
                });
            } else {
                // Always refresh the rankings display when switching to rankings
                displayRankings(currentQuery);
            }
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
            // Preserve page if we're already in labeling mode, otherwise reset to page 1
            const preservePage = (currentViewMode === 'labeling');
            displayLabeling(currentQuery, preservePage);
        } else {
            console.log('No current query available for labeling display');
        }
    }
    console.log('switchViewMode completed');
}

// Display ranking results for a query
// Display ranking results for a query
function displayRankings(queryData) {
    const mainContent = document.querySelector('.main-content');
    
    if (!queryData.videos || queryData.videos.length === 0) {
        mainContent.innerHTML = `
            <div class="results-section">
                <div class="view-mode-tabs">
                    <button id="videoViewBtn" class="view-tab" onclick="switchViewMode('videos')">
                        Videos
                    </button>
                    <button id="rankingViewBtn" class="view-tab active" onclick="switchViewMode('rankings')">
                        Rankings
                    </button>
                    <button id="labelingViewBtn" class="view-tab" onclick="switchViewMode('labeling')">
                        Labeling
                    </button>
                </div>
                <h2>🏆 VQA Score Rankings</h2>
                <div style="text-align: center; padding: 40px; color: #6c757d;">
                    <div style="font-size: 3em; margin-bottom: 20px;">📊</div>
                    <h3>No videos found</h3>
                    <p>This query has no videos to rank</p>
                </div>
            </div>
        `;
        return;
    }
    
    // Check if videos have VQA scores
    const videosWithScores = queryData.videos.filter(video => video.confidenceScore !== undefined);
    
    if (videosWithScores.length === 0) {
        mainContent.innerHTML = `
            <div class="results-section">
                <div class="view-mode-tabs">
                    <button id="videoViewBtn" class="view-tab" onclick="switchViewMode('videos')">
                        Videos
                    </button>
                    <button id="rankingViewBtn" class="view-tab active" onclick="switchViewMode('rankings')">
                        Rankings
                    </button>
                    <button id="labelingViewBtn" class="view-tab" onclick="switchViewMode('labeling')">
                        Labeling
                    </button>
                </div>
                <h2>🏆 VQA Score Rankings</h2>
                <div style="text-align: center; padding: 40px; color: #6c757d;">
                    <div style="font-size: 3em; margin-bottom: 20px;">📊</div>
                    <h3>No VQA scores found</h3>
                    <p>Videos in this query don't have VQA confidence scores for ranking</p>
                    <small>VQA scores are needed to generate rankings</small>
                </div>
            </div>
        `;
        return;
    }
    
    // Create ranking results from video data with scores
    const sortedResults = [...videosWithScores]
        .sort((a, b) => b.confidenceScore - a.confidenceScore) // Sort by confidenceScore highest to lowest
        .map((video, index) => ({
            rank: index + 1,
            score: video.confidenceScore,
            filename: extractFilenameFromUrl(video.video || video.url || video.localPath || ''),
            video_url: video.video || video.url || video.localPath || '',
            question: video.question,
            label: video.label,
            videoData: video
        }));
    
    // Create metadata for display
    const scores = sortedResults.map(r => r.score);
    const metadata = {
        search_query: queryData.query,
        generated: queryData.timestamp || new Date().toISOString(),
        total_videos: sortedResults.length
    };
    
    const statistics = {
        highest_score: Math.max(...scores),
        lowest_score: Math.min(...scores),
        average_score: scores.reduce((a, b) => a + b, 0) / scores.length
    };
    
    // Sort ranking results: starred videos first, then by rank
    const finalSortedResults = [...sortedResults].sort((a, b) => {
        const videoDataA = a.videoData;
        const videoDataB = b.videoData;
        
        const aStarred = videoDataA ? isVideoStarred(videoDataA.id) : false;
        const bStarred = videoDataB ? isVideoStarred(videoDataB.id) : false;
        
        if (aStarred && !bStarred) return -1;
        if (!aStarred && bStarred) return 1;
        return a.rank - b.rank;
    });
    
    // Perform sampling analysis
    const samplingAnalysis = performSamplingAnalysis(finalSortedResults);
    
    // Store current video list for navigation
    currentVideoList = finalSortedResults.map(result => result.videoData).filter(Boolean);
    
    // Store all rankings and reset pagination
    allVideos = finalSortedResults;
    currentPage = 1;
    totalPages = Math.ceil(finalSortedResults.length / videosPerPage);
    
    mainContent.innerHTML = `
        <div class="results-section">
            <div class="view-mode-tabs">
                <button id="videoViewBtn" class="view-tab" onclick="switchViewMode('videos')">
                    Videos
                </button>
                <button id="rankingViewBtn" class="view-tab active" onclick="switchViewMode('rankings')">
                    Rankings
                </button>
                <button id="labelingViewBtn" class="view-tab" onclick="switchViewMode('labeling')">
                    Labeling
                </button>
            </div>
            <div class="ranking-header">
                <h2>🏆 VQA Score Rankings</h2>
                <div class="query-info">
                    <h3>"${metadata.search_query}"</h3>
                    <p>Generated: ${formatDate(metadata.generated)}</p>
                </div>
            </div>
            
            <!-- Videos Displayed Section -->
            <div class="goal-setting-section">
                <div class="goal-controls">
                    <div class="goal-input-group">
                        <label for="videosDisplayedInput">Videos Displayed:</label>
                        <input type="number" id="videosDisplayedInput" value="${videosDisplayed}" min="1" max="10000" onchange="updateVideosDisplayed(this.value)">
                        <span class="goal-label">videos</span>
                    </div>
                    <button onclick="setupAnnotationsFromDisplayed()" class="refresh-btn">🏷️ Setup Annotations</button>
                </div>
            </div>
            
            <!-- Sampling Analysis Section -->
            <div class="sampling-analysis-section">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3>📊 Dataset Pool Analysis</h3>
                    <button onclick="refreshDatasetPoolAnalysis()" class="refresh-btn" style="margin: 0;">
                        🔄 Refresh Analysis
                    </button>
                </div>
                <div class="sampling-grid">
                    ${Object.values(samplingAnalysis).map(range => `
                        <div class="sampling-card ${range.meetsGoal ? 'meets-goal' : ''} ${!range.hasVideos ? 'no-videos' : ''}">
                            <div class="range-header">
                                <h4>${range.displayName || range.name}</h4>
                                <span class="range-badge">${range.totalInRange} videos</span>
                            </div>
                            <div class="sampling-stats">
                                <div class="stat-row">
                                    <span class="stat-label">Sample Size:</span>
                                    <span class="stat-value">${range.sampleSize}/${sampleSize}</span>
                                </div>
                                <div class="stat-row">
                                    <span class="stat-label">True Positive Rate:</span>
                                    <span class="stat-value">${(range.truePosRate * 100).toFixed(1)}%</span>
                                </div>
                                <div class="stat-row">
                                    <span class="stat-label">Estimated True Positives:</span>
                                    <span class="stat-value ${range.meetsGoal ? 'goal-met' : 'goal-not-met'}">${range.estimatedTruePos}</span>
                                </div>
                            </div>
                            <button onclick="viewDatasetPool('${range.name}')" class="view-pool-btn" ${!range.hasVideos ? 'disabled' : ''}>
                                ${range.hasVideos ? `📋 Annotate ${range.sampleSize || 100} Videos` : '📋 No Videos Available'}
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="ranking-stats">
                <div class="stat-card">
                    <div class="stat-value">${finalSortedResults.length}</div>
                    <div class="stat-label">Videos Ranked</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${statistics.highest_score.toFixed(6)}</div>
                    <div class="stat-label">Highest Score</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${statistics.lowest_score.toFixed(6)}</div>
                    <div class="stat-label">Lowest Score</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${statistics.average_score.toFixed(6)}</div>
                    <div class="stat-label">Average Score</div>
                </div>
            </div>
            
            <div id="rankingContainer" class="ranking-list">
            </div>
        </div>
    `;
    
    // Display current page of rankings
    displayCurrentRankingPage(queryData, metadata);
}


// ===== VIDEO LABELING FUNCTIONS =====

// In-memory cache for labels to avoid constant backend calls
let labelCache = {};
let labelCacheInitialized = false;
let pendingLabelUpdates = new Set(); // Track pending backend syncs
let labelSyncTimeout = null; // Debounce backend syncing

// Initialize label cache
async function initializeLabelCache() {
    if (labelCacheInitialized) return labelCache;
    
    try {
        labelCache = await getLabeledVideosFromBackend();
        labelCacheInitialized = true;
        console.log('Label cache initialized:', Object.keys(labelCache).length, 'labels');
    } catch (error) {
        console.warn('Failed to initialize label cache, using empty cache:', error);
        labelCache = {};
        labelCacheInitialized = true;
    }
    
    return labelCache;
}

// Get labeled videos from backend (with localStorage fallback) - only call when initializing
async function getLabeledVideosFromBackend() {
    try {
        // Try to load from backend first
        const response = await fetch('/api/labels');
        if (response.ok) {
            const backendLabels = await response.json();
            
            // Also update localStorage to keep it in sync
            localStorage.setItem('labeledVideos', JSON.stringify(backendLabels));
            
            return backendLabels;
        } else {
            console.warn('Backend labels not available, using localStorage');
        }
    } catch (error) {
        console.warn('Error loading labels from backend:', error);
    }
    
    // Fallback to localStorage
    try {
        const labeled = localStorage.getItem('labeledVideos');
        return labeled ? JSON.parse(labeled) : {};
    } catch (error) {
        console.error('Error getting labeled videos from localStorage:', error);
        return {};
    }
}

// Fast synchronous access to labels using cache
function getLabeledVideos() {
    if (!currentQuery) return {};
    
    const key = currentQuery.isDatasetPool ? 
        `tpr_labels_${currentQuery.folder}` : 
        `labels_${currentQuery.folder}`;
    
    const stored = localStorage.getItem(key);
    let mainLabels = stored ? JSON.parse(stored) : {};
    
    // If we're on the rankings page (not in a dataset pool), also include dataset pool annotations
    if (!currentQuery.isDatasetPool && currentViewMode === 'rankings') {
        // Get all dataset pool annotations for this query
        const datasetPoolLabels = getAllDatasetPoolLabels(currentQuery.folder);
        
        // Merge the labels, with dataset pool labels taking precedence
        const mergedLabels = { ...mainLabels, ...datasetPoolLabels };
        
        console.log('Merged labels for rankings:', {
            mainLabels: Object.keys(mainLabels).length,
            datasetPoolLabels: Object.keys(datasetPoolLabels).length,
            totalMerged: Object.keys(mergedLabels).length
        });
        
        return mergedLabels;
    }
    
    return mainLabels;
}

// Get all dataset pool labels for a given query folder
function getAllDatasetPoolLabels(queryFolder) {
    const allLabels = {};
    
    // Get all localStorage keys that match the pattern for this query's dataset pools
    const keys = Object.keys(localStorage);
    const datasetPoolKeys = keys.filter(key => 
        key.startsWith('tpr_labels_') && 
        key.includes(queryFolder + '_pool_')
    );
    
    // Merge all dataset pool labels
    datasetPoolKeys.forEach(key => {
        try {
            const poolLabels = JSON.parse(localStorage.getItem(key));
            if (poolLabels && typeof poolLabels === 'object') {
                Object.assign(allLabels, poolLabels);
            }
        } catch (error) {
            console.warn('Error parsing dataset pool labels from key:', key, error);
        }
    });
    
    return allLabels;
}

// Fast label update with immediate UI response and batched backend sync
function setVideoLabel(videoId, label) {
    if (!currentQuery) return;
    
    const key = currentQuery.isDatasetPool ? 
        `tpr_labels_${currentQuery.folder}` : 
        `labels_${currentQuery.folder}`;
    
    const labeledVideos = getLabeledVideos();
    labeledVideos[videoId] = label;
    localStorage.setItem(key, JSON.stringify(labeledVideos));
    
    // Sync to backend if not TPR annotations
    if (!currentQuery.isDatasetPool) {
        syncLabelsToBackend();
    }
}

// Batch sync labels to backend
async function syncLabelsToBackend() {
    if (pendingLabelUpdates.size === 0) return;
    
    try {
        const response = await fetch('/api/labels', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(labelCache)
        });
        
        if (response.ok) {
            console.log('Labels synced to backend successfully:', pendingLabelUpdates.size, 'updates');
            pendingLabelUpdates.clear();
        } else {
            console.warn('Failed to sync labels to backend');
        }
    } catch (error) {
        console.warn('Error syncing labels to backend:', error);
    }
}

// Check if a video is labeled as "Yes"
function isVideoLabeled(videoId) {
    const labeled = getLabeledVideos();
    return labeled[videoId] === 'yes';
}

// Fast toggle video label between "No" and "Yes"
function toggleVideoLabel(videoId) {
    const labeled = getLabeledVideos();
    const currentLabel = labeled[videoId] || 'no';
    const newLabel = currentLabel === 'yes' ? 'no' : 'yes';
    
    setVideoLabel(videoId, newLabel);
    return newLabel;
}

// Get all videos labeled as "Yes" for current query
function getYesLabeledVideos() {
    if (!currentQuery || !currentQuery.videos) return [];
    
    const labeled = getLabeledVideos();
    return currentQuery.videos.filter(video => labeled[video.id] === 'yes');
}

// Optimized function to update a single video card's appearance
function updateVideoCardLabel(videoId, newLabel, shouldUpdateStats = true) {
    // Check if we're in preview mode, use the new system
    if (currentViewMode === 'labeling') {
        updateVideoCardLabelForPreviewSystem(videoId, newLabel);
        return;
    }
    
    // Original function for other views
    const videoCards = document.querySelectorAll(`[data-video-id="${videoId}"]`);
    
    videoCards.forEach(cardOrThumbnail => {
        const videoCard = cardOrThumbnail.closest('.video-card');
        if (!videoCard) return;
        
        // Update card classes
        videoCard.classList.remove('labeled-yes', 'labeled-no');
        videoCard.classList.add(newLabel === 'yes' ? 'labeled-yes' : 'labeled-no');
        
        // Update label overlay
        const labelOverlay = videoCard.querySelector('.label-overlay');
        if (labelOverlay) {
            labelOverlay.className = `label-overlay ${newLabel === 'yes' ? 'label-yes' : 'label-no'}`;
            labelOverlay.textContent = newLabel === 'yes' ? '✅ YES' : '❌ NO';
        }
        
        // Update label buttons
        const labelButtons = videoCard.querySelectorAll('.label-button');
        labelButtons.forEach(button => {
            const buttonLabel = button.getAttribute('data-label');
            button.classList.toggle('active', buttonLabel === newLabel);
        });
    });
    
    // Update stats in header if requested
    if (shouldUpdateStats && currentViewMode === 'labeling') {
        updateLabelingStats();
    }
    
    console.log(`Updated video card ${videoId} to ${newLabel}`);
}

// Fast stats update without full page refresh
function updateLabelingStats() {
    if (!currentQuery) return;
    
    const yesCount = getYesLabeledVideos().length;
    const totalCount = currentQuery.videos.length;
    
    // Update stats badges
    const yesCountElement = document.querySelector('.yes-count');
    const totalCountElement = document.querySelector('.total-count');
    const exportButton = document.getElementById('exportLabelsBtn');
    
    if (yesCountElement) {
        yesCountElement.textContent = `${yesCount} labeled Yes`;
    }
    
    if (totalCountElement) {
        totalCountElement.textContent = `${totalCount} total videos`;
    }
    
    if (exportButton) {
        exportButton.disabled = yesCount === 0;
        exportButton.textContent = `📤 Export ${yesCount} Videos`;
    }
    
    // If this is a dataset pool, update TPR display in real-time
    if (currentQuery.isDatasetPool) {
        const labeledVideos = getLabeledVideos();
        let totalAnnotated = 0;
        let truePositives = 0;
        
        // Count ALL videos in the pool (including default 'no' labels)
        for (const video of currentQuery.videos) {
            totalAnnotated++; // Count all videos, not just explicitly labeled ones
            const actualLabel = labeledVideos[video.id] || 'no'; // Apply default 'no' label consistently
            if (actualLabel === 'yes') {
                truePositives++;
            }
        }
        
        // Always update TPR display (since all videos now have labels)
        const tpr = truePositives / totalAnnotated;
        const estimatedTotal = Math.round(currentQuery.poolInfo.totalInRange * tpr);
        updateDatasetPoolTPRDisplay(totalAnnotated, truePositives, tpr, estimatedTotal);
    }
}

// Display labeling interface for videos (optimized version)
async function displayLabeling(queryData, preservePage = false) {
    const mainContent = document.querySelector('.main-content');
    
    // Initialize label cache if not already done
    await initializeLabelCache();
    
    if (!queryData.videos || queryData.videos.length === 0) {
        mainContent.innerHTML = `
            <div class="results-section">
                <div class="view-mode-tabs">
                    <button id="videoViewBtn" class="view-tab" onclick="switchViewMode('videos')">
                        Videos
                    </button>
                    <button id="rankingViewBtn" class="view-tab" onclick="switchViewMode('rankings')">
                        Rankings
                    </button>
                    <button id="labelingViewBtn" class="view-tab active" onclick="switchViewMode('labeling')">
                        Labeling
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
    
    // Check if this is annotation data with confidence scores
    const isAnnotationData = queryData.isAnnotation && queryData.videos.some(v => v.confidenceScore !== undefined);
    
    // Get current sort preference
    const currentSort = getCurrentSortPreference();
    
    // Sort videos based on preference
    const sortedVideos = sortVideosForLabeling(queryData.videos, labeledVideos, currentSort);

    // Store all videos and set up pagination for labeling
    allVideos = sortedVideos;
    
    // Only reset pagination if preservePage is false (new query selection)
    if (!preservePage) {
        currentPage = 1;
    }
    
    totalPages = Math.ceil(sortedVideos.length / videosPerPage);
    
    // Ensure current page is within valid bounds
    currentPage = Math.max(1, Math.min(currentPage, totalPages));

    mainContent.innerHTML = `
        <div class="results-section">
            <div class="view-mode-tabs">
                <button id="videoViewBtn" class="view-tab" onclick="switchViewMode('videos')">
                    Videos
                </button>
                <button id="rankingViewBtn" class="view-tab" onclick="switchViewMode('rankings')">
                    Rankings
                </button>
                <button id="labelingViewBtn" class="view-tab active" onclick="switchViewMode('labeling')">
                    Labeling
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
                    <div class="sorting-controls">
                        <label for="sortSelect">Sort by:</label>
                        <select id="sortSelect" onchange="changeLabelingSort(this.value)">
                            ${isAnnotationData ? `
                            <option value="confidence" ${currentSort === 'confidence' ? 'selected' : ''}>Confidence Score (High to Low)</option>
                            <option value="confidence-asc" ${currentSort === 'confidence-asc' ? 'selected' : ''}>Confidence Score (Low to High)</option>
                            ` : ''}
                            <option value="labels" ${currentSort === 'labels' ? 'selected' : ''}>Label Status</option>
                            <option value="title" ${currentSort === 'title' ? 'selected' : ''}>Title</option>
                            <option value="random" ${currentSort === 'random' ? 'selected' : ''}>Random</option>
                        </select>
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
            
            ${queryData.isDatasetPool ? `
            <div class="pool-tpr-section">
                <h3>📊 Dataset Pool TPR Analysis</h3>
                <p>These annotations are for TPR calculation only and are separate from regular annotation jobs.</p>
                <button id="calculateTprBtn" class="calculate-tpr-btn" onclick="calculateDatasetPoolTPRAndRedirect()">
                    📈 Calculate TPR & Return to Rankings
                </button>
                <div id="datasetPoolTPRDisplay" class="pool-tpr-display">
                    <div style="text-align: center; color: #6c757d; padding: 20px;">
                        Click "Calculate TPR" to analyze the current annotations
                    </div>
                </div>
            </div>
            ` : ''}
            
            <div id="labelingContainer" class="labeling-grid"></div>
        </div>
    `;

    // Display current page of labeling videos
    await displayCurrentLabelingPage(queryData);

    // Add action button handlers
    setTimeout(() => {
        const exportBtn = document.getElementById('exportLabelsBtn');
        const clearBtn = document.getElementById('clearLabelsBtn');
        
        if (exportBtn) {
            exportBtn.addEventListener('click', () => exportLabeledVideos(queryData));
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                if (confirm('Are you sure you want to clear all labels? This will permanently delete all video labels.')) {
                    await clearAllLabels();
                    displayLabeling(queryData, true); // Preserve page when clearing labels
                }
            });
        }
    }, 100);
}

// Get current sort preference from localStorage
function getCurrentSortPreference() {
    return localStorage.getItem('labelingSortPreference') || 'confidence';
}

// Set sort preference in localStorage
function setSortPreference(sortType) {
    localStorage.setItem('labelingSortPreference', sortType);
}

// Sort videos for labeling based on preference
function sortVideosForLabeling(videos, labeledVideos, sortType) {
    return [...videos].sort((a, b) => {
        switch (sortType) {
            case 'confidence':
                // Confidence score high to low
                const scoreA = a.confidenceScore !== undefined ? a.confidenceScore : -1;
                const scoreB = b.confidenceScore !== undefined ? b.confidenceScore : -1;
                return scoreB - scoreA;
                
            case 'confidence-asc':
                // Confidence score low to high
                const scoreAsc_A = a.confidenceScore !== undefined ? a.confidenceScore : 1;
                const scoreAsc_B = b.confidenceScore !== undefined ? b.confidenceScore : 1;
                return scoreAsc_A - scoreAsc_B;
                
            case 'labels':
                // Label status: Yes > No (with default 'no' for unlabeled)
                const labelA = labeledVideos[a.id] || 'no';
                const labelB = labeledVideos[b.id] || 'no';
                const labelOrder = { 'yes': 0, 'no': 1 };
                return labelOrder[labelA] - labelOrder[labelB];
                
            case 'title':
                // Alphabetical by title
                return a.title.localeCompare(b.title);
                
            case 'random':
                // Random shuffle using Fisher-Yates algorithm
                return Math.random() - 0.5;
                
            default:
                // Default: Labels first, then confidence
                const defaultLabelA = labeledVideos[a.id] || 'no';
                const defaultLabelB = labeledVideos[b.id] || 'no';
                if (defaultLabelA === 'yes' && defaultLabelB !== 'yes') return -1;
                if (defaultLabelA !== 'yes' && defaultLabelB === 'yes') return 1;
                return a.title.localeCompare(b.title);
        }
    });
}

// Change labeling sort and refresh display
function changeLabelingSort(sortType) {
    setSortPreference(sortType);
    if (currentQuery) {
        displayLabeling(currentQuery, true); // Preserve page when changing sort
    }
}

// Display the current page of videos for labeling (optimized version)
async function displayCurrentLabelingPage(queryData) {
    const labelingContainer = document.getElementById('labelingContainer');
    const labeledVideos = getLabeledVideos();
    
    // Calculate start and end indices for current page
    const startIndex = (currentPage - 1) * videosPerPage;
    const endIndex = startIndex + videosPerPage;
    const currentPageVideos = allVideos.slice(startIndex, endIndex);
    
    // Ensure currentVideoList is properly set for navigation
    currentVideoList = allVideos;
    
    // Create pagination controls
    const paginationHtml = createPaginationControls();
    
    // Create labeling grid
    const labelingGrid = document.createElement('div');
    labelingGrid.className = 'results-grid';

    // Get current bookmark to check which video is bookmarked
    const currentBookmark = getBookmark();
    const bookmarkedVideoId = currentBookmark ? currentBookmark.videoId : null;
    
    // Check if this is annotation data
    const isAnnotationData = queryData.isAnnotation;

    currentPageVideos.forEach((video, pageIndex) => {
        const globalIndex = startIndex + pageIndex; // Global index for navigation
        const currentLabel = labeledVideos[video.id]; // Don't default to 'no', keep undefined for unlabeled
        const thumbnailSrc = video.thumbnail || generateVideoThumbnail(video);
        const isBookmarked = video.id === bookmarkedVideoId;
        const hasConfidenceScore = video.confidenceScore !== undefined;
        
        const videoCard = document.createElement('div');
        videoCard.className = `video-card labeling-card ${currentLabel === 'yes' ? 'labeled-yes' : currentLabel === 'no' ? 'labeled-no' : 'labeled-unlabeled'} ${isBookmarked ? 'bookmarked' : ''} ${isAnnotationData ? 'annotation-card' : ''}`;
        
        videoCard.innerHTML = `
            <div class="video-thumbnail" data-video-id="${video.id}">
                <img src="${thumbnailSrc}" alt="${video.title}" onerror="this.src='${generateVideoThumbnail(video)}';">
                <div class="play-button">▶</div>
                <div class="video-duration-overlay">${video.duration}</div>
                <div class="label-overlay ${currentLabel ? 'label-labeled' : 'label-unlabeled'}">
                    ${currentLabel ? '✅ LABELED' : '🏷️ UNLABELED'}
                </div>
                ${hasConfidenceScore ? `
                <div class="confidence-overlay">
                    <span class="confidence-score ${getConfidenceClass(video.confidenceScore)}">
                        ${(video.confidenceScore * 100).toFixed(1)}%
                    </span>
                </div>
                ` : ''}
                ${isBookmarked ? '<div class="bookmark-indicator">🔖 Bookmarked</div>' : ''}
            </div>
            <div class="video-info">
                <div class="video-title">${video.title}</div>
                <div class="video-meta">
                    <span class="video-resolution">${video.resolution}</span>
                    ${video.fileSize ? `<span class="video-filesize">${video.fileSize}</span>` : ''}
                </div>
                ${hasConfidenceScore ? `
                <div class="confidence-info">
                    <div class="confidence-bar">
                        <div class="confidence-fill ${getConfidenceClass(video.confidenceScore)}" 
                             style="width: ${video.confidenceScore * 100}%"></div>
                    </div>
                    <span class="confidence-text">Confidence: ${(video.confidenceScore * 100).toFixed(1)}%</span>
                </div>
                ` : ''}
                ${video.filename ? `<div class="video-filename" title="${video.filename}">${video.filename}</div>` : ''}
                ${isAnnotationData && video.question ? `
                <div class="annotation-question" title="${video.question}">
                    <strong>Q:</strong> ${video.question.length > 60 ? video.question.substring(0, 60) + '...' : video.question}
                </div>
                ` : ''}
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
            currentVideoIndex = globalIndex;
            currentVideoList = allVideos;
            showLabelingVideoModal(video);
        });
        
        // Add click handlers for label buttons (OPTIMIZED - no page refresh)
        const labelButtons = videoCard.querySelectorAll('.label-button');
        labelButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const videoId = button.getAttribute('data-video-id');
                const targetLabel = button.getAttribute('data-label');
                
                // Update label immediately (fast, no backend call)
                setVideoLabel(videoId, targetLabel);
                
                // Update just this video card's appearance (fast, no full page refresh)
                updateVideoCardLabel(videoId, targetLabel, true);
            });
        });
        
        labelingGrid.appendChild(videoCard);
    });
    
    // Update labeling container with pagination and grid
    labelingContainer.innerHTML = `
        <div class="pagination-info">
            <span>Showing ${startIndex + 1}-${Math.min(endIndex, allVideos.length)} of ${allVideos.length} videos</span>
        </div>
        ${paginationHtml}
        <div class="results-grid-container"></div>
        ${totalPages > 1 ? paginationHtml : ''}
    `;
    
    const gridContainer = labelingContainer.querySelector('.results-grid-container');
    gridContainer.appendChild(labelingGrid);
    
    // Add pagination event listeners for labeling
    addLabelingPaginationEventListeners(queryData);
    
    console.log('Current labeling page displayed, video list synchronized:', currentVideoList.length, 'videos');
}

// Get CSS class based on confidence score
function getConfidenceClass(score) {
    if (score >= 0.8) return 'confidence-excellent';
    if (score >= 0.6) return 'confidence-good';
    if (score >= 0.4) return 'confidence-fair';
    if (score >= 0.2) return 'confidence-poor';
    return 'confidence-very-poor';
}

// Update labeling controls in the modal (optimized)
function updateLabelingModalControls(videoId) {
    const labeled = getLabeledVideos();
    const actualLabel = labeled[videoId]; // Don't default to 'no', keep undefined for unlabeled
    
    const currentLabelDisplay = document.getElementById('currentLabelDisplay');
    const previewLabelDisplay = document.getElementById('previewLabelDisplay');
    const submitBtn = document.getElementById('submitGroundTruthBtn');
    
    // Update actual label display - show "Unlabeled" if no actual label exists
    if (currentLabelDisplay) {
        if (actualLabel) {
            currentLabelDisplay.textContent = actualLabel === 'yes' ? 'Yes' : 'No';
            currentLabelDisplay.className = `current-label-badge ${actualLabel === 'yes' ? 'label-yes' : 'label-no'}`;
        } else {
            currentLabelDisplay.textContent = 'Unlabeled';
            currentLabelDisplay.className = 'current-label-badge label-unlabeled';
        }
    }
    
    // Update preview label display
    if (previewLabelDisplay) {
        if (currentPreviewLabel) {
            previewLabelDisplay.textContent = currentPreviewLabel === 'yes' ? 'Yes' : 'No';
            previewLabelDisplay.className = `preview-label-badge ${currentPreviewLabel === 'yes' ? 'label-yes' : 'label-no'}`;
        } else {
            // Default preview to 'No' when not set
            previewLabelDisplay.textContent = 'No';
            previewLabelDisplay.className = 'preview-label-badge label-no';
        }
    }
    
    // Update submit button
    if (submitBtn) {
        submitBtn.disabled = !hasPreviewChanges;
        if (hasPreviewChanges) {
            submitBtn.textContent = `📝 Submit "${currentPreviewLabel === 'yes' ? 'Yes' : 'No'}"`;
        } else {
            submitBtn.textContent = '📝 Submit Ground Truth';
        }
    }
}

// Update video label from modal (OPTIMIZED - no page refresh)
function updateVideoLabelInModal(videoId, newLabel) {
    // Update label immediately (fast)
    setVideoLabel(videoId, newLabel);
    
    // Update the modal controls immediately
    updateLabelingModalControls(videoId);
    
    // Update video card appearance if visible (fast, no full page refresh)
    updateVideoCardLabel(videoId, newLabel, true);
    
    console.log(`Video ${videoId} labeled as: ${newLabel} from modal (optimized)`);
}

// Toggle video label between Yes/No in modal (optimized)
function toggleVideoLabelInModal(videoId) {
    const labeled = getLabeledVideos();
    const currentLabel = labeled[videoId] || 'no';
    const newLabel = currentLabel === 'yes' ? 'no' : 'yes';
    
    updateVideoLabelInModal(videoId, newLabel);
    console.log(`Video ${videoId} toggled from ${currentLabel} to ${newLabel}`);
}

// Clear all labels using backend API (keep existing functionality)
async function clearAllLabels() {
    if (!currentQuery) return;
    
    // Handle TPR labels separately
    if (currentQuery.isDatasetPool) {
        const key = `tpr_labels_${currentQuery.folder}`;
        localStorage.removeItem(key);
        console.log('TPR labels cleared from localStorage');
        return;
    }
    
    try {
        // Clear labels on backend
        const response = await fetch('/api/labels', {
            method: 'DELETE'
        });
        
        if (response.ok) {
            console.log('All labels cleared from backend successfully');
        } else {
            console.warn('Failed to clear labels from backend');
        }
    } catch (error) {
        console.warn('Error clearing labels from backend:', error);
    }
    
    // Also clear localStorage and cache
    try {
        localStorage.removeItem('labeledVideos');
        labelCache = {};
        pendingLabelUpdates.clear();
        console.log('Labels cleared from localStorage and cache');
    } catch (error) {
        console.error('Error clearing labels from localStorage:', error);
    }
}

// Export labeled videos to JSON file (optimized to use cache)
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
    
    // Validate that we have a valid video and video list
    if (!video || !currentVideoList || currentVideoList.length === 0) {
        console.error('Invalid video or video list for labeling modal');
        return;
    }
    
    // Ensure currentVideoIndex is valid for the current video list
    if (currentVideoIndex < 0 || currentVideoIndex >= currentVideoList.length) {
        console.log('Current video index out of bounds, finding video in list');
        // Try to find the video in the current list
        const foundIndex = currentVideoList.findIndex(v => v.id === video.id);
        if (foundIndex !== -1) {
            currentVideoIndex = foundIndex;
            console.log('Found video at index:', currentVideoIndex);
        } else {
            console.warn('Video not found in current list, using first video');
            currentVideoIndex = 0;
            video = currentVideoList[0];
        }
    }
    
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
                            <span class="label-status-text">Actual Label:</span>
                            <span id="currentLabelDisplay" class="current-label-badge label-no">No</span>
                        </div>
                        <div class="preview-label-status">
                            <span class="label-status-text">Preview:</span>
                            <span id="previewLabelDisplay" class="preview-label-badge">No</span>
                            <span class="preview-hint">(Use spacebar to toggle)</span>
                        </div>
                        <div class="labeling-modal-buttons">
                            <button id="submitGroundTruthBtn" class="submit-ground-truth-button" disabled>
                                📝 Submit Ground Truth
                            </button>
                        </div>
                        <div class="bookmark-controls">
                            <button id="bookmarkVideoBtn" class="bookmark-button">
                                🔖 Bookmark Video
                            </button>
                            <button id="removeBookmarkBtn" class="remove-bookmark-button" style="display: none;">
                                🗑️ Remove Bookmark
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
        
        // Add labeling button handlers (OPTIMIZED)
        const submitBtn = modal.querySelector('#submitGroundTruthBtn');
        
        submitBtn.addEventListener('click', () => {
            if (hasPreviewChanges && currentPreviewLabel && currentVideoList[currentVideoIndex]) {
                const videoId = currentVideoList[currentVideoIndex].id;
                commitPreviewLabel(videoId);
            }
        });
        
        // Add bookmark button handlers
        const bookmarkBtn = modal.querySelector('#bookmarkVideoBtn');
        const removeBookmarkBtn = modal.querySelector('#removeBookmarkBtn');
        
        bookmarkBtn.addEventListener('click', () => {
            // Always bookmark the currently displayed video in the modal
            const currentVideo = currentVideoList[currentVideoIndex];
            if (currentVideo) {
                bookmarkCurrentVideo(currentVideo);
            }
            // updateBookmarkButtons will be called automatically by setBookmark
        });
        
        removeBookmarkBtn.addEventListener('click', () => {
            removeBookmark();
            // updateBookmarkButtons will be called automatically by clearBookmark
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
        // Clear any previous source and load new video
        videoElement.pause();
        videoElement.src = '';
        videoElement.src = video.url;
        videoElement.load(); // Force reload of the video
    }
    
    // Initialize preview system for this video FIRST
    initializePreviewLabel(video.id);
    
    // Update labeling controls (now synchronous and fast)
    updateLabelingModalControls(video.id);
    
    // Update bookmark buttons
    updateBookmarkButtons(video.id);
    
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
    
    // Auto-play if possible (with error handling)
    if (videoElement) {
        // Wait a moment for the video to load before trying to play
        setTimeout(() => {
            videoElement.play().catch((error) => {
                console.log('Auto-play failed (this is normal):', error);
            });
        }, 100);
    }
    
    console.log('Labeling modal opened successfully');
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
                togglePreviewLabel(currentVideoList[currentVideoIndex].id);
            }
            break;
        case 'Enter':
            e.preventDefault();
            if (hasPreviewChanges && currentPreviewLabel && currentVideoList[currentVideoIndex]) {
                const videoId = currentVideoList[currentVideoIndex].id;
                commitPreviewLabel(videoId);
            }
            break;
        case 'b':
        case 'B':
            e.preventDefault();
            if (currentVideoList && currentVideoList[currentVideoIndex]) {
                const currentVideo = currentVideoList[currentVideoIndex];
                if (isVideoBookmarked(currentVideo.id)) {
                    removeBookmark();
                } else {
                    bookmarkCurrentVideo(currentVideo);
                }
                updateBookmarkButtons(currentVideo.id);
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
    
    // Check if we're going past the boundaries
    if (currentVideoIndex < 0) {
        // Going before the first video - go to previous page if possible
        if (currentPage > 1) {
            // Go to previous page and set index to the last video of that page
            const newPage = currentPage - 1;
            const lastIndexOnPrevPage = Math.min(newPage * videosPerPage - 1, currentVideoList.length - 1);
            goToLabelingPageAndShowVideo(newPage, lastIndexOnPrevPage);
            return;
        } else {
            // Already on first page, wrap to last video of current page
            const lastIndexOnCurrentPage = Math.min(currentPage * videosPerPage - 1, currentVideoList.length - 1);
            currentVideoIndex = lastIndexOnCurrentPage;
        }
    } else if (currentVideoIndex >= currentVideoList.length) {
        // Going past the last video - go to next page if possible
        if (currentPage < totalPages) {
            // Go to next page and set index to the first video of that page
            const newPage = currentPage + 1;
            const firstIndexOnNextPage = (newPage - 1) * videosPerPage;
            goToLabelingPageAndShowVideo(newPage, firstIndexOnNextPage);
            return;
        } else {
            // Already on last page, wrap to first video of current page
            currentVideoIndex = (currentPage - 1) * videosPerPage;
        }
    } else {
        // Calculate what page the new index would be on
        const newPage = Math.floor(currentVideoIndex / videosPerPage) + 1;
        
        if (newPage !== currentPage) {
            // Navigation crosses page boundary within the video list
            goToLabelingPageAndShowVideo(newPage, currentVideoIndex);
            return;
        }
    }
    
    // Ensure index is within bounds
    currentVideoIndex = Math.max(0, Math.min(currentVideoIndex, currentVideoList.length - 1));
    
    console.log('Navigating from index', oldIndex, 'to', currentVideoIndex, 'on page', currentPage);
    
    const nextVideo = currentVideoList[currentVideoIndex];
    if (nextVideo) {
        console.log('Loading labeling video:', nextVideo.title);
        
        // Reset preview state when navigating to new video
        currentPreviewLabel = null;
        hasPreviewChanges = false;
        
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

// Add event listeners to pagination controls for labeling
function addLabelingPaginationEventListeners(queryData) {
    const paginationBtns = document.querySelectorAll('.pagination-btn:not(.disabled)');
    paginationBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetPage = parseInt(btn.getAttribute('data-page'));
            if (targetPage && targetPage !== currentPage) {
                goToLabelingPage(targetPage, queryData);
            }
        });
    });
}

// Navigate to a specific page in labeling view
function goToLabelingPage(page, queryData) {
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    displayCurrentLabelingPage(queryData);
    
    // Scroll to top of results
    const labelingContainer = document.getElementById('labelingContainer');
    if (labelingContainer) {
        labelingContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Update bookmark button visibility and state
function updateBookmarkButtons(videoId) {
    const bookmarkBtn = document.getElementById('bookmarkVideoBtn');
    const removeBookmarkBtn = document.getElementById('removeBookmarkBtn');
    
    if (!bookmarkBtn || !removeBookmarkBtn) return;
    
    // Check if this specific video is bookmarked (not just if any bookmark exists)
    const currentBookmark = getBookmark();
    const isThisVideoBookmarked = currentBookmark && currentBookmark.videoId === videoId;
    
    if (isThisVideoBookmarked) {
        bookmarkBtn.style.display = 'none';
        removeBookmarkBtn.style.display = 'block';
    } else {
        bookmarkBtn.style.display = 'block';
        removeBookmarkBtn.style.display = 'none';
    }
    
    console.log(`Updated bookmark buttons for video ${videoId}, bookmarked: ${isThisVideoBookmarked}`);
}

// Update the visibility of the "Jump to Bookmark" button (legacy function - no longer used)
function updateJumpToBookmarkButton() {
    // This function is no longer needed since the bookmark button is now in the labeling interface
    // Keeping it for backward compatibility but it does nothing
}

// Jump to bookmarked video within the current query
function jumpToBookmarkInCurrentQuery(queryData) {
    const bookmark = getBookmark();
    if (!bookmark || bookmark.queryFolder !== queryData.folder) {
        alert('No bookmark found for this query');
        return;
    }
    
    console.log('Jumping to bookmark within current query:', bookmark);
    
    try {
        // Navigate to the correct page if needed
        if (bookmark.currentPage && bookmark.currentPage !== currentPage) {
            console.log('Navigating to page:', bookmark.currentPage);
            goToLabelingPage(bookmark.currentPage, queryData);
            
            // Wait for page to load, then highlight the video
            setTimeout(() => {
                highlightBookmarkedVideo(bookmark.videoId, bookmark.videoTitle);
            }, 300);
        } else {
            // Already on the right page, just highlight the video
            highlightBookmarkedVideo(bookmark.videoId, bookmark.videoTitle);
        }
    } catch (error) {
        console.error('Error jumping to bookmark:', error);
        alert('Error navigating to bookmark: ' + error.message);
    }
}

// Highlight the bookmarked video on the current page
function highlightBookmarkedVideo(videoId, videoTitle) {
    console.log('Looking for bookmarked video:', videoId);
    const videoCards = document.querySelectorAll('.video-card');
    let found = false;
    
    videoCards.forEach(card => {
        const thumbnail = card.querySelector('.video-thumbnail');
        if (thumbnail && thumbnail.getAttribute('data-video-id') === videoId) {
            // Highlight the bookmarked video
            card.style.border = '3px solid #007bff';
            card.style.boxShadow = '0 0 20px rgba(0,123,255,0.5)';
            
            // Scroll to the video
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Remove highlight after 5 seconds
            setTimeout(() => {
                card.style.border = '';
                card.style.boxShadow = '';
            }, 5000);
            
            found = true;
        }
    });
    
    if (found) {
        showBookmarkNotification(`Found bookmarked video: "${videoTitle}"`);
    } else {
        showBookmarkNotification('Bookmark location found, but video not visible on current page');
    }
}

// Helper function to navigate to a page and show a specific video (for regular video view)
function goToPageAndShowVideo(targetPage, videoIndex) {
    console.log('goToPageAndShowVideo called:', targetPage, videoIndex);
    
    if (targetPage < 1 || targetPage > totalPages) {
        console.log('Invalid page:', targetPage);
        return;
    }
    
    currentPage = targetPage;
    currentVideoIndex = videoIndex;
    
    // Update the page display first
    displayCurrentPage();
    
    // Wait for the page to render, then show the video modal
    setTimeout(() => {
        const video = currentVideoList[currentVideoIndex];
        if (video) {
            console.log('Showing video after page change:', video.title);
            showVideoModal(video);
        } else {
            console.error('Video not found at index after page change:', currentVideoIndex);
        }
    }, 200); // Small delay to ensure page renders
}

// Helper function to navigate to a page and show a specific video (for labeling view)
function goToLabelingPageAndShowVideo(targetPage, videoIndex) {
    console.log('goToLabelingPageAndShowVideo called:', targetPage, videoIndex);
    
    if (targetPage < 1 || targetPage > totalPages) {
        console.log('Invalid page:', targetPage);
        return;
    }
    
    if (!currentQuery) {
        console.error('No current query available');
        return;
    }
    
    currentPage = targetPage;
    currentVideoIndex = videoIndex;
    
    // Update the page display first
    displayCurrentLabelingPage(currentQuery);
    
    // Wait for the page to render, then show the video modal
    setTimeout(() => {
        const video = currentVideoList[currentVideoIndex];
        if (video) {
            console.log('Showing labeling video after page change:', video.title);
            showLabelingVideoModal(video);
        } else {
            console.error('Video not found at index after page change:', currentVideoIndex);
        }
    }, 200); // Small delay to ensure page renders
}

// ===== ENHANCED RANKING FUNCTIONS =====

// Sample random videos from a specific range of rankings
function sampleVideosFromRange(sortedResults, startRank, endRank, sampleSize = 100) {
    // Filter videos within the specified rank range
    const rangeVideos = sortedResults.filter(result => 
        result.rank >= startRank && result.rank <= endRank
    );
    
    if (rangeVideos.length === 0) {
        return [];
    }
    
    // If we have fewer videos than sample size, return all
    if (rangeVideos.length <= sampleSize) {
        return rangeVideos;
    }
    
    // Use deterministic sampling based on range for consistent results
    const rangeName = `range_${startRank}_${endRank}`;
    const seed = generateSeedFromPoolName(rangeName);
    const sampledVideos = deterministicSample(rangeVideos, sampleSize, seed);
    
    return sampledVideos;
}

// Calculate true positive rate for a sample
function calculateTruePositiveRate(sampleVideos) {
    if (sampleVideos.length === 0) {
        return 0;
    }
    
    // Always get the latest labeled videos to ensure we have up-to-date annotation data
    const labeledVideos = getLabeledVideos();
    let truePositives = 0;
    let totalLabeled = 0;
    
    console.log('Calculating TPR for', sampleVideos.length, 'videos');
    console.log('Available labels:', Object.keys(labeledVideos).length);
    
    for (const video of sampleVideos) {
        const videoData = findVideoDataForRanking(video.filename);
        if (videoData) {
            totalLabeled++; // Count all videos, not just explicitly labeled ones
            const actualLabel = labeledVideos[videoData.id] || 'no'; // Apply default 'no' label consistently
            if (actualLabel === 'yes') {
                truePositives++;
            }
        }
    }
    
    // If no videos found, return 0
    if (totalLabeled === 0) {
        console.log('No videos found for TPR calculation');
        return 0;
    }
    
    const tpr = truePositives / totalLabeled;
    console.log('TPR calculation:', { truePositives, totalLabeled, tpr: (tpr * 100).toFixed(1) + '%' });
    
    return tpr;
}

// Estimate true positives in a dataset pool based on sample rate
function estimateTruePositives(totalVideos, truePosRate) {
    return Math.round(totalVideos * truePosRate);
}

// Perform sampling and analysis for all ranges
function performSamplingAnalysis(sortedResults) {
    const totalVideos = sortedResults.length;
    const ranges = [
        { name: 'Top 1-1k', start: 1, end: Math.min(1000, totalVideos) },
        { name: '1k-5k', start: 1001, end: Math.min(5000, totalVideos) },
        { name: '5k-10k', start: 5001, end: Math.min(10000, totalVideos) }
    ];
    
    const results = {};
    currentDatasetPools = []; // Reset dataset pools
    
    for (const range of ranges) {
        // Skip ranges that start beyond our total videos
        if (range.start > totalVideos) {
            const rangeResult = {
                name: range.name,
                start: range.start,
                end: range.end,
                actualEnd: 0,
                sample: [],
                sampleSize: 0,
                totalInRange: 0,
                truePosRate: 0,
                estimatedTruePos: 0,
                meetsGoal: false,
                hasVideos: false,
                displayName: `${range.name} (no videos available)`
            };
            results[range.name] = rangeResult;
            currentDatasetPools.push(rangeResult); // Still add to pools for display
            continue;
        }
        
        // Adjust the actual end based on available videos
        const actualEnd = Math.min(range.end, totalVideos);
        const sample = sampleVideosFromRange(sortedResults, range.start, actualEnd, sampleSize);
        const truePosRate = calculateTruePositiveRate(sample);
        const totalInRange = sortedResults.filter(r => r.rank >= range.start && r.rank <= actualEnd).length;
        const estimatedTruePos = estimateTruePositives(totalInRange, truePosRate);
        
        // Create display name showing actual range
        let displayName = range.name;
        if (actualEnd < range.end) {
            const actualRangeEnd = actualEnd === 1000 ? '1k' : actualEnd === 5000 ? '5k' : actualEnd.toString();
            if (range.name === 'Top 1-1k' && actualEnd < 1000) {
                displayName = `Top 1-${actualEnd}`;
            } else if (range.name === '1k-5k' && actualEnd < 5000) {
                const endDisplay = actualEnd <= 1000 ? actualEnd.toString() : `${Math.floor(actualEnd/1000)}k`;
                displayName = `1k-5k (1k-${endDisplay} available)`;
            } else if (range.name === '5k-10k' && actualEnd < 10000) {
                const endDisplay = actualEnd <= 5000 ? `${Math.floor(actualEnd/1000)}k` : `${Math.floor(actualEnd/1000)}k`;
                displayName = `5k-10k (5k-${endDisplay} available)`;
            }
        }
        
        const rangeResult = {
            name: range.name,
            start: range.start,
            end: range.end,
            actualEnd: actualEnd,
            sample: sample,
            sampleSize: sample.length,
            totalInRange: totalInRange,
            truePosRate: truePosRate,
            estimatedTruePos: estimatedTruePos,
            meetsGoal: estimatedTruePos >= calculateEstimatedTruePositives(sortedResults, videosDisplayed),
            hasVideos: totalInRange > 0,
            displayName: displayName
        };
        
        results[range.name] = rangeResult;
        currentDatasetPools.push(rangeResult); // Add all pools for display
    }
    
    samplingResults = results;
    return results;
}

// Display ranking results for a query
function displayCurrentRankingPage(queryData, metadata) {
    const rankingContainer = document.getElementById('rankingContainer');
    
    // Calculate start and end indices for current page
    const startIndex = (currentPage - 1) * videosPerPage;
    const endIndex = startIndex + videosPerPage;
    const currentPageRankings = allVideos.slice(startIndex, endIndex);
    
    // Create pagination controls
    const paginationHtml = createPaginationControls();
    
    // Create ranking list HTML
    const rankingListHtml = currentPageRankings.map((video, pageIndex) => {
        const globalIndex = startIndex + pageIndex;
        return createRankingCard(video, metadata, globalIndex);
    }).join('');
    
    // Update ranking container with pagination and list
    rankingContainer.innerHTML = `
        <div class="pagination-info">
            <span>Showing ${startIndex + 1}-${Math.min(endIndex, allVideos.length)} of ${allVideos.length} rankings</span>
        </div>
        ${paginationHtml}
        <div class="ranking-list-container">
            ${rankingListHtml}
        </div>
        ${totalPages > 1 ? paginationHtml : ''}
    `;
    
    // Add click handlers for video thumbnails and star buttons in ranking cards
    setTimeout(() => {
        const rankingThumbnails = document.querySelectorAll('.ranking-thumbnail');
        rankingThumbnails.forEach((thumbnail, pageIndex) => {
            thumbnail.addEventListener('click', () => {
                try {
                    const videoDataStr = thumbnail.getAttribute('data-video-data');
                    if (videoDataStr) {
                        const videoData = JSON.parse(videoDataStr);
                        currentVideoIndex = startIndex + pageIndex;
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
    
    // Add pagination event listeners for rankings
    addRankingPaginationEventListeners(queryData, metadata);
}

// Add event listeners to pagination controls for rankings
function addRankingPaginationEventListeners(queryData, metadata) {
    const paginationBtns = document.querySelectorAll('.pagination-btn:not(.disabled)');
    paginationBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetPage = parseInt(btn.getAttribute('data-page'));
            if (targetPage && targetPage !== currentPage) {
                goToRankingPage(targetPage, queryData, metadata);
            }
        });
    });
}

// Navigate to a specific page in ranking view
function goToRankingPage(page, queryData, metadata) {
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    displayCurrentRankingPage(queryData, metadata);
    
    // Scroll to top of results
    const rankingContainer = document.getElementById('rankingContainer');
    if (rankingContainer) {
        rankingContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Reset pagination to first page
function resetPagination() {
    currentPage = 1;
    totalPages = 1;
    allVideos = [];
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
// Find video data that matches a ranking filename
// Find video data that matches a ranking filename
function findVideoDataForRanking(filename) {
    if (!currentQuery || !currentQuery.videos) {
        return null;
    }
    
    // Try to match by filename extracted from video URL
    let videoData = currentQuery.videos.find(video => {
        const videoFilename = extractFilenameFromUrl(video.video || video.url || video.localPath || '');
        return videoFilename === filename;
    });
    
    // If no exact match, try partial matches
    if (!videoData) {
        videoData = currentQuery.videos.find(video => {
            const videoFilename = extractFilenameFromUrl(video.video || video.url || video.localPath || '');
            return videoFilename.includes(filename.replace('.mp4', '')) || 
                   filename.includes(videoFilename.replace('.mp4', ''));
        });
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

// Extract filename from video URL
function extractFilenameFromUrl(url) {
    if (!url) return "";
    // Extract filename from URL like "https://huggingface.co/datasets/jackieyayqli/vqascore/resolve/main/dolly_out/1000564187.mp4"
    const parts = url.split("/");
    return parts[parts.length - 1] || "";
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

// Update true positive goal
function updateTruePosGoal(newGoal) {
    // For backward compatibility, update both the old goal and videos displayed
    truePosGoal = parseInt(newGoal) || 100;
    
    // Update videos displayed based on the goal and current estimation rate
    if (currentQuery && allVideos) {
        // Try to estimate how many videos we need to display to get the desired true positives
        const currentRate = calculateCurrentTruePositiveRate();
        if (currentRate > 0) {
            videosDisplayed = Math.ceil(truePosGoal / currentRate);
        } else {
            videosDisplayed = truePosGoal * 2; // Conservative estimate if no rate available
        }
    }
    
    console.log('True positive goal updated to:', truePosGoal, 'Videos displayed adjusted to:', videosDisplayed);
    
    // Refresh the rankings display if available
    if (currentViewMode === 'rankings' && currentQuery) {
        displayRankings(currentQuery);
    }
}

// Calculate current true positive rate from labeled data
function calculateCurrentTruePositiveRate() {
    if (!currentQuery || !currentQuery.videos) return 0;
    
    const labeledVideos = getLabeledVideos();
    let truePositives = 0;
    let labeledCount = 0;
    
    for (const video of currentQuery.videos) {
        const label = labeledVideos[video.id];
        if (label === 'yes') {
            truePositives++;
        }
        if (label) {
            labeledCount++;
        }
    }
    
    return labeledCount > 0 ? truePositives / labeledCount : 0;
}

// Refresh sampling analysis (updated for videos displayed approach)
function refreshSamplingAnalysis() {
    if (allVideos && allVideos.length > 0) {
        // Update the estimated true positives display
        const estimatedElement = document.getElementById('estimatedTruePos');
        if (estimatedElement) {
            const estimated = calculateEstimatedTruePositives(allVideos, videosDisplayed);
            estimatedElement.textContent = estimated;
        }
        
        performSamplingAnalysis(allVideos);
        // Refresh the display if we're on rankings view
        if (currentViewMode === 'rankings' && currentQuery) {
            displayRankings(currentQuery);
        }
    }
}

// View a specific dataset pool in the labeling section
function viewDatasetPool(poolName) {
    const pool = samplingResults[poolName];
    if (!pool) {
        console.error('Dataset pool not found:', poolName);
        alert('Dataset pool not found: ' + poolName);
        return;
    }
    
    // Check if pool has any videos
    if (!pool.hasVideos || pool.totalInRange === 0) {
        alert(`The ${pool.displayName || pool.name} dataset pool has no videos available in this ranking range.`);
        return;
    }
    
    // Use the pre-sampled videos from the pool instead of re-sampling
    const poolVideos = getVideosFromPoolSample(pool, 100);
    
    if (poolVideos.length === 0) {
        alert(`No videos found in the ${pool.displayName || pool.name} dataset pool range (${pool.start}-${pool.actualEnd || pool.end}). This may be because all videos in this range have already been sampled or there's a data issue.`);
        return;
    }
    
    const poolQueryData = {
        query: `${currentQuery.query} - ${pool.displayName || pool.name} Dataset Pool (Sample: ${poolVideos.length} videos)`,
        folder: currentQuery.folder + '_pool_' + poolName.toLowerCase().replace(/\s+/g, '_'),
        timestamp: new Date().toISOString(),
        totalResults: poolVideos.length,
        videos: poolVideos,
        isDatasetPool: true,
        originalQuery: currentQuery,
        originalAllVideos: allVideos, // Preserve original allVideos for sampling analysis
        poolInfo: {
            ...pool,
            sampleVideos: poolVideos,
            totalInRange: pool.totalInRange,
            rangeStart: pool.start,
            rangeEnd: pool.actualEnd || pool.end
        }
    };
    
    // Switch to labeling view with the pool data
    currentQuery = poolQueryData;
    switchViewMode('labeling');
}

// Get videos from the pre-sampled pool data
function getVideosFromPoolSample(pool, targetCount = 100) {
    if (!pool || !pool.sample || pool.sample.length === 0) {
        return [];
    }
    
    // Convert the sample videos to the proper video data format
    const videoDataList = pool.sample.map(result => {
        if (result.videoData) {
            return result.videoData; // Already has video data
        } else if (result.filename) {
            return findVideoDataForRanking(result.filename);
        } else {
            return result; // Assume it's already video data
        }
    }).filter(Boolean);
    
    // Return up to targetCount videos from the pre-sampled data
    return videoDataList.slice(0, targetCount);
}

// Generate a seed from pool name for deterministic sampling
function generateSeedFromPoolName(poolName) {
    let hash = 0;
    for (let i = 0; i < poolName.length; i++) {
        const char = poolName.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

// Deterministic sampling using a seed
function deterministicSample(array, sampleSize, seed) {
    if (sampleSize >= array.length) {
        return array;
    }
    
    // Create a seeded random number generator
    const seededRandom = createSeededRandom(seed);
    
    // Fisher-Yates shuffle with seeded random
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled.slice(0, sampleSize);
}

// Create a seeded random number generator
function createSeededRandom(seed) {
    let state = seed;
    return function() {
        state = (state * 9301 + 49297) % 233280;
        return state / 233280;
    };
}

// Calculate TPR for the current dataset pool
function calculateDatasetPoolTPR() {
    if (!currentQuery || !currentQuery.isDatasetPool || !currentQuery.videos) {
        console.error('Not currently viewing a dataset pool');
        return;
    }
    
    const labeledVideos = getLabeledVideos();
    const poolVideos = currentQuery.videos;
    
    let totalAnnotated = 0;
    let truePositives = 0;
    
    // Count ALL videos in the current pool sample (including default 'no' labels)
    for (const video of poolVideos) {
        totalAnnotated++; // Count all videos, not just explicitly labeled ones
        const actualLabel = labeledVideos[video.id] || 'no'; // Apply default 'no' label consistently
        if (actualLabel === 'yes') {
            truePositives++;
        }
    }
    
    if (totalAnnotated === 0) {
        alert('No videos in the pool sample.');
        return;
    }
    
    const tpr = truePositives / totalAnnotated;
    const estimatedTotalTruePositives = Math.round(currentQuery.poolInfo.totalInRange * tpr);
    
    // Update the pool TPR display
    updateDatasetPoolTPRDisplay(totalAnnotated, truePositives, tpr, estimatedTotalTruePositives);
    
    // Show detailed results
    const message = `
Dataset Pool TPR Analysis:

📊 Sample Results:
• Videos Annotated: ${totalAnnotated} / ${poolVideos.length}
• True Positives: ${truePositives}
• True Positive Rate: ${(tpr * 100).toFixed(1)}%

🎯 Pool Estimates:
• Total Videos in Range: ${currentQuery.poolInfo.totalInRange.toLocaleString()}
• Estimated True Positives: ${estimatedTotalTruePositives.toLocaleString()}
• Range: ${currentQuery.poolInfo.rangeStart}-${currentQuery.poolInfo.rangeEnd}

📺 Videos Displayed: ${videosDisplayed} | Target TP from displayed: ${calculateEstimatedTruePositives(getAllCurrentRankings(), videosDisplayed)}
${estimatedTotalTruePositives >= videosDisplayed * 0.5 ? '✅ Good estimation rate for displayed videos!' : '❌ Low estimation rate - consider adjusting displayed count'}
    `.trim();
    
    //alert(message);
}

// Calculate TPR and redirect to rankings page
function calculateDatasetPoolTPRAndRedirect() {
    if (!currentQuery || !currentQuery.isDatasetPool || !currentQuery.videos) {
        console.error('Not currently viewing a dataset pool');
        return;
    }
    
    const labeledVideos = getLabeledVideos();
    const poolVideos = currentQuery.videos;
    
    let totalAnnotated = 0;
    let truePositives = 0;
    
    // Count ALL videos in the current pool sample (including default 'no' labels)
    for (const video of poolVideos) {
        totalAnnotated++; // Count all videos, not just explicitly labeled ones
        const actualLabel = labeledVideos[video.id] || 'no'; // Apply default 'no' label consistently
        if (actualLabel === 'yes') {
            truePositives++;
        }
    }
    
    if (totalAnnotated === 0) {
        alert('No videos in the pool sample.');
        return;
    }
    
    const tpr = truePositives / totalAnnotated;
    const estimatedTotalTruePositives = Math.round(currentQuery.poolInfo.totalInRange * tpr);
    
    // Show results before redirecting
    const message = `
Dataset Pool TPR Analysis Complete:

📊 Sample Results:
• Videos Annotated: ${totalAnnotated} / ${poolVideos.length}
• True Positives: ${truePositives}
• True Positive Rate: ${(tpr * 100).toFixed(1)}%

🎯 Pool Estimates:
• Total Videos in Range: ${currentQuery.poolInfo.totalInRange.toLocaleString()}
• Estimated True Positives: ${estimatedTotalTruePositives.toLocaleString()}
• Range: ${currentQuery.poolInfo.rangeStart}-${currentQuery.poolInfo.rangeEnd}

Redirecting to rankings page...
    `.trim();
    
    alert(message);
    
    // Redirect to rankings page
    switchViewMode('rankings');
}

// Update the dataset pool TPR display in real-time
function updateDatasetPoolTPRDisplay(totalAnnotated, truePositives, tpr, estimatedTotal) {
    const tprDisplay = document.getElementById('datasetPoolTPRDisplay');
    if (tprDisplay) {
        const meetsGoal = estimatedTotal >= videosDisplayed * 0.5; // Use videos displayed instead of truePosGoal
        
        tprDisplay.innerHTML = `
            <div class="pool-tpr-results ${meetsGoal ? 'meets-goal' : 'below-goal'}">
                <div class="tpr-stats">
                    <div class="tpr-stat">
                        <span class="tpr-value">${totalAnnotated}</span>
                        <span class="tpr-label">Annotated</span>
                    </div>
                    <div class="tpr-stat">
                        <span class="tpr-value">${truePositives}</span>
                        <span class="tpr-label">True Positives</span>
                    </div>
                    <div class="tpr-stat">
                        <span class="tpr-value">${(tpr * 100).toFixed(1)}%</span>
                        <span class="tpr-label">TPR</span>
                    </div>
                    <div class="tpr-stat">
                        <span class="tpr-value ${meetsGoal ? 'goal-met' : 'goal-not-met'}">${estimatedTotal.toLocaleString()}</span>
                        <span class="tpr-label">Est. Total TP</span>
                    </div>
                </div>
            </div>
        `;
    }
}

// ===== PREVIEW LABELING SYSTEM =====

// Toggle preview label (spacebar functionality)
function togglePreviewLabel(videoId) {
    if (!videoId) return;
    
    // Initialize preview label if not set
    if (currentPreviewLabel === null) {
        const labeled = getLabeledVideos();
        const actualLabel = labeled[videoId];
        // Start with opposite of current actual label, or 'yes' if unlabeled
        currentPreviewLabel = actualLabel === 'yes' ? 'no' : 'yes';
    } else {
        // Toggle between yes/no
        currentPreviewLabel = currentPreviewLabel === 'yes' ? 'no' : 'yes';
    }
    
    hasPreviewChanges = true;
    updateLabelingModalControls(videoId);
    
    console.log(`Preview toggled to: ${currentPreviewLabel} for video ${videoId}`);
}

// Commit preview label as actual label
function commitPreviewLabel(videoId) {
    if (!hasPreviewChanges || !currentPreviewLabel || !videoId) {
        console.log('No preview changes to commit');
        return;
    }
    
    // Save the preview as actual label
    setVideoLabel(videoId, currentPreviewLabel);
    
    // Update video card appearance
    updateVideoCardLabelForPreviewSystem(videoId, currentPreviewLabel);
    
    // Reset preview state
    currentPreviewLabel = null;
    hasPreviewChanges = false;
    
    // Update modal controls to show committed state
    updateLabelingModalControls(videoId);
    
    console.log(`Committed preview label: ${currentPreviewLabel} for video ${videoId}`);
}

// Initialize preview label when opening a video
function initializePreviewLabel(videoId) {
    const labeled = getLabeledVideos();
    const actualLabel = labeled[videoId];
    
    // Always start with preview as 'no' regardless of actual label
    currentPreviewLabel = 'no';
    
    // If video is unlabeled, setting any preview (even 'no') counts as a change
    hasPreviewChanges = !actualLabel;
    
    console.log(`Initialized preview for video ${videoId}: actual=${actualLabel}, preview=${currentPreviewLabel}, hasChanges=${hasPreviewChanges}`);
}

// Update video card appearance for preview system (shows Labeled/Unlabeled)
function updateVideoCardLabelForPreviewSystem(videoId, newLabel) {
    // Find all video cards with this ID
    const videoCards = document.querySelectorAll(`[data-video-id="${videoId}"]`);
    
    videoCards.forEach(cardOrThumbnail => {
        const videoCard = cardOrThumbnail.closest('.video-card');
        if (!videoCard) return;
        
        // Update card classes - only show as labeled if there's an actual committed label
        videoCard.classList.remove('labeled-yes', 'labeled-no', 'labeled-unlabeled');
        if (newLabel) {
            videoCard.classList.add(newLabel === 'yes' ? 'labeled-yes' : 'labeled-no');
        } else {
            videoCard.classList.add('labeled-unlabeled');
        }
        
        // Update label overlay to show "Labeled" or "Unlabeled" based on actual committed label
        const labelOverlay = videoCard.querySelector('.label-overlay');
        if (labelOverlay) {
            if (newLabel) {
                labelOverlay.className = 'label-overlay label-labeled';
                labelOverlay.textContent = '✅ LABELED';
            } else {
                labelOverlay.className = 'label-overlay label-unlabeled';
                labelOverlay.textContent = '🏷️ UNLABELED';
            }
        }
        
        // Update label buttons if present - only show active state for committed labels
        const labelButtons = videoCard.querySelectorAll('.label-button');
        labelButtons.forEach(button => {
            const buttonLabel = button.getAttribute('data-label');
            button.classList.toggle('active', newLabel && buttonLabel === newLabel);
        });
    });
    
    // Update stats in header
    if (currentViewMode === 'labeling') {
        updateLabelingStats();
    }
}

// Update videos displayed count
function updateVideosDisplayed(newCount) {
    videosDisplayed = parseInt(newCount) || 100;
    console.log('Videos displayed updated to:', videosDisplayed);
    
    // Update the estimated true positives display
    const estimatedElement = document.getElementById('estimatedTruePos');
    if (estimatedElement && currentQuery) {
        // Recalculate with current ranking data
        const allRankings = getAllCurrentRankings();
        const estimated = calculateEstimatedTruePositives(allRankings, videosDisplayed);
        estimatedElement.textContent = estimated;
    }
}

// Calculate estimated true positives from top N videos
function calculateEstimatedTruePositives(rankingResults, topN) {
    if (!rankingResults || rankingResults.length === 0) return 0;
    
    // Take the top N videos from the ranking results
    const topVideos = rankingResults.slice(0, Math.min(topN, rankingResults.length));
    
    // If we have labels available, calculate based on actual labels
    const labeledVideos = getLabeledVideos();
    let truePositives = 0;
    let labeledCount = 0;
    
    for (const result of topVideos) {
        const videoData = result.videoData || result;
        if (videoData && videoData.id) {
            const label = labeledVideos[videoData.id];
            if (label === 'yes') {
                truePositives++;
            }
            if (label) {
                labeledCount++;
            }
        }
    }
    
    // If we have enough labeled data, use actual rate
    if (labeledCount >= Math.min(20, topN * 0.2)) {
        const actualRate = truePositives / labeledCount;
        return Math.round(topN * actualRate);
    }
    
    // Otherwise, estimate based on confidence scores if available
    let estimatedRate = 0;
    let scoresCount = 0;
    
    for (const result of topVideos) {
        const videoData = result.videoData || result;
        if (videoData && videoData.confidenceScore !== undefined) {
            estimatedRate += videoData.confidenceScore;
            scoresCount++;
        }
    }
    
    if (scoresCount > 0) {
        estimatedRate = estimatedRate / scoresCount;
        return Math.round(topN * estimatedRate);
    }
    
    // Fallback: assume 50% rate for top videos
    return Math.round(topN * 0.5);
}

// Get current ranking results for estimation
function getAllCurrentRankings() {
    return allVideos || [];
}

// Setup annotations tab with the displayed video count
function setupAnnotationsFromDisplayed() {
    if (!currentQuery) {
        alert('No query selected');
        return;
    }
    
    console.log('Setting up annotations for', videosDisplayed, 'videos');
    
    // Create a dataset pool from the top N videos
    const allRankings = getAllCurrentRankings();
    const topVideos = allRankings.slice(0, Math.min(videosDisplayed, allRankings.length));
    
    // Convert ranking results to video data for the annotation pool
    const poolVideos = topVideos.map(result => {
        if (result.videoData) {
            return result.videoData;
        } else {
            // If it's already video data format
            return result;
        }
    }).filter(Boolean);
    
    if (poolVideos.length === 0) {
        alert('No videos available for annotation setup');
        return;
    }
    
    // Create a simple annotation query
    const annotationQuery = {
        query: `${currentQuery.query} (Top ${videosDisplayed} Videos)`,
        folder: `${currentQuery.folder}_top_${videosDisplayed}`,
        videos: poolVideos,
        isAnnotation: true,
        originalQuery: currentQuery,
        originalAllVideos: allVideos
    };
    
    // Switch to the annotation query and labeling mode
    currentQuery = annotationQuery;
    switchViewMode('labeling');
    
    // Show success message
    showVideosDisplayedNotification(`Annotation setup with ${poolVideos.length} videos.`);
}

// Show notification for videos displayed setup
function showVideosDisplayedNotification(message) {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('videosDisplayedNotification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'videosDisplayedNotification';
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
            max-width: 400px;
        `;
        document.body.appendChild(notification);
    }
    
    notification.textContent = message;
    
    // Show notification
    notification.style.opacity = '1';
    
    // Hide after 4 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
    }, 4000);
}

// Force refresh annotation data from backend
async function forceRefreshAnnotationData() {
    try {
        console.log('Force refreshing annotation data from backend...');
        await initializeLabelCache();
        console.log('Annotation data refreshed successfully');
        return true;
    } catch (error) {
        console.warn('Error force refreshing annotation data:', error);
        return false;
    }
}

// Refresh dataset pool analysis with latest annotation data
async function refreshDatasetPoolAnalysis() {
    if (!currentQuery) {
        console.warn('No current query available for analysis refresh');
        return;
    }
    
    console.log('Refreshing dataset pool analysis...');
    
    // Show loading state on the button
    const refreshBtn = document.querySelector('.sampling-analysis-section .refresh-btn');
    if (refreshBtn) {
        const originalText = refreshBtn.innerHTML;
        refreshBtn.innerHTML = '⏳ Refreshing...';
        refreshBtn.disabled = true;
        
        try {
            // Force refresh annotation data from backend
            await forceRefreshAnnotationData();
            
            // Recalculate sampling analysis with fresh data
            if (allVideos && allVideos.length > 0) {
                performSamplingAnalysis(allVideos);
                
                // Refresh the display
                displayRankings(currentQuery);
                
                console.log('Dataset pool analysis refreshed successfully');
            }
        } catch (error) {
            console.warn('Error refreshing dataset pool analysis:', error);
        } finally {
            // Restore button state
            refreshBtn.innerHTML = originalText;
            refreshBtn.disabled = false;
        }
    }
}

// Clear annotation cache to force fresh data retrieval
function clearAnnotationCache() {
    // Clear any cached annotation data to force fresh retrieval
    if (window.labelCache) {
        window.labelCache = {};
    }
    console.log('Annotation cache cleared');
}