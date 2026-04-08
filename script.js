// ==========================================
// 1. CONFIGURATION & STATE
// ==========================================
const API_URL = "https://gadiwala.onrender.com"; 
let cars = [], users = [], bookings = [];
let activeUser = JSON.parse(sessionStorage.getItem('activeUser')) || null;
let selectedRole = 'user', tempBooking = {}, searchQuery = "", currentCity = "";
let generatedOtp = "", forgotOtp = "", resetUserEmail = "";

// EmailJS Initialization
(function(){ emailjs.init("UBoCaMD4uz6NNv7jD"); })();

const showLoader = () => document.getElementById('loader')?.classList.remove('hidden');
const hideLoader = () => document.getElementById('loader')?.classList.add('hidden');

// ==========================================
// 2. DATA SYNC (Render Backend Connection)
// ==========================================
async function loadAllData() {
    showLoader();
    try {
        const [resC, resU, resB] = await Promise.all([
            fetch(`${API_URL}/cars`).then(r => r.json()),
            fetch(`${API_URL}/users`).then(r => r.json()),
            fetch(`${API_URL}/bookings`).then(r => r.ok ? r.json() : []).catch(() => [])
        ]);

        cars = resC; users = resU; bookings = resB;
        
        updateNav();
        renderCars();
        
        if(activeUser?.role === 'user') renderUserDash();
        if(activeUser?.role === 'admin') renderAdminDash();
        
        fetchUserLocation();
    } catch(e) { 
        console.error("Connection Error:", e);
        const list = document.getElementById('car-list');
        if(list) list.innerHTML = `<div class="col-span-full text-center py-10 font-bold text-orange-500">Server is waking up... Please refresh in 30 seconds.</div>`;
    } finally { hideLoader(); }
}

// ==========================================
// 3. AUTH & OTP FEATURES (EmailJS)
// ==========================================
async function startRegistration() {
    const e = document.getElementById('reg-e').value.trim();
    if(!e) return alert("Enter email");
    
    generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    showLoader();
    try {
        await emailjs.send("service_8bkoyy9", "template_7diwc1a", { 
            email: e, passcode: `GadiWala OTP: ${generatedOtp}` 
        });
        alert("OTP sent to your email!");
        document.getElementById('otp-section').classList.remove('hidden');
    } catch(err) { alert("Failed to send OTP."); }
    finally { hideLoader(); }
}

function login() {
    const e = document.getElementById('l-email').value.trim().toLowerCase();
    const p = document.getElementById('l-pass').value.trim();
    const userMatch = users.find(x => x.email.toLowerCase() === e && x.pass === p);
    
    if(userMatch) {
        activeUser = userMatch;
        sessionStorage.setItem('activeUser', JSON.stringify(userMatch));
        location.reload();
    } else { alert("Invalid credentials."); }
}

// ==========================================
// 4. LOCATION & SEARCH FEATURES
// ==========================================
async function fetchUserLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            const data = await res.json();
            currentCity = data.address.city || data.address.town || "Greater Noida";
            document.getElementById('loc-text').innerHTML = `📍 Location: <b>${currentCity}</b>`;
            renderCars();
        } catch(e) { console.warn("Location error"); }
    });
}

function handleSearch(val) {
    searchQuery = val;
    renderCars();
}

// ==========================================
// 5. BOOKING & PAYMENT (QR CODE)
// ==========================================
function initBooking(carId) {
    if(!activeUser) return alert("Please Login");
    const car = cars.find(c => c.id == carId);
    tempBooking = { carId: car.id, carName: car.name, price: car.price, userId: activeUser.id };
    
    const upiID = "satyamdubey7582@okicici"; 
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=${upiID}&pn=GadiWala&am=${car.price}&cu=INR`;
    document.getElementById('upi-qr').src = qrUrl;
    document.getElementById('pay-modal').classList.remove('hidden');
}

async function finalSubmit(payStatus) {
    const data = { 
        ...tempBooking, id: Date.now().toString(),
        payment: payStatus, status: 'Pending', date: new Date().toLocaleDateString() 
    };
    showLoader();
    try {
        await fetch(`${API_URL}/bookings`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)
        });
        alert("Booking Successful!");
        location.reload();
    } catch(e) { alert("Error"); }
    finally { hideLoader(); }
}

// ==========================================
// 6. ADMIN & USER DASHBOARDS
// ==========================================
function renderCars() {
    const list = document.getElementById('car-list');
    if(!list) return;
    const filtered = cars.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    list.innerHTML = filtered.map(c => `
        <div class="bg-white p-4 rounded-3xl shadow-lg border">
            <img src="${c.img}" class="h-40 w-full object-cover rounded-2xl mb-4">
            <h4 class="font-bold">${c.name}</h4>
            <p class="text-sm text-gray-500">₹${c.price}/day • ${c.city || 'Noida'}</p>
            <button onclick="initBooking('${c.id}')" class="w-full mt-4 bg-black text-white py-2 rounded-xl text-xs font-bold">
                BOOK NOW
            </button>
        </div>
    `).join('');
}

function renderAdminDash() {
    document.getElementById('a-fleet-list').innerHTML = cars.map(c => `
        <div class="flex justify-between p-3 border-b">
            <span>${c.name} (${c.status})</span>
            <button onclick="deleteCar('${c.id}')" class="text-red-500">🗑️</button>
        </div>
    `).join('');
}

function renderUserDash() {
    const myB = bookings.filter(b => b.userId === activeUser.id);
    document.getElementById('u-history').innerHTML = myB.map(b => `
        <tr class="border-b text-sm">
            <td class="p-3"><b>${b.carName}</b></td>
            <td class="p-3 text-blue-600">${b.status}</td>
        </tr>
    `).join('');
}

// Global Actions
const updateNav = () => { if(activeUser) document.getElementById('user-name-nav').innerText = activeUser.name; };
async function deleteCar(id) { await fetch(`${API_URL}/cars/${id}`, {method:'DELETE'}); loadAllData(); }

window.onload = loadAllData;