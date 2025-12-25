// firebase.js - CORRECTED & CLEAN VERSION
console.log("Loading Firebase...");

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAK2hgIqBl1Dpbgrq4RYmj1scfu_gjzI1Q",
  authDomain: "studentbookplatform.firebaseapp.com",
  projectId: "studentbookplatform",
  storageBucket: "studentbookplatform.firebasestorage.app",
  messagingSenderId: "605449876682",
  appId: "1:605449876682:web:d8d2f9fe7d9eab3f49f033"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);

// Initialize ALL services
const db = firebase.firestore();
const auth = firebase.auth();      // Authentication
const storage = firebase.storage(); // For future images

console.log("✅ Firebase services ready!");

// Make globally available (ONLY ONCE!)
window.db = db;
window.auth = auth;
window.storage = storage;
window.firebaseApp = app;

// Auth state observer (runs when login/logout happens)
auth.onAuthStateChanged((user) => {
  console.log("Auth state changed:", user ? `Logged in as ${user.email}` : "Not logged in");
  updateAuthUI(user);
});

// Function to update UI based on auth state
function updateAuthUI(user) {
  const loginElements = document.querySelectorAll('.login-circle, .login-btn, .auth-status');
  
  loginElements.forEach(element => {
    if (user) {
      // User is logged in
      if (element.classList.contains('login-circle')) {
        element.textContent = `👤 ${user.email.split('@')[0]}`;
        element.href = "#";
        element.onclick = () => {
          if (confirm(`Logged in as: ${user.email}\n\nLogout?`)) {
            auth.signOut();
          }
        };
      }
    } else {
      // User is logged out
      if (element.classList.contains('login-circle')) {
        element.textContent = "Login";
        element.href = "login.html";
        element.onclick = null;
      }
    }
  });
}

// firebase.js - Add after updateAuthUI function

// Function to get user emoji based on assigned number
function getUserEmoji(user) {
    if (!user) return "";
    
    // Try to get stored emoji number from localStorage first
    const storedEmoji = localStorage.getItem(`emoji_${user.uid}`);
    if (storedEmoji) {
        return storedEmoji === "male" ? "👨" : "👩";
    }
    
    // If not in localStorage, generate based on email hash
    const email = user.email || "";
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
        hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Convert to 0 or 1
    const emojiNumber = Math.abs(hash) % 2;
    const emoji = emojiNumber === 0 ? "👨" : "👩";
    
    // Store for future use
    localStorage.setItem(`emoji_${user.uid}`, emojiNumber === 0 ? "male" : "female");
    
    return emoji;
}

// Update the updateAuthUI function to include emoji
function updateAuthUI(user) {
    const loginElements = document.querySelectorAll('.login-circle, .login-btn, .auth-status');
    
    loginElements.forEach(element => {
        if (user) {
            // User is logged in
            if (element.classList.contains('login-circle')) {
                const emoji = getUserEmoji(user);
                const userName = user.displayName || user.email.split('@')[0];
                
                // Set dark background for contrast
                element.style.background = '#2d2d2d';
                element.style.color = 'white';
                element.innerHTML = `
                    <span class="user-emoji">${emoji}</span>
                    <span class="user-name">${userName.substring(0, 8)}${userName.length > 8 ? '...' : ''}</span>
                `;
                element.href = "#";
                element.onclick = (e) => {
                    e.preventDefault();
                    showUserMenu(user, emoji);
                };
            }
        } else {
            // User is logged out
            if (element.classList.contains('login-circle')) {
                element.innerHTML = "Login";
                element.style.background = '';
                element.style.color = '';
                element.href = "login.html";
                element.onclick = null;
            }
        }
    });
}

// User menu dropdown
function showUserMenu(user, emoji) {
    // Remove any existing menu
    const existingMenu = document.querySelector('.user-dropdown-menu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }
    
    const menu = document.createElement('div');
    menu.className = 'user-dropdown-menu';
    menu.innerHTML = `
        <div class="user-menu-header">
            <div class="user-emoji-large">${emoji}</div>
            <div class="user-info">
                <div class="user-email">${user.email}</div>
                <div class="user-id">ID: ${user.uid.substring(0, 8)}...</div>
            </div>
        </div>
        <div class="menu-divider"></div>
        <a href="profile.html" class="menu-item">
            <span class="menu-icon">👤</span> My Profile
        </a>
        <a href="my-books.html" class="menu-item">
            <span class="menu-icon">📚</span> My Books
        </a>
        <a href="settings.html" class="menu-item">
            <span class="menu-icon">⚙️</span> Settings
        </a>
        <div class="menu-divider"></div>
        <button class="menu-item logout-btn">
            <span class="menu-icon">🚪</span> Logout
        </button>
        <div class="emoji-info">
            <small>Your emoji: ${emoji} (assigned at signup)</small>
        </div>
    `;
    
    // Position menu near login circle
    const loginCircle = document.querySelector('.login-circle');
    const rect = loginCircle.getBoundingClientRect();
    menu.style.position = 'absolute';
    menu.style.top = (rect.bottom + 10) + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
    
    document.body.appendChild(menu);
    
    // Add click listeners
    menu.querySelector('.logout-btn').addEventListener('click', () => {
        auth.signOut();
        menu.remove();
    });
    
    // Close menu when clicking outside
    setTimeout(() => {
        const closeMenu = (e) => {
            if (!menu.contains(e.target) && !loginCircle.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        document.addEventListener('click', closeMenu);
    }, 100);
}