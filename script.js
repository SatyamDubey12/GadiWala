// ==========================================
// 1. CONFIGURATION & STATE
// ==========================================
const API_URL = "https://gadiwala-1.onrender.com"; 
let cars = [], users = [], bookings = [];
let activeUser = JSON.parse(sessionStorage.getItem('activeUser')) || null;
let searchQuery = "", currentCity = "Greater Noida";
let generatedOtp = "", forgotOtp = "", resetUserEmail = "";

// EmailJS Initialization
(function(){ emailjs.init("UBoCaMD4uz6NNv7" + "D"); })(); // Replace with your actual ID if needed

const showLoader = () => document.getElementById('loader')?.classList.remove('hidden');
const hideLoader = () => document.getElementById('loader')?.classList.add('hidden');

// ==========================================
// 2. DATA SYNC & DASHBOARD LOGIC
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

function renderDashboards() {
    const adminSec = document.getElementById('admin-dashboard');
    const userSec = document.getElementById('user-dashboard');
    const carListSec = document.getElementById('car-list-section');

    if (activeUser?.role === 'admin') {
        adminSec?.classList.remove('hidden');
        userSec?.classList.add('hidden');
        carListSec?.classList.add('hidden'); 
        renderAdminDash();
    } else if (activeUser?.role === 'user') {
        adminSec?.classList.add('hidden');
        userSec?.classList.remove('hidden');
        renderUserDash(); // This triggers the Log System
    }
}

// ==========================================
// 3. AUTH, OTP & FORGOT PASSWORD
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
    } catch(err) { 
        alert("Email Service Error"); 
    } finally { 
        hideLoader(); 
    }
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
    } catch(e) { 
        alert("Registration failed on server."); 
    }
}

async function sendResetOtp() {
    const email = document.getElementById('forgot-email').value.trim();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if(!user) return alert("Email not registered!");
    
    resetUserEmail = email;
    forgotOtp = Math.floor(100000 + Math.random() * 900000).toString();
    
    try {
        await emailjs.send("service_8bkoyy9", "template_7diwc1a", { 
            email: email, 
            passcode: `Your Reset Code: ${forgotOtp}` 
        });
        alert("Reset code sent!");
        document.getElementById('reset-section').classList.remove('hidden');
    } catch(e) { 
        alert("Error sending reset email."); 
    }
}

async function resetPassword() {
    const otp = document.getElementById('reset-otp').value;
    const pass = document.getElementById('new-pass').value;
    if(otp !== forgotOtp) return alert("Invalid OTP!");
    
    const user = users.find(u => u.email === resetUserEmail);
    await fetch(`${API_URL}/users/${user.id}`, { 
        method: 'PATCH', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({pass})
    });
    alert("Password updated successfully!");
    location.reload();
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
// 4. BOOKING SYSTEM (Log System Core)
// ==========================================
async function initBooking(carId) {
    if (!activeUser) {
        alert("Please login to book a vehicle!");
        document.getElementById('login-modal')?.classList.remove('hidden');
        return;
    }

    const car = cars.find(c => c.id === carId);
    if (!car) return alert("Vehicle not found!");

    if (confirm(`Book ${car.name} for ₹${car.price}/day?`)) {
        const newBooking = {
            id: Date.now().toString(),
            userId: activeUser.id,
            carId: car.id,
            carName: car.name,
            userName: activeUser.name,
            status: "Confirmed", // Setting to confirmed for logs
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
                alert("Booking Successful! View your logs in Dashboard.");
                location.reload();
            } else { 
                alert("Server error during booking."); 
            }
        } catch (e) { 
            alert("Network Error."); 
        } finally { 
            hideLoader(); 
        }
    }
}

// ==========================================
// 5. LOCATION & ADMIN TOOLS
// ==========================================
async function fetchUserLocation() {
    if (!navigator.geolocation || sessionStorage.getItem('locationDeleted')) return updateLocationUI(currentCity);
    navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
            const data = await res.json();
            currentCity = data.address.city || data.address.town || "Greater Noida";
            updateLocationUI(currentCity);
        } catch(e) { 
            updateLocationUI("Greater Noida"); 
        }
    });
}

function updateLocationUI(city) {
    const el = document.getElementById('loc-text');
    if(el) el.innerHTML = `📍 ${city} <button onclick="deleteLoc()" class="text-red-500 ml-2">✖</button>`;
}

function deleteLoc() {
    sessionStorage.setItem('locationDeleted', 'true');
    currentCity = "Greater Noida";
    updateLocationUI(currentCity);
}

async function addCar() {
    const name = document.getElementById('new-car-name').value;
    const price = document.getElementById('new-car-price').value;
    const img = document.getElementById('new-car-img').value;
    if(!name || !price || !img) return alert("Please fill all details!");

    const newCar = { id: Date.now().toString(), name, price: parseInt(price), img, status: "Available", city: currentCity };
    await fetch(`${API_URL}/vehicles`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(newCar)});
    location.reload();
}

async function deleteCar(id) {
    if(confirm("Delete this vehicle?")) {
        await fetch(`${API_URL}/vehicles/${id}`, { method: 'DELETE' });
        location.reload();
    }
}

// ==========================================
// 6. UI RENDERING (English)
// ==========================================
function renderCars() {
    const list = document.getElementById('car-list');
    if(!list) return;
    list.innerHTML = cars.map(c => `
        <div class="bg-white p-4 rounded-3xl shadow-lg border">
            <img src="${c.img}" class="h-40 w-full object-cover rounded-2xl mb-4">
            <h4 class="font-bold text-lg">${c.name}</h4>
            <p class="text-xs text-gray-500">₹${c.price}/day • ${c.city}</p>
            <button onclick="initBooking('${c.id}')" class="w-full mt-4 bg-black text-white py-2 rounded-xl text-xs font-bold uppercase tracking-wider">Book Now</button>
        </div>
    `).join('');
}

function renderAdminDash() {
    const fleet = document.getElementById('a-fleet-list');
    if(fleet) fleet.innerHTML = cars.map(c => `
        <div class="p-3 border-b flex justify-between items-center bg-gray-50 mb-2 rounded-xl">
            <span class="font-medium">${c.name}</span>
            <button onclick="deleteCar('${c.id}')" class="text-red-500 font-bold text-xs">DELETE</button>
        </div>
    `).join('');
}

function renderUserDash() {
    const hist = document.getElementById('u-history');
    if(hist) {
        const myBookings = bookings.filter(b => b.userId === activeUser.id);
        if(myBookings.length === 0) {
            hist.innerHTML = `<tr><td colspan="2" class="p-4 text-center text-gray-400">No logs found.</td></tr>`;
            return;
        }
        hist.innerHTML = myBookings.map(b => `
            <tr class="border-b">
                <td class="p-3 text-sm font-medium">${b.carName}</td>
                <td class="p-3 text-sm text-green-600 font-bold">${b.status}</td>
            </tr>
        `).join('');
    }
}

const updateNav = () => { 
    if(activeUser) {
        const navName = document.getElementById('user-name-nav');
        if(navName) navName.innerText = activeUser.name;
        document.getElementById('login-btn-nav')?.classList.add('hidden');
        document.getElementById('logout-btn-nav')?.classList.remove('hidden');
    }
};

window.onload = loadAllData;