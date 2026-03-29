



// ================= FIREBASE IMPORTS =================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    GithubAuthProvider,
    sendPasswordResetEmail,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
    getDatabase,
    ref,
    set,
    get
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";


// ================= FIREBASE CONFIG =================

const firebaseConfig = {
apiKey: "AIzaSyBWA-zRkPFH4svRjkMUO80TUdI9zIm5ICc",
authDomain: "phantom-messaging-a5bf0.firebaseapp.com",
databaseURL: "https://phantom-messaging-a5bf0-default-rtdb.firebaseio.com",
projectId: "phantom-messaging-a5bf0",
storageBucket: "phantom-messaging-a5bf0.firebasestorage.app",
messagingSenderId: "475147330421",
appId: "1:475147330421:web:6fe73f781a9dbf443ca93c",
measurementId: "G-1974SDM4VW"
};


// ================= INIT =================

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);


// ================= PROVIDERS =================

const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();


// ================= GLOBAL =================

const SESSION_KEY = "gold_hub_session";

let currentUser = null;




// ================= SESSION =================

function saveSession(user, profile) {

    const session = {
        uid: user.uid,
        username: profile.username,
        email: user.email,
        lastLogin: Date.now()
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

function getSession() {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
}


// ================= AUTO LOGIN =================

window.addEventListener("load", () => {

    const session = getSession();

    if (!session) return;

    showWelcomeBack(session);
});


function showWelcomeBack(session) {

    const landing = document.getElementById("auth-landing");

    if (!landing) return;

    landing.innerHTML = `
        <h2 class="text-2xl font-black mb-4">Welcome Back</h2>
        <p class="text-gold font-bold mb-8">${session.username}</p>

        <button class="btn-gold mb-4" onclick="continueSession()">
            Continue as ${session.username}
        </button>

        <button class="btn-outline" onclick="switchAccount()">
            Switch Account
        </button>
    `;
}


function continueSession() {

    const session = getSession();

    if (!session) {
        clearSession();
        location.reload();
        return;
    }

    onAuthStateChanged(auth, async (user) => {

        // Not logged in anymore
        if (!user) {
            clearSession();
            location.reload();
            return;
        }

        // UID mismatch = fake session
        if (user.uid !== session.uid) {
            clearSession();
            await signOut(auth);
            location.reload();
            return;
        }

        // Optional: verify profile exists
        const snap = await getDoc(doc(db, "users", user.uid));

        if (!snap.exists()) {
            clearSession();
            location.reload();
            return;
        }

        // All checks passed
        const profileSnap = await getDoc(doc(db, "users", user.uid));

if (!profileSnap.exists()) {
    openFinishProfile(user);
    return;
}

const profile = profileSnap.data();

if (!isProfileComplete(profile)) {
    openFinishProfile(user);
    return;
}

window.location.href = "index.html";
    });
}


function switchAccount() {

    clearSession();

    signOut(auth).then(() => {
        location.reload();
    });
}


// ================= LOGIN =================

async function loginWithEmail(email, password) {

    try {

        const result = await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        const user = result.user;

        // 🔹 Get profile directly by UID
        const snap = await get(
            ref(rtdb, "global_users/" + user.uid)
        );

        if (!snap.exists()) {
            throw new Error("Profile not found. Please re-register.");
        }

        const profile = snap.val();

        // ✅ Save session
        saveSession(user, profile);

        // Continue login
        await postLogin(user);

    } catch (err) {

        console.error(err);
        alert(err.message);
    }
}


// ================= SIGNUP =================

async function createAccount(data) {

    try {

        const res = await createUserWithEmailAndPassword(
            auth,
            data.email,
            data.password
        );

        const user = res.user;

        const profile = {
            email: data.email,
            username: data.username,
            dob: data.dob,
            vaultKey: data.vaultKey,
            recoveryPattern: data.recoveryPattern,
            authMethod: "password",
            createdAt: serverTimestamp()
        };

        // Firestore
        await setDoc(doc(db, "users", user.uid), profile);

        // Realtime DB (FIXED)
        await set(ref(rtdb, "global_users/" + user.uid), {
            username: data.username,
            email: data.email,
            dob: data.dob,
            createdAt: Date.now()
        });

        saveSession(user, profile);

        redirect();

    } catch (err) {
        alert(err.message);
    }
}

// ================= OAUTH =================

async function oauthLogin(providerName) {

    let provider;

    if (providerName === "Google") provider = googleProvider;
    if (providerName === "GitHub") provider = githubProvider;

    try {

        const result = await signInWithPopup(auth, provider);

        const user = result.user;

        const snap = await getDoc(doc(db, "users", user.uid));

        if (!snap.exists()) {

            openFinishProfile(user);

        } else {

            saveSession(user, snap.data());
            redirect();
        }

    } catch (err) {

        alert(err.message);
    }
}


// ================= FINISH PROFILE =================

let tempProfile = {};
let oauthPattern = [];

function openFinishProfile(user) {

    tempProfile = {
        uid: user.uid,
        email: user.email
    };

    showStep1();
}

function showStep1() {

    const content = document.getElementById("panel-content");

    content.innerHTML = `
        <div class="step-layer">

            <h2 class="text-2xl font-black mb-6">Step 1: Identity</h2>

            <div class="input-group">
                <label>Username</label>
                <input id="fp-user" class="input-field">
            </div>

            <div class="input-group">
                <label>Date of Birth</label>
                <input type="date" id="fp-dob" class="input-field">
            </div>

            <button class="btn-gold" onclick="finishStep1()">
                Continue
            </button>

        </div>
    `;
}

function finishStep1() {

    const user = document.getElementById("fp-user").value;
    const dob = document.getElementById("fp-dob").value;

    if (!user || !dob) {
        alert("Fill all fields");
        return;
    }

    tempProfile.username = user;
    tempProfile.dob = dob;

    showStep2();
}

function showStep2() {

    const vault = generateVaultKey();

    tempProfile.vaultKey = vault;

    const content = document.getElementById("panel-content");

    content.innerHTML = `
        <div class="step-layer">

            <h2 class="text-2xl font-black mb-6">Step 2: Vault Key</h2>

            <p class="text-sm mb-4">
                Save this key safely. You cannot recover without it.
            </p>

            <div class="input-field mb-6 text-center font-mono">
                ${vault}
            </div>

            <button class="btn-gold" onclick="showStep3()">
                I Saved It
            </button>

        </div>
    `;
}


function generateVaultKey() {

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let key = "";

    for (let i = 0; i < 16; i++) {
        key += chars[Math.floor(Math.random() * chars.length)];
    }

    return key.match(/.{1,4}/g).join("-");
}

function showStep3() {
    // Local state for this specific instance of the step
    
    const colors = ["red", "green", "blue"];
    const content = document.getElementById("panel-content");

    // 1. Inject the HTML Structure
    content.innerHTML = `
        <div class="step-layer">
            <h2 class="text-2xl font-black mb-4">
                Step 3: Recovery Pattern
            </h2>
            <p class="text-sm mb-4 text-center">
                Select: Red → Green → Blue
            </p>
            <div class="recovery-grid">
                ${Array(9).fill(0).map((_, i) =>
                    `<div class="grid-box" data-i="${i}"></div>`
                ).join("")}
            </div>
            <button 
                id="final-btn"
                class="btn-gold mt-6"
                disabled
                style="opacity:.5">
                Complete Setup
            </button>
        </div>
    `;

    // 2. Grab references after they are added to the DOM
    const boxes = content.querySelectorAll(".grid-box");
    const finalBtn = document.getElementById("final-btn");

    // 3. Define the click logic inside the main function
    boxes.forEach(box => {
        box.addEventListener("click", function() {
            const i = this.getAttribute("data-i");

            // Stop after 3 or if already selected
            if (oauthPattern.length >= 3 || this.classList.contains("selected")) return;

            // Apply color and class
            this.style.background = colors[oauthPattern.length];
            this.classList.add("selected");

            // Store index
            oauthPattern.push(i);
            console.log("Pattern:", oauthPattern);

            // Enable button logic
            if (oauthPattern.length === 3) {
                if (finalBtn) {
                    finalBtn.disabled = false;
                    finalBtn.style.opacity = "1";
                    // Attach the finalization call
                    finalBtn.onclick = () => finalizeOAuth();
                    
                }
            }
        });
    });
}




async function finalizeOAuth() {

if (oauthPattern.length !== 3) {
    alert("Please complete the recovery pattern");
    return;
}

    const user = auth.currentUser;

    if (!user) return;

    const profile = {
        email: user.email,
        username: tempProfile.username,
        dob: tempProfile.dob,
        vaultKey: tempProfile.vaultKey,
        recoveryPattern: oauthPattern,
        authMethod: "oauth",
        createdAt: serverTimestamp()
    };

    try {

        await setDoc(doc(db, "users", user.uid), profile);

        await set(ref(rtdb, "global_users/" + user.uid), {
    username: profile.username,
    email: user.email,
    dob: profile.dob,
    createdAt: Date.now()
});

        saveSession(user, profile);

        redirect();

    } catch (err) {

        alert(err.message);
    }
}


// ================= RECOVERY =================

async function recoverAccount(email, username, dob, vaultKey, pattern) {
    try {
        const q = query(
            collection(db, "users"),
            where("email", "==", email)
        );

        const snap = await getDocs(q);

        // 1. Check if Email exists
        if (snap.empty) {
            showRecoveryError(
                "Account Not Found", 
                "The email address entered does not exist in our secure database. Please verify the address or register a new vault."
            );
            return;
        }

        const data = snap.docs[0].data();

        // 2. Check Username
        if (data.username !== username) {
            showRecoveryError(
                "Metadata Mismatch", 
                "The email exists, but the **System Username** provided does not match the records for this account."
            );
            return;
        }

        // 3. Check Date of Birth
        if (data.dob !== dob) {
            showRecoveryError(
                "Metadata Mismatch", 
                "The email exists, but the **Date of Birth** parameters provided are incorrect."
            );
            return;
        }

        // 4. Check Vault Key
        if (data.vaultKey !== vaultKey) {
            showRecoveryError(
                "Security Key Invalid", 
                "The email is valid, but the **Emergency Recovery Key** entered is incorrect. Handshake denied."
            );
            return;
        }

        // 5. Check Pattern
        if (JSON.stringify(data.recoveryPattern) !== JSON.stringify(pattern)) {
            showRecoveryError(
                "Grade Pattern Invalid", 
                "Verification failed at the final stage: The **Visual Recovery Grade** sequence is incorrect."
            );
            return;
        }

        // Success - Trigger Firebase Reset
        try {
    await sendPasswordResetEmail(auth, email);
    console.log("Reset email sent successfully");
    showRecoverySuccess(email);
} catch (e) {
    console.error("Reset Error:", e.code, e.message);
    showRecoveryError("Reset Failed", e.message);
}

    } catch (err) {
        showRecoveryError("System Exception", err.message);
    }
}

// Function to close the recovery panel
function closeRecoveryPanel() {
    document.body.classList.remove("panel-active");
    // Clear the content for security
    document.getElementById("panel-content").innerHTML = "";
}

function showRecoverySuccess(email) {
    const content = document.getElementById('panel-content');
    content.innerHTML = `
        <div class="step-layer text-center">
            <div class="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mb-6 mx-auto">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
            </div>
            <h2 class="text-2xl font-black mb-4">Handshake Successful</h2>
            <div class="bg-black/40 border border-white/5 p-6 rounded-3xl mb-8">
                <p class="text-gray-400 text-sm leading-relaxed">
                    Identity confirmed. Firebase has <span class="text-emerald-400 font-bold">authorized</span> the credential reset. 
                    An official link has been dispatched to <span class="text-white font-medium">${email}</span>.
                </p>
            </div>
            <button class="btn-gold" onclick="closeRecoveryPanel()">I Understand</button>
        </div>
    `;
}

function showRecoveryError(title, message) {
    const content = document.getElementById('panel-content');
    content.innerHTML = `
        <div class="step-layer text-center">
            <div class="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mb-6 mx-auto">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
            </div>
            <h2 class="text-2xl font-black mb-4">${title}</h2>
            <div class="bg-black/40 border border-white/5 p-6 rounded-3xl mb-8">
                <p class="text-gray-400 text-sm leading-relaxed">
                    ${message}
                </p>
                <p class="text-[10px] text-gray-500 mt-4 uppercase tracking-widest">
                    Verification Protocol Terminated
                </p>
            </div>
            <button class="btn-gold" onclick="closeRecoveryPanel()">I Understand</button>
        </div>
    `;
}



// ================= POST LOGIN =================

async function postLogin(user) {

    const snap = await getDoc(doc(db, "users", user.uid));

    // No profile at all
    if (!snap.exists()) {
        openFinishProfile(user);
        return;
    }

    const profile = snap.data();

    // Incomplete profile
    if (!isProfileComplete(profile)) {
        openFinishProfile(user);
        return;
    }

    // Valid profile
    saveSession(user, profile);

    redirect();
}


// ================= REDIRECT =================

function redirect() {

    const session = getSession();

    if (session) {
        session.lastLogin = Date.now();
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }

    window.location.href = "index.html";
}


// ================= HELPERS =================

function handleLogin() {

    const email = document.querySelector('input[type="email"]').value;
    const pass = document.querySelector('input[type="password"]').value;

    loginWithEmail(email, pass);
}


function handleRegister() { 

    createAccount(registrationData);
}


function handleRecovery(e) {

    if (e) e.stopPropagation();

    const email = document.getElementById("rec-email").value.trim();
    const user  = document.getElementById("rec-user").value.trim();
    const dob   = document.getElementById("rec-dob").value;
    const vault = document.getElementById("rec-vault").value.trim();

    if (!email || !user || !dob || !vault) {
        alert("Please fill all recovery fields");
        return;
    }

    if (!recoveryPattern || recoveryPattern.length < 3) {
        alert("Please complete the pattern");
        return;
    }

    recoverAccount(email, user, dob, vault, recoveryPattern);
}







function isProfileComplete(profile) {

    if (!profile) return false;

    if (!profile.username) return false;
    if (!profile.dob) return false;
    if (!profile.vaultKey) return false;

    return true;
}


// ================= EXPOSE TO HTML =================

window.firebaseLogin = loginWithEmail;
window.firebaseSignup = createAccount;
window.firebaseOAuth = oauthLogin;
window.firebaseRecover = recoverAccount;

window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleRecovery = handleRecovery;
window.recoverAccount = recoverAccount;
// ================= EXPOSE AUTO LOGIN FUNCTIONS =================

window.continueSession = continueSession;
window.switchAccount = switchAccount;

window.finishStep1 = finishStep1;
window.showStep3 = showStep3;
window.selectBox = 
window.finalizeOAuth = finalizeOAuth;
window.openFinishProfile = openFinishProfile;
