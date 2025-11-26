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
}

// Load jobs from API
async function loadJobs() {
    const container = document.getElementById('jobContainer');
    const updateTime = document.getElementById('updateTime');
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';

    // Show loading state
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
        const data = await res.json();
        const jobs = data.jobs || [];
        
        container.innerHTML = '';

        // Filter jobs based on search term
        const filtered = jobs.filter(job =>
            job.title.toLowerCase().includes(searchTerm) ||
            job.company.toLowerCase().includes(searchTerm)
        );

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5">
                    <i class="bi bi-inbox" style="font-size: 3rem; color: #ddd;"></i>
                    <p class="mt-3 text-muted">No internship listings found.</p>
                </div>
            `;
            return;
        }

        // Create job items
        filtered.forEach(job => {
            const companyDomain = job.company.split(' ')[0].toLowerCase();
            const logoUrl = `https://logo.clearbit.com/${companyDomain}.com`;

            const item = document.createElement('div');
            item.className = 'job-item';
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

        // Re-initialize bookmark functionality for new items
        initializeBookmarks();
        
        // Update timestamp
        updateTime.innerHTML = `<i class="bi bi-arrow-clockwise"></i> Last updated: ${new Date().toLocaleTimeString()}`;
        
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
            // Remove active class from all tags
            filterTags.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tag
            this.classList.add('active');
            
            const filterValue = this.textContent;
            console.log('Filtering by:', filterValue);
            
            // Animation feedback
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 100);
            
            // TODO: Implement actual filtering logic
            // filterJobsByCategory(filterValue);
        });
    });
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
    const jobItems = document.querySelectorAll('.job-item');
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
        const profilePicContainer = document.getElementById("profilePicContainer");
        if (profilePicContainer) {
        const name = data.user.username || data.user.email || "U";
        const initials = name
            .split(" ")                
            .map(word => word[0])     
            .join("")                  
            .substring(0, 2)           
            .toUpperCase();

        const bgColor = getColorForName(name);
        profilePicContainer.innerHTML = `
            <div class="initials-avatar" style="background: ${bgColor};">
                ${initials}
            </div>
        `;
    }
    

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