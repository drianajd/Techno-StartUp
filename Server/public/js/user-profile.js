// Load user data when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadUserProfile();
    setupPhotoUpload();
});

// Load existing profile data from localStorage
function loadUserProfile() {
    const userData = JSON.parse(localStorage.getItem('userProfile')) || {};
    
    // Personal Information
    document.getElementById('firstName').value = userData.firstName || '';
    document.getElementById('middleName').value = userData.middleName || '';
    document.getElementById('lastName').value = userData.lastName || '';
    document.getElementById('dateOfBirth').value = userData.dateOfBirth || '';
    document.getElementById('gender').value = userData.gender || '';
    document.getElementById('address').value = userData.address || '';
    document.getElementById('contactNumber').value = userData.contactNumber || '';
    document.getElementById('email').value = userData.email || '';
    document.getElementById('courseYear').value = userData.courseYear || '';
    
    // Emergency Contact
    document.getElementById('emergencyName').value = userData.emergencyName || '';
    document.getElementById('emergencyRelationship').value = userData.emergencyRelationship || '';
    document.getElementById('emergencyAddress').value = userData.emergencyAddress || '';
    document.getElementById('emergencyContact').value = userData.emergencyContact || '';
    
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
    profilePicLarge.innerHTML = `<img src="${imageData}" alt="Profile Picture">`;
}

// Handle form submission
document.getElementById('profileForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Collect form data
    const userData = {
        firstName: document.getElementById('firstName').value.trim(),
        middleName: document.getElementById('middleName').value.trim(),
        lastName: document.getElementById('lastName').value.trim(),
        dateOfBirth: document.getElementById('dateOfBirth').value,
        gender: document.getElementById('gender').value,
        address: document.getElementById('address').value.trim(),
        contactNumber: document.getElementById('contactNumber').value.trim(),
        email: document.getElementById('email').value.trim(),
        courseYear: document.getElementById('courseYear').value.trim(),
        emergencyName: document.getElementById('emergencyName').value.trim(),
        emergencyRelationship: document.getElementById('emergencyRelationship').value.trim(),
        emergencyAddress: document.getElementById('emergencyAddress').value.trim(),
        emergencyContact: document.getElementById('emergencyContact').value.trim(),
        profilePicture: JSON.parse(localStorage.getItem('userProfile') || '{}').profilePicture || null
    };
    
    // Save to localStorage
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