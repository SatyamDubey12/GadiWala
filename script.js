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
        renderUserDash(); 
    }
}

// ==========================================
// 3. LOGIN & AUTH SYSTEM (Key Changes Here)
// ==========================================
function login() {
    const e = document.getElementById('l-email').value.trim().toLowerCase();
    const p = document.getElementById('l-pass').value.trim();
    
    // Finding user in fetched data
    const userMatch = users.find(x => x.email.toLowerCase() === e && x.pass === p);
    
    if(userMatch) {
        activeUser = userMatch;
        sessionStorage.setItem('activeUser', JSON.stringify(userMatch));
        alert("Login Successful! Redirecting...");
        location.reload(); // Refresh to update Nav and Dashboard
    } else { 
        alert("Invalid Email or Password. Please try again."); 
    }
}

function logout() {
    if(confirm("Do you want to logout?")) {
        sessionStorage.removeItem('activeUser');
        location.reload();
    }
}

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

// ==========================================
// 4. BOOKING & LOGS
// ==========================================
async function initBooking(carId) {
    if (!activeUser) {
        alert("Please login first!"); // Fix for the alert in your image
        document.getElementById('login-modal')?.classList.remove('hidden');
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

        try {
            await fetch(`${API_URL}/bookings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newBooking)
            });
            alert("Booking Saved!");
            location.reload();
        } catch (e) { alert("Error saving booking."); }
    }
}

// ==========================================
// 5. UI RENDERING
// ==========================================
function renderCars() {
    const list = document.getElementById('car-list');
    if(!list) return;
    list.innerHTML = cars.map(c => `
        <div class="bg-white p-4 rounded-3xl shadow-lg border">
            <img src="${c.img}" class="h-40 w-full object-cover rounded-2xl mb-4">
            <h4 class="font-bold text-lg">${c.name}</h4>
            <p class="text-xs text-gray-500">₹${c.price}/day • ${c.city}</p>
            <button onclick="initBooking('${c.id}')" class="w-full mt-4 bg-black text-white py-2 rounded-xl text-xs font-bold uppercase">Book Now</button>
        </div>
    `).join('');
}

function renderUserDash() {
    const hist = document.getElementById('u-history');
    if(hist) {
        const myBookings = bookings.filter(b => b.userId === activeUser.id);
        hist.innerHTML = myBookings.map(b => `
            <tr class="border-b">
                <td class="p-3 text-sm">${b.carName}</td>
                <td class="p-3 text-sm font-bold text-green-600">${b.status}</td>
            </tr>
        `).join('') || "<tr><td colspan='2' class='p-3 text-center'>No active bookings.</td></tr>";
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

// ... (Other functions like fetchUserLocation, addCar, deleteCar stay same)

window.onload = loadAllData;