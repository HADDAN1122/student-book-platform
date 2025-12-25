// auth.js - WORKING VERSION WITH FIRESTORE
console.log("📡 Loading auth.js...");

// Debug: Check if Firebase services are loaded
console.log("Checking Firebase services...");
console.log("auth exists:", typeof auth !== 'undefined');
console.log("db exists:", typeof db !== 'undefined');
console.log("firebase exists:", typeof firebase !== 'undefined');

// Get current user
function getCurrentUser() {
    if (typeof auth === 'undefined') {
        console.error("getCurrentUser: auth not defined");
        return null;
    }
    return auth.currentUser;
}

// Check if user is logged in
function isLoggedIn() {
    const user = getCurrentUser();
    return !!user;
}

// Require login for protected pages
function requireLogin(redirectTo = "login.html") {
    if (!isLoggedIn()) {
        alert("🔐 Please login to access this page.");
        window.location.href = redirectTo;
        return false;
    }
    return true;
}

// REAL Signup with Firebase Auth + Firestore
async function signupUser(email, password, userData) {
    console.log("🚀 Starting signup for:", email);
    
    try {
        // 1. CREATE AUTH ACCOUNT
        console.log("Step 1: Creating Firebase Auth account...");
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        console.log("✅ Auth account created! User ID:", user.uid);
        
        // 2. GENERATE EMOJI NUMBER (0 for man, 1 for woman)
        // Use email hash for consistency
        let hash = 0;
        for (let i = 0; i < email.length; i++) {
            hash = email.charCodeAt(i) + ((hash << 5) - hash);
        }
        const emojiNumber = Math.abs(hash) % 2; // 0 or 1
        const emoji = emojiNumber === 0 ? "👨" : "👩";
        const gender = emojiNumber === 0 ? "male" : "female";
        
        console.log("🎭 Assigned emoji:", emoji, "(Number:", emojiNumber + ")");
        
        // 3. SAVE USER DATA TO FIRESTORE
        console.log("Step 2: Saving user data to Firestore...");
        const userDoc = {
            email: email,
            firstName: userData.firstName || "",
            lastName: userData.lastName || "",
            studentId: userData.studentId || "",
            emojiNumber: emojiNumber,
            gender: gender,
            emoji: emoji,
            createdAt: new Date(),
            lastLogin: new Date(),
            totalBooksListed: 0,
            profileComplete: false
        };
        
        await db.collection("users").doc(user.uid).set(userDoc);
        console.log("✅ User data saved to Firestore!");
        
        // 4. Send verification email (optional)
        await user.sendEmailVerification();
        console.log("✅ Verification email sent");
        
        // 5. Store emoji in localStorage for immediate use
        localStorage.setItem(`emoji_${user.uid}`, gender);
        
        return {
            success: true,
            user: user,
            emoji: emoji,
            emojiNumber: emojiNumber,
            message: `🎉 Account created successfully! Your avatar: ${emoji}`
        };
        
    } catch (error) {
        console.error("❌ Signup failed:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        
        // User-friendly error messages
        let friendlyError = error.message;
        if (error.code === 'auth/email-already-in-use') {
            friendlyError = "This email is already registered. Try logging in instead.";
        } else if (error.code === 'auth/weak-password') {
            friendlyError = "Password should be at least 6 characters.";
        } else if (error.code === 'auth/invalid-email') {
            friendlyError = "Please enter a valid email address.";
        }
        
        return {
            success: false,
            error: friendlyError,
            code: error.code
        };
    }
}

// REAL Login with Firebase
async function loginUser(email, password) {
    console.log("🔐 Attempting login for:", email);
    
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        console.log("✅ Login successful! User:", user.email);
        
        // Update last login time in Firestore
        try {
            await db.collection("users").doc(user.uid).update({
                lastLogin: new Date()
            });
            console.log("✅ Last login updated in Firestore");
        } catch (firestoreError) {
            console.warn("Note: Could not update Firestore (user document might not exist yet)");
        }
        
        return {
            success: true,
            user: user,
            message: "✅ Login successful!"
        };
        
    } catch (error) {
        console.error("❌ Login failed:", error);
        
        let friendlyError = error.message;
        if (error.code === 'auth/user-not-found') {
            friendlyError = "No account found with this email.";
        } else if (error.code === 'auth/wrong-password') {
            friendlyError = "Incorrect password. Try again.";
        } else if (error.code === 'auth/invalid-email') {
            friendlyError = "Please enter a valid email address.";
        } else if (error.code === 'auth/too-many-requests') {
            friendlyError = "Too many failed attempts. Try again later.";
        }
        
        return {
            success: false,
            error: friendlyError,
            code: error.code
        };
    }
}

// Logout function
async function logoutUser() {
    try {
        await auth.signOut();
        console.log("✅ Logout successful");
        // Don't alert here, let the UI handle it
    } catch (error) {
        console.error("Logout error:", error);
        alert("Logout error: " + error.message);
    }
}

// Test function for debugging
function testFirebaseConnection() {
    console.log("🧪 Testing Firebase connection...");
    console.log("1. Firebase app:", typeof firebase !== 'undefined' ? "✅ Loaded" : "❌ Missing");
    console.log("2. Auth service:", typeof auth !== 'undefined' ? "✅ Loaded" : "❌ Missing");
    console.log("3. Firestore service:", typeof db !== 'undefined' ? "✅ Loaded" : "❌ Missing");
    console.log("4. Current user:", getCurrentUser()?.email || "Not logged in");
    
    if (typeof auth !== 'undefined') {
        console.log("5. Auth methods:", Object.keys(auth).filter(k => typeof auth[k] === 'function'));
    }
    
    alert("Check browser console (F12) for test results");
}

// Export functions to global scope
window.getCurrentUser = getCurrentUser;
window.isLoggedIn = isLoggedIn;
window.requireLogin = requireLogin;
window.signupUser = signupUser;
window.loginUser = loginUser;
window.logoutUser = logoutUser;
window.testFirebaseConnection = testFirebaseConnection;

console.log("✅ auth.js fully loaded and ready!");