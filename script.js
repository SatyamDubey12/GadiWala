// ==========================================
// 1. LIVE CONFIGURATION & STATE
// ==========================================
const API_URL = "https://gadiwala.onrender.com"; 
let cars = [], users = [], bookings = [];
let activeUser = JSON.parse(sessionStorage.getItem('activeUser')) || null;
let searchQuery = "", currentCity = "", generatedOtp = "";

// EmailJS Initialization
(function(){ emailjs.init("UBoCaMD4uz6NNv7jD"); })();

const showLoader = () => document.getElementById('loader')?.classList.remove('hidden');
const hideLoader = () => document.getElementById('loader')?.classList.add('hidden');

// ==========================================
// 2. DATA SYNC (Backend connection)
// ==========================================
async function loadAllData() {
    showLoader();
    try {
        // Aapke live backend ke resources: /cars aur /users
        const [resC, resU, resB] = await Promise.all([
            fetch(`${API_URL}/cars`).then(r => r.json()),
            fetch(`${API_URL}/users`).then(r => r.json()),
            fetch(`${API_URL}/bookings`).then(r => r.ok ? r.json() : []).catch(() => [])
        ]);

        cars = resC;
        users = resU;
        bookings = resB;
        
        console.log("Data Loaded Successfully from Render");
        
        updateNav();
        renderCars();
        fetchUserLocation();
    } catch(e) { 
        console.error("API Error:", e);
        const list = document.getElementById('car-list');
        if(list) {
            list.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500">
                Server is waking up... Please refresh in 20 seconds.
            </div>`;
        }
    } finally { hideLoader(); }
}

// ==========================================
// 3. VEHICLE RENDERING
// ==========================================
function renderCars() {
    const list = document.getElementById('car-list');
    if(!list) return;

    if(!cars.length) {
        list.innerHTML = `<p class="text-center col-span-full py-10">No vehicles found on server.</p>`;
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

// ==========================================
// 4. HELPERS & NAVIGATION
// ==========================================
function updateNav() {
    const navAuth = document.getElementById('nav-auth');
    const navUser = document.getElementById('nav-user');
    if(activeUser && navAuth && navUser) {
        navAuth.classList.add('hidden');
        navUser.classList.remove('hidden');
        const nameEl = document.getElementById('user-name-nav');
        if(nameEl) nameEl.innerText = activeUser.name.split(' ')[0];
    }
}

async function fetchUserLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
            const data = await res.json();
            const city = data.address.city || data.address.town || "Greater Noida";
            currentCity = city;
            const locEl = document.getElementById('loc-text');
            if(locEl) locEl.innerHTML = `📍 Near <b>${city}</b>`;
        } catch(e) { console.log("Location detection failed."); }
    });
}

function handleSearch(val) {
    searchQuery = val;
    renderCars();
}

// Initialization
window.onload = loadAllData;