const PUBLIC_PAGES = [
    "/",
    "/login.html",
    "/register.html"
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
        const res = await fetch('/api/jobs');
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

            const item = document.createElement('a');
            item.href = job.link;
            item.target = '_blank';
            item.className = 'job-item';
            item.innerHTML = `
                <img src="${logoUrl}" 
                     alt="${job.company} Logo" 
                     class="job-logo"
                     onerror="this.src='https://cdn-icons-png.flaticon.com/512/847/847969.png'">
                <div class="job-details flex-grow-1">
                    <h3>${escapeHtml(job.title)}</h3>
                    <p class="company-location">
                        <i class="bi bi-building"></i> ${escapeHtml(job.company)}
                    </p>
                    <p class="site">
                        <i class="bi bi-link-45deg"></i> ${escapeHtml(job.site)}
                    </p>
                </div>
                <div class="bookmark-icon" data-job-id="${job.title}">
                    <i class="bi bi-bookmark"></i>
                </div>
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
    const bookmarks = document.querySelectorAll('.bookmark-icon, .bookmark-btn');
    
    bookmarks.forEach(bookmark => {
        // Remove existing listeners to avoid duplicates
        bookmark.replaceWith(bookmark.cloneNode(true));
    });
    
    // Re-query after cloning
    document.querySelectorAll('.bookmark-icon, .bookmark-btn').forEach(bookmark => {
        bookmark.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            this.classList.toggle('active');
            
            const icon = this.querySelector('i');
            if (icon) {
                if (icon.classList.contains('bi-bookmark')) {
                    icon.classList.remove('bi-bookmark');
                    icon.classList.add('bi-bookmark-fill');
                } else {
                    icon.classList.remove('bi-bookmark-fill');
                    icon.classList.add('bi-bookmark');
                }
            }
            
            // Animation
            this.style.transform = 'scale(1.3)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 200);
            
            // Save to localStorage
            const jobId = this.dataset.jobId;
            if (jobId) {
                toggleBookmark(jobId);
            }
        });
    });
    
    // Load saved bookmarks
    loadBookmarks();
}

// Toggle bookmark in localStorage
function toggleBookmark(jobId) {
    let bookmarks = JSON.parse(localStorage.getItem('bookmarkedJobs') || '[]');
    
    if (bookmarks.includes(jobId)) {
        bookmarks = bookmarks.filter(id => id !== jobId);
    } else {
        bookmarks.push(jobId);
    }
    
    localStorage.setItem('bookmarkedJobs', JSON.stringify(bookmarks));
}

// Load bookmarks from localStorage
function loadBookmarks() {
    const bookmarks = JSON.parse(localStorage.getItem('bookmarkedJobs') || '[]');
    
    bookmarks.forEach(jobId => {
        const bookmarkBtn = document.querySelector(`[data-job-id="${jobId}"]`);
        if (bookmarkBtn) {
            bookmarkBtn.classList.add('active');
            const icon = bookmarkBtn.querySelector('i');
            if (icon) {
                icon.classList.remove('bi-bookmark');
                icon.classList.add('bi-bookmark-fill');
            }
        }
    });
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

// Initialize smooth scroll
initSmoothScroll();