const PUBLIC_PAGES = [
    "/",
    "/login.html",
    "/register.html"
];
const avatarColors = [
 "#4594EE", 
  "#3A7BC8",
  "#2F6AB0",
  "#82B8F5",
  "#34C3FF",
  "#2FA8D8",
  "#5E63FF", 
  "#6A88FF", 
  "#3EC6E0"  
];
// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    initializeApp();
    loadJobs();
    if (window.location.pathname !== '/') {
        await checkAuth();
    }
    // Set up search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(loadJobs, 500));
    }
});

// Main initialization function
function initializeApp() {
    initializeBookmarks();
    initializeFilterTags();
    initializeBottomNav();
    initializeJobCards();
    loadSuggestedInternships();
    // Update header avatar from localStorage or server so index (/) shows the profile image
    updateHeaderProfilePic();
}

// Update header avatar from localStorage or fallback to server profile picture
async function updateHeaderProfilePic() {
    const profilePicContainer = document.getElementById('profilePicContainer');
    if (!profilePicContainer) return;

    try {
        const localProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
        if (localProfile && localProfile.profilePicture) {
            profilePicContainer.innerHTML = `<img src="${localProfile.profilePicture}" alt="Profile" class="profile-pic-img">`;
            profilePicContainer.style.cursor = 'pointer';
            profilePicContainer.onclick = function() { window.location.href = 'user-profile.html'; };
            return;
        }
    } catch (err) {
        // ignore
    }

    // If no local profile picture, attempt to fetch from server (if logged in)
    try {
        const res = await fetch('/api/me', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.loggedIn && data.user && data.user.profile_picture) {
            profilePicContainer.innerHTML = `<img src="${data.user.profile_picture}" alt="Profile" class="profile-pic-img">`;
            profilePicContainer.style.cursor = 'pointer';
            profilePicContainer.onclick = function() { window.location.href = 'user-profile.html'; };
            return;
        }

        // No image available, show user initials
        const name = (data.user && (data.user.username || data.user.email)) || 'U';
        const initials = name.split(' ').map(w => w[0] || '').join('').substring(0,2).toUpperCase();
        const bgColor = getColorForName(name);
        profilePicContainer.innerHTML = `<div class="initials-avatar" style="background: ${bgColor};">${initials}</div>`;
        profilePicContainer.style.cursor = 'pointer';
        profilePicContainer.onclick = function() { window.location.href = 'user-profile.html'; };
    } catch (err) {
        // ignore
    }
}


// Load suggested jobs based on user preference
async function loadSuggestedInternships() {
    const container = document.getElementById('suggestedJobContainer');
    if (!container) return; 

    // Show loading state
    container.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2 text-muted">Finding suggested internships...</p>
        </div>
    `;

    try {
        const res = await fetch('/api/jobs/suggested'); 
        
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: res.statusText || 'Unknown server error' }));
            throw new Error(`API failed (Status: ${res.status}). Error: ${errorData.error}`);
        }
        
        const data = await res.json();
        const suggestedJobs = data.jobs || [];

        container.innerHTML = '';
        container.classList.add('jobs-scroll');

        if (suggestedJobs.length === 0) {
            container.innerHTML = `<div class="text-center py-4" style="min-width: 300px;"><i class="bi bi-star" style="font-size: 3rem; color: #ddd;"></i><p class="mt-3 text-muted">No suggestions found. Try setting your preference or check job data.</p></div>`;
            initializeJobCards();
            initializeBookmarks();
            return;
        }

        suggestedJobs.forEach((job) => {
            const companyDomain = job.company.split(' ')[0].toLowerCase();
            const logoUrl = `https://logo.clearbit.com/${companyDomain}.com`;

            const card = document.createElement('div');
            card.className = 'job-card'; 
            
            const tagsHtml = job.position ? `<span class="job-tag">${escapeHtml(job.position)}</span>` : '';
            
            card.innerHTML = `
                <button class="heart-bookmark-btn" data-job-id="${job.id}" data-job-title="${escapeHtml(job.title)}" aria-label="Bookmark job">
                    <i class="bi bi-heart"></i>
                </button>
                <a href="${job.link}" target="_blank" class="job-link">
                    <div class="job-card-header">
                        <img src="${logoUrl}" alt="${job.company} Logo" onerror="this.src='https://cdn-icons-png.flaticon.com/512/847/847969.png'">
                        <div class="job-card-info">
                            <h3>${escapeHtml(job.title)}</h3>
                            <p>${escapeHtml(job.company)} • ${escapeHtml(job.location || 'Remote')}</p>
                        </div>
                    </div>
                    <div class="job-tags">
                        ${tagsHtml}
                        <span class="job-tag site-tag">${escapeHtml(job.site || 'Unknown')}</span>
                    </div>
                </a>
            `;
            container.appendChild(card);
        });

        initializeJobCards();
        initializeBookmarks(); 

    } catch (err) {
        console.error('Error fetching suggested jobs:', err);
        container.innerHTML = `
            <div class="alert alert-danger text-center py-4" role="alert" style="min-width: 300px;">
                <i class="bi bi-exclamation-triangle"></i>
                <p class="mb-0 mt-2">⚠️ Error loading suggestions.</p>
                <p style="font-size: 0.8rem; color: #721c24;">${err.message || 'Network/Server Error'}</p>
            </div>
        `;
    }
}

