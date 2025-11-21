// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Bookmark functionality
    initializeBookmarks();
    
    // Filter tags functionality
    initializeFilterTags();
    
    // Bottom navigation
    initializeBottomNav();
    
    // Search functionality
    initializeSearch();
    
    // Job card interactions
    initializeJobCards();
}

// Bookmark functionality
function initializeBookmarks() {
    const bookmarks = document.querySelectorAll('.bookmark, .bookmark-icon');
    
    bookmarks.forEach(bookmark => {
        bookmark.addEventListener('click', function(e) {
            e.stopPropagation();
            this.classList.toggle('active');
            
            // Change icon from outline to solid
            if (this.classList.contains('far')) {
                this.classList.remove('far');
                this.classList.add('fas');
            } else if (this.classList.contains('fas') && !this.classList.contains('bookmark-icon')) {
                this.classList.remove('fas');
                this.classList.add('far');
            }
            
            // Add animation
            this.style.transform = 'scale(1.3)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 200);
        });
    });
}

// Filter tags functionality
function initializeFilterTags() {
    const filterTags = document.querySelectorAll('.filter-tag');
    
    filterTags.forEach(tag => {
        tag.addEventListener('click', function() {
            // Remove active class from all tags
            filterTags.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tag
            this.classList.add('active');
            
            // Here you would typically filter the job list
            const filterValue = this.textContent;
            console.log('Filtering by:', filterValue);
            
            // Add visual feedback
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 100);
        });
    });
}

// Bottom navigation
function initializeBottomNav() {
    const navItems = document.querySelectorAll('.nav-item:not(.add-btn)');
    
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            // Remove active class from all items
            navItems.forEach(i => i.classList.remove('active'));
            
            // Add active class to clicked item
            this.classList.add('active');
            
            console.log('Navigated to:', this.querySelector('i').className);
        });
    });
    
    // Add button functionality
    const addBtn = document.querySelector('.add-btn');
    addBtn.addEventListener('click', function() {
        console.log('Add button clicked');
        // Add animation
        this.style.transform = 'scale(0.9) rotate(90deg)';
        setTimeout(() => {
            this.style.transform = 'scale(1) rotate(0deg)';
        }, 200);
    });
}

// Search functionality
function initializeSearch() {
    const searchInput = document.querySelector('.search-box input');
    const filterBtn = document.querySelector('.filter-btn');
    
    searchInput.addEventListener('input', function() {
        const searchValue = this.value.toLowerCase();
        console.log('Searching for:', searchValue);
        
        // Here you would typically filter the job list
        if (searchValue.length > 0) {
            filterJobs(searchValue);
        } else {
            showAllJobs();
        }
    });
    
    filterBtn.addEventListener('click', function() {
        console.log('Filter button clicked');
        // Here you would open a filter modal
        this.style.transform = 'scale(0.9)';
        setTimeout(() => {
            this.style.transform = 'scale(1)';
        }, 100);
    });
}

// Job card interactions
function initializeJobCards() {
    const jobItems = document.querySelectorAll('.job-item');
    const featuredCards = document.querySelectorAll('.job-card');
    
    // Job items click
    jobItems.forEach(item => {
        item.addEventListener('click', function() {
            const jobTitle = this.querySelector('h6').textContent;
            console.log('Job clicked:', jobTitle);
            // Here you would navigate to job details
        });
    });
    
    // Featured cards click
    featuredCards.forEach(card => {
        card.addEventListener('click', function() {
            const jobTitle = this.querySelector('.job-title').textContent;
            console.log('Featured job clicked:', jobTitle);
            // Here you would navigate to job details
        });
    });
}

// Filter jobs based on search
function filterJobs(searchTerm) {
    const jobItems = document.querySelectorAll('.job-item');
    
    jobItems.forEach(item => {
        const jobTitle = item.querySelector('h6').textContent.toLowerCase();
        const company = item.querySelector('p').textContent.toLowerCase();
        
        if (jobTitle.includes(searchTerm) || company.includes(searchTerm)) {
            item.style.display = 'flex';
            item.style.opacity = '0';
            setTimeout(() => {
                item.style.opacity = '1';
            }, 10);
        } else {
            item.style.display = 'none';
        }
    });
}

// Show all jobs
function showAllJobs() {
    const jobItems = document.querySelectorAll('.job-item');
    jobItems.forEach(item => {
        item.style.display = 'flex';
        item.style.opacity = '1';
    });
}

// Smooth scroll for featured cards
const featuredCardsContainer = document.querySelector('.featured-cards');
if (featuredCardsContainer) {
    let isDown = false;
    let startX;
    let scrollLeft;

    featuredCardsContainer.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.pageX - featuredCardsContainer.offsetLeft;
        scrollLeft = featuredCardsContainer.scrollLeft;
    });

    featuredCardsContainer.addEventListener('mouseleave', () => {
        isDown = false;
    });

    featuredCardsContainer.addEventListener('mouseup', () => {
        isDown = false;
    });

    featuredCardsContainer.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - featuredCardsContainer.offsetLeft;
        const walk = (x - startX) * 2;
        featuredCardsContainer.scrollLeft = scrollLeft - walk;
    });
}

// Add notification badge functionality
function addNotificationBadge() {
    const notificationIcon = document.querySelector('.notification-icon');
    if (notificationIcon) {
        notificationIcon.addEventListener('click', function() {
            console.log('Notifications clicked');
            // Here you would show notifications
        });
    }
}

addNotificationBadge();

// Profile picture click
const profilePic = document.querySelector('.profile-pic');
if (profilePic) {
    profilePic.addEventListener('click', function() {
        console.log('Profile clicked');
        // Here you would navigate to profile page
    });
}