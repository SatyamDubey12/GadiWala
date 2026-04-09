// ==========================================
// 1. CONFIGURATION & STATE
// ==========================================
const API_URL = "https://gadiwala-1.onrender.com"; 
let cars = [], users = [], bookings = [];
let activeUser = JSON.parse(sessionStorage.getItem('activeUser')) || null;
let searchQuery = "", currentCity = "Greater Noida";
let generatedOtp = "", forgotOtp = "", resetUserEmail = "";

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
        renderDashboards();
        fetchUserLocation();
    } catch(e) { 
        console.error("Sync Error:", e); 
    } finally { 
        hideLoader(); 
    }
}

// ==========================================
// 3. LOGIN & NAV SYSTEM (Visibility Fix)
// ==========================================
function updateNav() { 
    const loginBtn = document.getElementById('login-btn-nav');
    const logoutBtn = document.getElementById('logout-btn-nav');
    const navName = document.getElementById('user-name-nav');

    if (activeUser) {
        if (navName) navName.innerText = `Hi, ${activeUser.name}`;
        loginBtn?.classList.add('hidden');
        logoutBtn?.classList.remove('hidden');
    } else {
        if (navName) navName.innerText = "";
        loginBtn?.classList.remove('hidden');
        logoutBtn?.classList.add('hidden');
    }
}

function login() {
    const e = document.getElementById('l-email').value.trim().toLowerCase();
    const p = document.getElementById('l-pass').value.trim();
    const userMatch = users.find(x => x.email.toLowerCase() === e && x.pass === p);
    
    if(userMatch) {
        activeUser = userMatch;
        sessionStorage.setItem('activeUser', JSON.stringify(userMatch));
        location.reload();
    } else { 
        alert("Invalid Email or Password"); 
    }
}

function logout() {
    sessionStorage.removeItem('activeUser');
    location.reload();
}

// ==========================================
// 4. OTP REGISTRATION & FORGOT PASSWORD
// ==========================================
async function startRegistration() {
    const e = document.getElementById('reg-e').value.trim();
    if(!e) return alert("Email is empty!");
    generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    showLoader();
    try {
        await emailjs.send("service_8bkoyy9", "template_7diwc1a", { 
            email: e, 
            passcode: `Your GadiWala OTP is: ${generatedOtp}` 
        });
        alert("OTP Sent to your email!");
        document.getElementById('otp-section').classList.remove('hidden');
    } catch(err) { alert("Email Service Error"); }
    finally { hideLoader(); }
}

async function completeRegistration() {
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-e').value;
    const pass = document.getElementById('reg-p').value;
    const inputOtp = document.getElementById('reg-otp').value;

    if(inputOtp !== generatedOtp) return alert("Incorrect OTP!");

    const newUser = { id: Date.now().toString(), name, email, pass, role: "user" };
    try {
        await fetch(`${API_URL}/users`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify(newUser)
        });
        alert("Registration Successful! Please Login.");
        location.reload();
    } catch(e) { alert("Registration failed."); }
}

// ==========================================
// 5. SEARCH & LOCATION SYSTEM (With Deletion)
// ==========================================
function handleSearch(event) {
    searchQuery = event.target.value.toLowerCase();
    renderCars();
}

async function fetchUserLocation() {
    if (!navigator.geolocation || sessionStorage.getItem('locationDeleted') === 'true') {
        updateLocationUI(currentCity);
        return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
            const data = await res.json();
            currentCity = data.address.city || data.address.town || "Greater Noida";
            updateLocationUI(currentCity);
        } catch(e) { updateLocationUI("Greater Noida"); }
    });
}

function updateLocationUI(city) {
    const el = document.getElementById('loc-text');
    if(el) {
        el.innerHTML = `📍 ${city} <button onclick="deleteLoc()" class="text-red-500 ml-2 text-xs font-bold">REMOVE</button>`;
    }
}

function deleteLoc() {
    sessionStorage.setItem('locationDeleted', 'true');
    currentCity = "Greater Noida";
    updateLocationUI(currentCity);
}

// ==========================================
// 6. BOOKING SYSTEM (Fixed initBooking Error)
// ==========================================
async function initBooking(carId) {
    if (!activeUser) {
        alert("Bhai, pehle Login toh kar lo!");
        return;
    }

    const car = cars.find(c => c.id === carId);
    if (!car) return;

    if (confirm(`Confirm booking for ${car.name}?`)) {
        const newBooking = {
            id: Date.now().toString(),
            userId: activeUser.id,
            carName: car.name,
            status: "Confirmed",
            date: new Date().toLocaleString()
        };

        showLoader();
        try {
            const res = await fetch(`${API_URL}/bookings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newBooking)
            });
            if (res.ok) {
                alert("Booking Successful!");
                location.reload();
            }
        } catch (e) { alert("Server error."); }
        finally { hideLoader(); }
    }
}

// ==========================================
// 7. UI RENDERING & DASHBOARDS
// ==========================================
function renderCars() {
    const list = document.getElementById('car-list');
    if(!list) return;

    const filtered = cars.filter(c => 
        c.name.toLowerCase().includes(searchQuery) || 
        c.city.toLowerCase().includes(searchQuery)
    );

    list.innerHTML = filtered.map(c => `
        <div class="bg-white p-4 rounded-3xl shadow-lg border">
            <img src="${c.img}" class="h-40 w-full object-cover rounded-2xl mb-4" onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
            <h4 class="font-bold text-lg">${c.name}</h4>
            <p class="text-xs text-gray-500 mb-4">₹${c.price}/day • ${c.city}</p>
            <button onclick="initBooking('${c.id}')" class="w-full bg-black text-white py-2 rounded-xl text-xs font-bold uppercase">Book Now</button>
        </div>
    `).join('') || `<div class="col-span-full text-center py-10">No results found.</div>`;
}

function renderDashboards() {
    const adminSec = document.getElementById('admin-dashboard');
    const userSec = document.getElementById('user-dashboard');
    const carListSec = document.getElementById('car-list-section');

    if (activeUser?.role === 'admin') {
        adminSec?.classList.remove('hidden');
        userSec?.classList.add('hidden');
        carListSec?.classList.add('hidden'); 
    } else if (activeUser?.role === 'user') {
        adminSec?.classList.add('hidden');
        userSec?.classList.remove('hidden');
        renderUserDash();
    }
}

function renderUserDash() {
    const hist = document.getElementById('u-history');
    if(hist) {
        const myLogs = bookings.filter(b => b.userId === activeUser.id);
        hist.innerHTML = myLogs.map(b => `
            <tr class="border-b">
                <td class="p-3 text-sm font-medium">${b.carName}</td>
                <td class="p-3 text-sm text-green-600 font-bold">${b.status}</td>
            </tr>
        `).join('') || "<tr><td colspan='2' class='p-3 text-center'>No bookings yet.</td></tr>";
    }
}

window.onload = loadAllData;