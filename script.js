// ==========================================
// 1. CONFIGURATION & STATE
// ==========================================
const API_URL = "https://gadiwala-1.onrender.com"; 
let cars = [], users = [], bookings = [];
let activeUser = JSON.parse(sessionStorage.getItem('activeUser')) || null;
let searchQuery = "", currentCity = "Greater Noida";
let generatedOtp = ""; 

// EmailJS Initialization
(function(){ emailjs.init("UBoCaMD4uz6NNv7" + "D"); })(); 

const showLoader = () => document.getElementById('loader')?.classList.remove('hidden');
const hideLoader = () => document.getElementById('loader')?.classList.add('hidden');

// ==========================================
// 2. DATA SYNC & INITIALIZATION
// ==========================================
async function loadAllData() {
    showLoader();
    try {
        const [resC, resU, resB] = await Promise.all([
            fetch(`${API_URL}/vehicles`).then(r => r.ok ? r.json() : []),
            fetch(`${API_URL}/users`).then(r => r.ok ? r.json() : []),
            fetch(`${API_URL}/bookings`).then(r => r.ok ? r.json() : [])
        ]);

        cars = Array.isArray(resC) ? resC : []; 
        users = Array.isArray(resU) ? resU : []; 
        bookings = Array.isArray(resB) ? resB : [];
        
        updateNav(); 
        renderCars();
        fetchUserLocation(); // Error fix: Ab ye defined hai
    } catch(e) { console.error("Sync Error:", e); }
    finally { hideLoader(); }
}

// ==========================================
// 3. OTP & AUTH SYSTEM (Old Features)
// ==========================================
async function startRegistration() {
    const e = document.getElementById('reg-e').value.trim();
    if(!e) return alert("Email empty!");
    generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    showLoader();
    try {
        await emailjs.send("service_8bkoyy9", "template_7diwc1a", { 
            email: e, passcode: `OTP: ${generatedOtp}` 
        });
        alert("OTP Sent!");
        document.getElementById('otp-section')?.classList.remove('hidden');
    } catch(err) { alert("Email Error"); }
    finally { hideLoader(); }
}

function updateNav() { 
    const loginBtn = document.getElementById('login-btn-nav'), logoutBtn = document.getElementById('logout-btn-nav');
    if (activeUser) {
        loginBtn?.classList.add('hidden'); logoutBtn?.classList.remove('hidden');
    } else {
        loginBtn?.classList.remove('hidden'); logoutBtn?.classList.add('hidden');
    }
}

// ==========================================
// 4. NEW FEATURES: SEARCH & LOCATION DELETE
// ==========================================
function handleSearch(event) {
    searchQuery = event.target.value.toLowerCase();
    renderCars();
}

async function fetchUserLocation() {
    if (sessionStorage.getItem('locationDeleted') === 'true') {
        updateLocationUI(currentCity); return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
            const data = await res.json();
            currentCity = data.address.city || data.address.town || "Greater Noida";
            updateLocationUI(currentCity);
        } catch(e) { updateLocationUI("Greater Noida"); }
    }, () => updateLocationUI("Greater Noida"));
}

function updateLocationUI(city) {
    const el = document.getElementById('loc-text');
    if(el) el.innerHTML = `📍 ${city} <button onclick="deleteLoc()" class="text-red-500 ml-1 underline">DEL</button>`;
}

function deleteLoc() {
    sessionStorage.setItem('locationDeleted', 'true');
    currentCity = "Greater Noida";
    updateLocationUI(currentCity);
}

// ==========================================
// 5. RENDER LOGIC
// ==========================================
function renderCars() {
    const list = document.getElementById('car-list');
    if(!list) return;
    const filtered = cars.filter(c => c.name.toLowerCase().includes(searchQuery));
    list.innerHTML = filtered.map(c => `
        <div class="bg-white p-4 rounded-3xl shadow-lg border">
            <img src="${c.img}" class="h-40 w-full object-cover rounded-2xl mb-4" onerror="this.src='https://via.placeholder.com/300x200'">
            <h4 class="font-bold text-lg">${c.name}</h4>
            <button onclick="initBooking('${c.id}')" class="w-full bg-black text-white py-2 mt-2 rounded-xl text-xs font-bold uppercase">Book Now</button>
        </div>`).join('');
}

async function initBooking(carId) {
    if (!activeUser) return alert("Bhai, pehle Login toh kar lo!");
    // Booking confirmation logic...
}

window.onload = loadAllData;