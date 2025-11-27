// Load user data when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadUserProfile();
    setupPhotoUpload();
});

// Load existing profile data from server/localStorage
async function loadUserProfile() {
    try {
        // Try to load from server first
        const res = await fetch('/api/profile', { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            const userData = data.profile;
            const preferences = data.preferences;

            // Personal Information
            if (userData.first_name !== undefined && userData.first_name !== null) document.getElementById('firstName').value = userData.first_name;
            if (userData.middle_name !== undefined && userData.middle_name !== null) document.getElementById('middleName').value = userData.middle_name;
            if (userData.last_name !== undefined && userData.last_name !== null) document.getElementById('lastName').value = userData.last_name;
            if (userData.date_of_birth !== undefined && userData.date_of_birth !== null) {
                // MySQL DATE columns return as YYYY-MM-DD strings
                // If it has a 'T', it's ISO format, so extract date part
                let dateStr = userData.date_of_birth;
                if (dateStr.includes('T')) {
                    dateStr = dateStr.split('T')[0];
                }
                console.log('Setting dateOfBirth to:', dateStr);
                document.getElementById('dateOfBirth').value = dateStr;
            }
            if (userData.gender !== undefined && userData.gender !== null) document.getElementById('gender').value = userData.gender;
            if (userData.address !== undefined && userData.address !== null) document.getElementById('address').value = userData.address;
            if (userData.contact_number !== undefined && userData.contact_number !== null) document.getElementById('contactNumber').value = userData.contact_number;
            if (userData.email) document.getElementById('email').value = userData.email;
            if (userData.course_year !== undefined && userData.course_year !== null) document.getElementById('courseYear').value = userData.course_year;

            // Internship Preferences
            if (preferences.preferred_industry !== undefined && preferences.preferred_industry !== null) document.getElementById('preferredIndustry').value = preferences.preferred_industry;
            if (preferences.preferred_role !== undefined && preferences.preferred_role !== null) document.getElementById('preferredRole').value = preferences.preferred_role;
            if (preferences.work_arrangement !== undefined && preferences.work_arrangement !== null) document.getElementById('workArrangement').value = preferences.work_arrangement;
            if (preferences.min_stipend !== undefined && preferences.min_stipend !== null) document.getElementById('minStipend').value = preferences.min_stipend;

            // Load profile picture
            if (userData.profile_picture) {
                displayProfilePicture(userData.profile_picture);
                // Update localStorage with the picture
                const storedProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
                storedProfile.profilePicture = userData.profile_picture;
                localStorage.setItem('userProfile', JSON.stringify(storedProfile));
            } else {
                // Clear profile picture if user has none and remove any stored picture
                const profilePicLarge = document.getElementById('profilePicLarge');
                if (profilePicLarge) {
                    profilePicLarge.innerHTML = '<i class="bi bi-person"></i>';
                }
                try {
                    const storedProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
                    if (storedProfile.profilePicture) {
                        storedProfile.profilePicture = null;
                        localStorage.setItem('userProfile', JSON.stringify(storedProfile));
                    }
                } catch (e) {
                    // ignore JSON parse errors
                }
            }
            return;
        }
    } catch (err) {
        console.warn('Could not load from server, using localStorage:', err);
    }

    // Fallback to localStorage
    const userData = JSON.parse(localStorage.getItem('userProfile')) || {};
    
    // Personal Information (only load if localStorage has these values)
    if (userData.firstName) document.getElementById('firstName').value = userData.firstName;
    if (userData.middleName) document.getElementById('middleName').value = userData.middleName;
    if (userData.lastName) document.getElementById('lastName').value = userData.lastName;
    if (userData.dateOfBirth) document.getElementById('dateOfBirth').value = userData.dateOfBirth;
    if (userData.gender) document.getElementById('gender').value = userData.gender;
    if (userData.address) document.getElementById('address').value = userData.address;
    if (userData.contactNumber) document.getElementById('contactNumber').value = userData.contactNumber;
    if (userData.courseYear) document.getElementById('courseYear').value = userData.courseYear;

    // Internship Preferences (only load if localStorage has these values)
    if (userData.preferredIndustry) document.getElementById('preferredIndustry').value = userData.preferredIndustry;
    if (userData.preferredRole) document.getElementById('preferredRole').value = userData.preferredRole;
    if (userData.workArrangement) document.getElementById('workArrangement').value = userData.workArrangement;
    if (userData.minStipend) document.getElementById('minStipend').value = userData.minStipend;
    
    // Load profile picture
    if (userData.profilePicture) {
        displayProfilePicture(userData.profilePicture);
    }
}

// Setup photo upload functionality
function setupPhotoUpload() {
    const photoInput = document.getElementById('photoInput');
    
    photoInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        
        if (file) {
            // Check file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert('File size must be less than 5MB');
                return;
            }
            
            // Check file type
            if (!file.type.startsWith('image/')) {
                alert('Please select an image file');
                return;
            }
            
            const reader = new FileReader();
            
            reader.onload = function(event) {
                const imageData = event.target.result;
                displayProfilePicture(imageData);
                
                // Save to localStorage temporarily
                const userData = JSON.parse(localStorage.getItem('userProfile')) || {};
                userData.profilePicture = imageData;
                localStorage.setItem('userProfile', JSON.stringify(userData));
            };
            
            reader.readAsDataURL(file);
        }
    });
}

