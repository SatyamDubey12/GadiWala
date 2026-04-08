// ==========================================
// 1. CONFIGURATION & STATE
// ==========================================
const API_URL = "https://gadiwala.onrender.com"; // Aapka Render Live URL
let cars = [], users = [], bookings = [];
let activeUser = JSON.parse(sessionStorage.getItem('activeUser')) || null;
let selectedRole = 'user', tempBooking = {}, searchQuery = "", currentCity = "", generatedOtp = "";

// Initialize EmailJS (Aapki Key)
(function(){ emailjs.init("UBoCaMD4uz6NNv7jD"); })();

const showLoader = () => document.getElementById('loader').classList.remove('hidden');
const hideLoader = () => document.getElementById('loader').classList.add('hidden');

// ==========================================
// 2. DATA SYNC (Backend connection)
// ==========================================
async function loadAllData() {
    showLoader();
    try {
        // Render endpoints se data fetch karna
        const [resC, resU, resB] = await Promise.all([
            fetch(`${API_URL}/cars`).catch(() => null),
            fetch(`${API_URL}/users`).catch(() => null),
            fetch(`${API_URL}/bookings`).catch(() => null)
        ]);

        if(!resC || !resU) throw new Error("Backend not responding.");

        cars = await resC.json();
        users = await resU.json();
        bookings = resB ? await resB.json() : [];
        
        updateNav();
        renderCars();
        
        if(activeUser?.role === 'user') renderUserDash();
        if(activeUser?.role === 'admin') renderAdminDash();
        
        fetchUserLocation(); // Auto-detect city
    } catch(e) { 
        console.error("Connection Error:", e);
        alert("Server is waking up. Please refresh in 30 seconds.");
    } finally { hideLoader(); }
}

// ==========================================
// 3. AUTHENTICATION (Login/Signup/OTP)
// ==========================================
async function login() {
    const e = document.getElementById('l-email').value.trim().toLowerCase();
    const p = document.getElementById('l-pass').value.trim();
    if(!e || !p) return alert("Please fill all fields.");

    const userMatch = users.find(x => x.email.toLowerCase() === e && x.pass === p && x.role === selectedRole);
    if(userMatch) { 
        activeUser = userMatch; 
        sessionStorage.setItem('activeUser', JSON.stringify(userMatch)); 
        location.reload(); 
    } else {
        alert("Invalid email or password.");
    }
}

async function startRegistration() {
    const n = document.getElementById('reg-n').value.trim();
    const e = document.getElementById('reg-e').value.trim().toLowerCase();
    const p = document.getElementById('reg-p').value.trim();

    if(!n || !e || !p) return alert("All fields required.");
    if(users.some(u => u.email.toLowerCase() === e)) return alert("Email already exists.");

    generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    showLoader();
    try {
        await emailjs.send("service_8bkoyy9", "template_7diwc1a", { 
            email: e, 
            passcode: `Your GadiWala OTP: ${generatedOtp}` 
        });
        alert("OTP sent to your email!");
        document.getElementById('otp-section').classList.remove('hidden');
    } catch(err) { alert("Failed to send OTP."); }
    finally { hideLoader(); }
}

async function verifyOtpAndRegister() {
    const userOtp = document.getElementById('reg-otp').value.trim();
    if(userOtp !== generatedOtp) return alert("Invalid OTP.");

    const newUser = { 
        id: Date.now().toString(), 
        name: document.getElementById('reg-n').value, 
        email: document.getElementById('reg-e').value.toLowerCase(), 
        pass: document.getElementById('reg-p').value, 
        role: 'user' 
    };

    showLoader();
    try {
        const res = await fetch(`${API_URL}/users`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(newUser)
        });
        if(res.ok) {
            alert("Success! Please login.");
            location.reload();
        }
    } catch(err) { alert("Registration failed."); }
    finally { hideLoader(); }
}

// ==========================================
// 4. VEHICLE DISPLAY & LOCATION
// ==========================================
function renderCars() {
    const list = document.getElementById('car-list');
    if(!cars.length) {
        list.innerHTML = `<p class="text-center col-span-full py-10">Connecting to server...</p>`;
        return;
    }

    const filtered = cars.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (c.city && c.city.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    list.innerHTML = filtered.map(c => {
        const isAvailable = c.status !== 'Not Available';
        return `
        <div class="car-card bg-white rounded-[30px] shadow-lg overflow-hidden border border-gray-100">
            <div class="relative h-44">
                <img src="${c.img}" class="w-full h-full object-cover">
                <div class="absolute top-3 left-3 ${isAvailable ? 'bg-green-500' : 'bg-red-500'} text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                    ${isAvailable ? 'Available' : 'Booked'}
                </div>
            </div>
            <div class="p-5">
                <h4 class="text-lg font-black">${c.name}</h4>
                <p class="text-gray-400 text-xs mb-4">📍 ${c.city || 'Greater Noida'}</p>
                <div class="flex justify-between items-center">
                    <span class="font-black text-blue-600">₹${c.price}/day</span>
                    <button onclick="${isAvailable ? `initBooking('${c.id}')` : ''}" ${!isAvailable ? 'disabled' : ''} 
                        class="px-4 py-2 rounded-xl text-xs font-bold ${isAvailable ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-400'}">
                        ${isAvailable ? 'Book Now' : 'Reserved'}
                    </button>
                </div>
            </div>
        </div>`;
    }).join('');
}

async function fetchUserLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
            const data = await res.json();
            const city = data.address.city || data.address.town || "Greater Noida";
            currentCity = city;
            document.getElementById('loc-text').innerHTML = `📍 Near <b>${city}</b>`;
        } catch(e) { console.log("Location error"); }
    });
}

// ==========================================
// 5. BOOKING ENGINE
// ==========================================
function initBooking(carId) {
    if(!activeUser) return showPage('auth');
    const car = cars.find(c => c.id == carId);
    tempBooking = { 
        carId: car.id, 
        carName: car.name, 
        pricePerDay: car.price, 
        userId: activeUser.id, 
        userName: activeUser.name 
    };
    document.getElementById('kyc-modal').classList.remove('hidden');
}

async function finalSubmit(payStatus) {
    const days = document.getElementById('booking-days').value || 1;
    const data = { 
        ...tempBooking, 
        days: parseInt(days),
        total: tempBooking.pricePerDay * days,
        payment: payStatus, 
        status: 'Pending', 
        date: new Date().toLocaleDateString() 
    };

    showLoader();
    try {
        const res = await fetch(`${API_URL}/bookings`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)
        });
        if(res.ok) {
            alert("Booking Request Sent!");
            location.reload();
        }
    } catch(e) { alert("Booking failed."); }
    finally { hideLoader(); }
}

// ==========================================
// 6. INITIALIZATION
// ==========================================
window.onload = loadAllData;

function updateNav() {
    if(activeUser) {
        document.getElementById('nav-auth').classList.add('hidden');
        document.getElementById('nav-user').classList.remove('hidden');
        document.getElementById('user-name-nav').innerText = activeUser.name.split(' ')[0];
    }
}

function logout() {
    sessionStorage.clear();
    location.reload();
}