// Global cache for jobs
let allJobs = [];
let activeCategoryFilter = null; // currently selected category filter
// Map categories to qualification keywords for more robust matching
const categoryKeywordsMap = {
    'IT intern': [
        'computer science', 'computer engineering', 'information technology', 'informatics', 'software', 'programming', 'coding', 'systems'
    ],
    'Marketing': [
        'marketing', 'communications', 'advertising', 'brand'
    ],
    'HR internship': [
        'human resource', 'human resources', 'hr', 'people'
    ],
    'Business Internship': [
        'business', 'management', 'commerce', 'finance', 'accounting', 'entrepreneurship'
    ],
    'Developer Internship': [
        'developer', 'software engineer', 'software', 'programmer', 'development'
    ]
};

function normalizeForMatch(s) {
    return (s || '').toLowerCase().replace(/[\'\"\,\(\)\.\-\/]/g, ' ');
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function matchesKeyword(text, keyword) {
    const q = (text || '').toLowerCase();
    const k = (keyword || '').toLowerCase().trim();
    if (!k) return false;
    // If keyword is multi-word, use simple includes
    if (k.includes(' ')) {
        return q.includes(k);
    }
    // Use word boundary regex for single-word keyword to prevent false positives
    try {
        const regex = new RegExp('\\b' + escapeRegExp(k) + '\\b', 'i');
        return regex.test(q);
    } catch (err) {
        // Fallback
        return q.includes(k);
    }
}

// Load jobs from API
async function loadJobs() {
    const container = document.getElementById('jobContainer');
    const updateTime = document.getElementById('updateTime');
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';

    container.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2 text-muted">Fetching latest internships...</p>
        </div>
    `;

    try {
        const res = await fetch('/api/jobs/all');

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(`API failed (Status: ${res.status}). Error: ${errorData.error}`);
        }

        const data = await res.json();
        allJobs = data.jobs || [];

        // ✔️ handles filtering and displays everything correctly
        renderJobs();

        updateTime.innerHTML = `
            <i class="bi bi-arrow-clockwise"></i> Last updated: 
            ${new Date().toLocaleTimeString()}
        `;
        
    } catch (err) {
        console.error('Error fetching jobs:', err);
        container.innerHTML = `
            <div class="alert alert-danger text-center" role="alert">
                <i class="bi bi-exclamation-triangle"></i>
                <p class="mb-0 mt-2">⚠️ Unable to load internships. Please try again later.</p>
            </div>
        `;
    }
}


// Auto-refresh jobs every 5 minutes
setInterval(loadJobs, 5 * 60 * 1000);

// Bookmark functionality
function initializeBookmarks() {
    const heartButtons = document.querySelectorAll('.heart-bookmark-btn');
    
    heartButtons.forEach(btn => {
        btn.removeEventListener('click', handleHeartClick);
        btn.addEventListener('click', handleHeartClick);
    });
    
    // Load saved bookmarks
    loadBookmarks();
}

// Handle heart button clicks
async function handleHeartClick(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const btn = this;
    const jobId = btn.dataset.jobId;
    const jobTitle = btn.dataset.jobTitle;
    
    if (!jobId) {
        console.log('No job ID found');
        return;
    }
    
    console.log('Heart clicked for job ID:', jobId);
    
    // First, toggle the UI visually
    btn.classList.toggle('bookmarked');
    const icon = btn.querySelector('i');
    
    if (btn.classList.contains('bookmarked')) {
        icon.classList.remove('bi-heart');
        icon.classList.add('bi-heart-fill');
    } else {
        icon.classList.remove('bi-heart-fill');
        icon.classList.add('bi-heart');
    }
    
    // Save to localStorage for offline access
    let localBookmarks = JSON.parse(localStorage.getItem('bookmarkedJobs') || '[]');
    if (btn.classList.contains('bookmarked')) {
        if (!localBookmarks.includes(jobId)) {
            localBookmarks.push(jobId);
        }
    } else {
        localBookmarks = localBookmarks.filter(id => id !== jobId);
    }
    localStorage.setItem('bookmarkedJobs', JSON.stringify(localBookmarks));
    console.log('Saved to localStorage:', localBookmarks);
    
    // Try to save to database if user is logged in
    try {
        const response = await fetch('/api/bookmarks/toggle', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                internship_id: jobId,
                title: jobTitle
            })
        });
        
        const data = await response.json();
        console.log('Bookmark response:', data);
        console.log('Response status:', response.status);
        
        if (response.ok) {
            // Successfully saved to database
            const message = data.bookmarked ? 'Added to bookmarks!' : 'Removed from bookmarks';
            console.log('Database save success:', message);
        } else if (response.status === 401) {
            console.warn('User not logged in - saved to local storage only');
        } else {
            console.error('Bookmark database error:', data.error);
        }
    } catch (err) {
        console.error('Error saving to database:', err);
    }
}

// Load bookmarks from database and localStorage
async function loadBookmarks() {
    const bookmarkedIds = [];
    
    // Try to load from database first (if user is logged in)
    try {
        const response = await fetch('/api/bookmarks', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            bookmarkedIds.push(...(data.bookmarks || []));
            console.log('Loaded from database:', data.bookmarks);
        }
    } catch (err) {
        console.error('Error loading bookmarks from database:', err);
    }
    
    // Also load from localStorage (for offline/unauthenticated users)
    const localBookmarks = JSON.parse(localStorage.getItem('bookmarkedJobs') || '[]');
    bookmarkedIds.push(...localBookmarks);
    
    // Remove duplicates
    const uniqueIds = [...new Set(bookmarkedIds)];
    
    // Apply bookmarked styling to all buttons
    uniqueIds.forEach(bookmarkId => {
        const btn = document.querySelector(`[data-job-id="${bookmarkId}"]`);
        if (btn) {
            btn.classList.add('bookmarked');
            const icon = btn.querySelector('i');
            if (icon) {
                icon.classList.remove('bi-heart');
                icon.classList.add('bi-heart-fill');
            }
        }
    });
    
    console.log('Total bookmarked jobs loaded:', uniqueIds.length);
}

// Filter tags functionality
function initializeFilterTags() {
    const filterTags = document.querySelectorAll('.category-btn');
    
    filterTags.forEach(tag => {
        tag.addEventListener('click', function() {
            // If clicking the active tag, toggle to all
            const clickedValue = this.textContent.trim();
            const isSame = activeCategoryFilter && activeCategoryFilter.toLowerCase() === clickedValue.toLowerCase();

            // Remove active state from all and then set only the selected one (or none when toggled)
            filterTags.forEach(t => t.classList.remove('active'));
            if (!isSame) {
                this.classList.add('active');
                activeCategoryFilter = clickedValue;
            } else {
                activeCategoryFilter = null;
            }

            const filterValue = activeCategoryFilter;
            console.log('Filtering by:', filterValue);

            // Animation feedback
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 100);

            filterJobsByCategory(filterValue);
        });
    });
}

// Apply filters (search input & category) and render job items
function renderJobs() {
    const container = document.getElementById('jobContainer');
    const updateTime = document.getElementById('updateTime');
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';

    if (!container) return;
    container.innerHTML = '';

    // Filter by search term first
    let jobsToRender = allJobs.filter(job =>
        (job.title || '').toLowerCase().includes(searchTerm) ||
        (job.company || '').toLowerCase().includes(searchTerm)
    );


    // If a category filter is active, match against the qualification field only
    if (activeCategoryFilter) {
        const categoryText = activeCategoryFilter.trim();

        // Try to map by exact category key (case-insensitive), otherwise fallback to categoryText
        const matchedKey = Object.keys(categoryKeywordsMap).find(k => k.toLowerCase() === categoryText.toLowerCase());
        const keywords = matchedKey ? categoryKeywordsMap[matchedKey].map(normalizeForMatch) : [normalizeForMatch(categoryText)];

        // Logging for debugging
        console.debug('[Filter] Category:', categoryText, 'Keywords:', keywords);

        jobsToRender = jobsToRender.filter(job => {
            const qualification = normalizeForMatch(job.qualification || '');
            const title = normalizeForMatch(job.title || '');
            // Find if any keyword is included in the qualification (respecting word boundaries)
            const matchedQualification = keywords.some(key => matchesKeyword(qualification, key));
            const matchedTitle = keywords.some(key => matchesKeyword(title, key));

            if (matchedQualification) return true;
            // Fallback to title if qualification didn't match
            if (matchedTitle) return true;

            return false;
        });

        console.debug('[Filter] Matched jobs count:', jobsToRender.length);
        if (jobsToRender.length === 0) {
            // Provide helpful debugging information (sample qualifications from all jobs)
            const sampleQuals = allJobs.slice(0, 5).map(j => ({id: j.id, qual: normalizeForMatch(j.qualification || '')}));
            console.info(`[Filter] No jobs matched category=${categoryText}; sample qualifications:`, sampleQuals);
        }
    }



    if (!jobsToRender || jobsToRender.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-inbox" style="font-size: 3rem; color: #ddd;"></i>
                <p class="mt-3 text-muted">No internship listings found.</p>
            </div>
        `;
        return;
    }

    jobsToRender.forEach(job => {
        const companyDomain = job.company.split(' ')[0].toLowerCase();
        const logoUrl = `https://logo.clearbit.com/${companyDomain}.com`;

        const item = document.createElement('div');
        item.className = 'job-item';
        // store qualification as data attribute to be able to use it later if needed
        item.dataset.qualification = job.qualification || '';
        item.innerHTML = `
            <button class="heart-bookmark-btn" data-job-id="${job.id}" data-job-title="${escapeHtml(job.title)}" aria-label="Bookmark job">
                <i class="bi bi-heart"></i>
            </button>
            <a href="${job.link}" target="_blank" class="job-link">
                <div class="job-card-wrapper">
                    <img src="${logoUrl}" 
                         alt="${job.company} Logo" 
                         class="job-logo"
                         onerror="this.src='https://cdn-icons-png.flaticon.com/512/847/847969.png'">
                </div>
                <div class="job-details flex-grow-1">
                    <h3>${escapeHtml(job.title)}</h3>
                    <p class="company-location">
                        <i class="bi bi-building"></i> ${escapeHtml(job.company)}
                    </p>
                    <p class="site">
                        <i class="bi bi-link-45deg"></i> ${escapeHtml(job.site)}
                    </p>
                </div>
            </a>
        `;

        container.appendChild(item);
    });

    initializeBookmarks();
    // Update timestamp
    if (updateTime) updateTime.innerHTML = `<i class="bi bi-arrow-clockwise"></i> Last updated: ${new Date().toLocaleTimeString()}`;
}

// Filter helper that sets activeCategoryFilter and re-renders
function filterJobsByCategory(filterValue) {
    if (!filterValue) {
        // Reset filter and show all
        activeCategoryFilter = null;
    } else {
        activeCategoryFilter = filterValue.trim();
    }
    renderJobs();
}

// Bottom navigation
function initializeBottomNav() {
    const navItems = document.querySelectorAll('.nav-icon:not(.add-btn)');
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // Don't prevent default for links
            if (!this.getAttribute('href').startsWith('#')) {
                return;
            }
            
            e.preventDefault();
            
            // Remove active class from all items
            navItems.forEach(i => i.classList.remove('active'));
            
            // Add active class to clicked item
            this.classList.add('active');
        });
    });
    
    // Add button functionality
    const addBtn = document.querySelector('.add-btn');
    if (addBtn) {
        addBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Add button clicked');
            
            // Animation
            this.style.transform = 'scale(0.9) rotate(90deg)';
            setTimeout(() => {
                this.style.transform = 'scale(1) rotate(0deg)';
            }, 200);
            
            // TODO: Open add job modal or navigate to add page
        });
    }
}