// Display profile picture
function displayProfilePicture(imageData) {
    const profilePicLarge = document.getElementById('profilePicLarge');
    if (!profilePicLarge) return;
    profilePicLarge.innerHTML = '';
    const img = document.createElement('img');
    img.alt = 'Profile Picture';
    img.src = imageData;
    img.onerror = function() {
        profilePicLarge.innerHTML = '<i class="bi bi-person"></i>';
    };
    profilePicLarge.appendChild(img);
}

// Handle form submission
document.getElementById('profileForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Get profile picture from localStorage or null
    const storedProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    const profilePicture = storedProfile.profilePicture || null;
    
    // Collect form data
    const userData = {
        firstName: document.getElementById('firstName').value.trim(),
        middleName: document.getElementById('middleName').value.trim(),
        lastName: document.getElementById('lastName').value.trim(),
        dateOfBirth: document.getElementById('dateOfBirth').value,
        gender: document.getElementById('gender').value,
        address: document.getElementById('address').value.trim(),
        contactNumber: document.getElementById('contactNumber').value.trim(),
        courseYear: document.getElementById('courseYear').value.trim(),
        preferredIndustry: document.getElementById('preferredIndustry').value.trim(),
        preferredRole: document.getElementById('preferredRole').value.trim(),
        workArrangement: document.getElementById('workArrangement').value,
        minStipend: document.getElementById('minStipend').value || 0,
        profilePicture: profilePicture
    };

    console.log('Submitting profile data:', userData);

    try {
        // Try to save to server first (if logged in)
        const res = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                firstName: userData.firstName,
                middleName: userData.middleName,
                lastName: userData.lastName,
                dateOfBirth: userData.dateOfBirth,
                gender: userData.gender,
                address: userData.address,
                contactNumber: userData.contactNumber,
                courseYear: userData.courseYear,
                preferredIndustry: userData.preferredIndustry,
                preferredRole: userData.preferredRole,
                workArrangement: userData.workArrangement,
                minStipend: userData.minStipend,
                profilePicture: userData.profilePicture
            })
        });

        const responseText = await res.text();
        console.log('Server response:', responseText);

        if (res.ok) {
            console.log('Profile saved to server');
        } else if (res.status === 401) {
            console.warn('Not logged in, will save to localStorage only');
        } else {
            console.error('Server error:', res.status);
        }
    } catch (err) {
        console.warn('Could not save to server:', err);
    }

    // Also save to localStorage as fallback
    localStorage.setItem('userProfile', JSON.stringify(userData));
    
    // Show success message
    showSuccessMessage();
    
    // Redirect to index after a short delay
    setTimeout(function() {
        window.location.href = 'index.html';
    }, 1500);
});

// Show success message
function showSuccessMessage() {
    // Create success message element
    let successMsg = document.querySelector('.success-message');
    
    if (!successMsg) {
        successMsg = document.createElement('div');
        successMsg.className = 'success-message';
        successMsg.innerHTML = '<i class="bi bi-check-circle-fill"></i> Profile updated successfully!';
        document.body.appendChild(successMsg);
    }
    
    successMsg.classList.add('show');
    
    setTimeout(function() {
        successMsg.classList.remove('show');
    }, 3000);
}

// Get user initials for profile picture placeholder
function getUserInitials() {
    const userData = JSON.parse(localStorage.getItem('userProfile')) || {};
    const firstName = userData.firstName || '';
    const lastName = userData.lastName || '';
    
    if (firstName && lastName) {
        return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
    }
    return '';
}

// Update profile picture with initials if no image
window.addEventListener('load', function() {
    const userData = JSON.parse(localStorage.getItem('userProfile')) || {};
    const profilePicLarge = document.getElementById('profilePicLarge');
    
    if (!userData.profilePicture) {
        const initials = getUserInitials();
        if (initials) {
            profilePicLarge.innerHTML = initials;
            profilePicLarge.style.fontSize = '48px';
            profilePicLarge.style.fontWeight = '600';
        }
    }
});