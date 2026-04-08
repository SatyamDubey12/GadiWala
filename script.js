// ==========================================
// 1. CONFIGURATION & STATE
// ==========================================
// IMPORTANT: Render URL update kiya gaya hai
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
        // Aapke JSON keys: 'vehicles', 'users', 'bookings'
        const [resV, resU, resB] = await Promise.all([
            fetch(`${API_URL}/vehicles`).then(r => r.json()),
            fetch(`${API_URL}/users`).then(r => r.json()),
            fetch(`${API_URL}/bookings`).then(r => r.ok ? r.json() : []).catch(() => [])
        ]);

        cars = resV; // Mapping 'vehicles' from JSON to 'cars' variable
        users = resU;
        bookings = resB;
        
        console.log("Sync Complete:", { cars: cars.length, users: users.length });
        
        updateNav();
        renderCars();
        
        if(activeUser?.role === 'user') renderUserDash();
        if(activeUser?.role === 'admin') renderAdminDash();
        
        fetchUserLocation();
    } catch(e) { 
        console.error("Connection Error:", e);
        const list = document.getElementById('car-list');
        if(list) list.innerHTML = `<div class="col-span-full text-center py-10">Server is waking up (Render Free Tier)... Please refresh in 20 seconds.</div>`;
    } finally { hideLoader(); }
}

// ==========================================
// 3. LOGIN & OTP LOGIC
// ==========================================
async function login() {
    const e = document.getElementById('l-email').value.trim().toLowerCase();
    const p = document.getElementById('l-pass').value.trim();
    if(!e || !p) return alert("Please fill all fields.");

    const userMatch = users.find(x => x.email.toLowerCase() === e && x.pass === p);
    
    if(userMatch) {
        // Login OTP Simulation
        generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
        alert(`Your Verification Code: ${generatedOtp}`);
        
        const userOtp = prompt("Enter 4-digit OTP sent to your device:");
        if(userOtp === generatedOtp) {
            activeUser = userMatch; 
            sessionStorage.setItem('activeUser', JSON.stringify(userMatch)); 
            location.reload(); 
        } else {
            alert("Invalid OTP!");
        }
    } else {
        alert("Invalid email or password.");
    }
}

// ==========================================
// 4. PAYMENT & BOOKING SUBMIT
// ==========================================
async function finalSubmit(payStatus) {
    const fileInput = document.getElementById('pay-screenshot');
    let screenshotBase64 = null;

    // Screenshot mandatory for UPI
    if (payStatus.includes('UPI') && (!fileInput || !fileInput.files[0])) {
        return alert("Please upload payment screenshot.");
    }

    if (fileInput && fileInput.files[0]) {
        screenshotBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(fileInput.files[0]);
        });
    }

    const data = { 
        ...tempBooking, 
        id: Date.now().toString(),
        payment: payStatus, 
        screenshot: screenshotBase64, 
        status: 'Pending', 
        date: new Date().toLocaleDateString() 
    };

    showLoader();
    try {
        const res = await fetch(`${API_URL}/bookings`, {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify(data)
        });
        if(res.ok) {
            alert("Booking Successful! Check Dashboard for status.");
            location.reload();
        }
    } catch(e) { alert("Booking failed. Server issue."); }
    finally { hideLoader(); }
}

// ==========================================
// 5. VEHICLE RENDERING (Search & City Filter)
// ==========================================
function renderCars() {
    const list = document.getElementById('car-list');
    if(!list) return;

    if(!cars || cars.length === 0) {
        list.innerHTML = `<p class="text-center col-span-full py-10">Searching for vehicles...</p>`;
        return;
    }

    const filtered = cars.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (c.city && c.city.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    list.innerHTML = filtered.map(c => {
        const isAvailable = c.status !== 'Not Available';
        return `
        <div class="car-card bg-white rounded-[30px] shadow-lg overflow-hidden border border-gray-100 transition hover:shadow-2xl">
            <div class="relative h-44 overflow-hidden">
                <img src="${c.img}" class="w-full h-full object-cover">
                <div class="absolute top-3 left-3 ${isAvailable ? 'bg-green-500' : 'bg-red-500'} text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase shadow-md">
                    ${isAvailable ? 'Available' : 'Booked'}
                </div>
                <div class="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] font-black">₹${c.price}/day</div>
            </div>
            <div class="p-5">
                <h4 class="text-lg font-black text-gray-800">${c.name}</h4>
                <p class="text-gray-400 text-xs mb-4 flex items-center gap-1">📍 ${c.city || 'Greater Noida'}</p>
                <button onclick="${isAvailable ? `initBooking('${c.id}')` : ''}" ${!isAvailable ? 'disabled' : ''} 
                    class="w-full py-3 rounded-2xl text-xs font-bold transition ${isAvailable ? 'bg-gray-900 text-white hover:bg-blue-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}">
                    ${isAvailable ? 'BOOK NOW' : 'NOT AVAILABLE'}
                </button>
            </div>
        </div>`;
    }).join('');
}

// Nav update function
function updateNav() {
    if(activeUser) {
        document.getElementById('nav-auth')?.classList.add('hidden');
        document.getElementById('nav-user')?.classList.remove('hidden');
        const nameDisplay = document.getElementById('user-name-nav');
        if(nameDisplay) nameDisplay.innerText = activeUser.name.split(' ')[0];
    }
}

// Search Handler
function handleSearch(val) {
    searchQuery = val;
    renderCars();
}

// Initialization
window.onload = loadAllData;