// Job card interactions
function initializeJobCards() {
    const jobItems = document.querySelectorAll('.job-item, .job-card');
    const featuredCards = document.querySelectorAll('.job-card');
    
    // Add hover effect analytics
    jobItems.forEach(item => {
        item.addEventListener('mouseenter', function() {
            console.log('Job hovered:', this.querySelector('h3')?.textContent);
        });
    });
    
    featuredCards.forEach(card => {
        card.addEventListener('click', function() {
            console.log('Featured job clicked:', this.querySelector('h3')?.textContent);
        });
    });
}

// Logout functionality
document.addEventListener("DOMContentLoaded", () => {
    const logoutBtn = document.getElementById('logoutBtn');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (!confirm("Are you sure you want to logout?")) return;

            try {
                const response = await fetch('/api/logout', {
                    method: 'POST',
                    credentials: 'include'
                });

                if (response.ok) {
                    // Clear local data
                    localStorage.removeItem('bookmarkedJobs');

                    // Redirect to login page
                    window.location.replace('/login.html');
                } else {
                    alert("Logout failed. Server returned an error.");
                }

            } catch (error) {
                console.error('Logout failed:', error);
                alert("Network error during logout.");
            }
        });
    }
});


// Authentication check (uncomment when ready)
async function checkAuth() {
    try {
        const response = await fetch('/api/me', {
            method: 'GET',
            credentials: 'include'
        });
        const data = await response.json();

        const currentPath = window.location.pathname;
        const isPublic = PUBLIC_PAGES.includes(currentPath);

        // If user is NOT logged in and the page is protected → redirect
        if (!data.loggedIn && !isPublic) {
            console.warn('Access denied. Redirecting to login...');
            window.location.replace('/login.html');
            return false;
        }

        // If user IS logged in and is on a public page (like login) → redirect to dashboard
        if (data.loggedIn && ['/login.html', '/register.html'].includes(currentPath)) {
            console.log('Already logged in → redirecting to dashboard');
            window.location.replace('/dashboard.html');
            return true;
        }

        // Update UI if logged in
        if (data.loggedIn) {
            const userGreeting = document.getElementById('userGreeting');
            if (userGreeting) {
                userGreeting.innerHTML = `
                    <h1 class="mb-0">Hello ${data.user.username || data.user.email}!</h1>
                    <p class="mb-0 text-white-50">Find your dream OJT</p>
                `;
            }
        }

        // generate initials of user
        // The header avatar is handled by updateHeaderProfilePic(); no need to duplicate
    

        return data.loggedIn;

    } catch (error) {
        console.error('Authentication check failed:', error);
        // Fail-safe: if on protected page & API fails → redirect
        const currentPath = window.location.pathname;
        if (!PUBLIC_PAGES.includes(currentPath)) {
            window.location.replace('/login.html');
        }
        return false;
    }
}


// Utility function: Debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Utility function: Escape HTML to prevent XSS
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Smooth scroll for horizontal scrolling sections
function initSmoothScroll() {
    const scrollContainers = document.querySelectorAll('.jobs-scroll, .category-scroll');
    
    scrollContainers.forEach(container => {
        let isDown = false;
        let startX;
        let scrollLeft;

        container.addEventListener('mousedown', (e) => {
            isDown = true;
            container.style.cursor = 'grabbing';
            startX = e.pageX - container.offsetLeft;
            scrollLeft = container.scrollLeft;
        });

        container.addEventListener('mouseleave', () => {
            isDown = false;
            container.style.cursor = 'grab';
        });

        container.addEventListener('mouseup', () => {
            isDown = false;
            container.style.cursor = 'grab';
        });

        container.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - container.offsetLeft;
            const walk = (x - startX) * 2;
            container.scrollLeft = scrollLeft - walk;
        });
    });
}
function getColorForName(name) {
    const hash = [...name].reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return avatarColors[hash % avatarColors.length];
}

// Initialize smooth scroll
initSmoothScroll();

// Listen for localStorage changes from other tabs/windows and sync heart states
window.addEventListener('storage', (e) => {
    try {
        if (e.key !== 'bookmarkedJobs' && e.key !== 'userProfile') return;

        const newBookmarks = JSON.parse(e.newValue || '[]');

        // Update all heart buttons to match the new storage state
        document.querySelectorAll('.heart-bookmark-btn').forEach(btn => {
            const jobId = btn.dataset.jobId;
            const icon = btn.querySelector('i');

            if (!jobId || !icon) return;

            if (newBookmarks.includes(jobId)) {
                btn.classList.add('bookmarked');
                icon.classList.remove('bi-heart');
                icon.classList.add('bi-heart-fill');
            } else {
                btn.classList.remove('bookmarked');
                icon.classList.remove('bi-heart-fill');
                icon.classList.add('bi-heart');
            }
        });
        // If profile changed in another tab, update header avatar
        if (e.key === 'userProfile') {
            try {
                const profile = JSON.parse(e.newValue || '{}');
                const profilePicContainer = document.getElementById('profilePicContainer');
                if (!profilePicContainer) return;
                if (profile.profilePicture) {
                    profilePicContainer.innerHTML = `<img src="${profile.profilePicture}" alt="Profile" class="profile-pic-img">`;
                    profilePicContainer.style.cursor = 'pointer';
                    profilePicContainer.onclick = function() { window.location.href = 'user-profile.html'; };
                } else {
                    checkAuth().catch(() => {});
                }
            } catch (pe) { console.error('Failed to parse userProfile storage event', pe); }
        }
    } catch (err) {
        console.error('Error syncing bookmarks from storage event:', err);
    }
});