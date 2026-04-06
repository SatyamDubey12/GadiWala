const API_URL = "http://localhost:3000"; 
let cars = [], users = [], bookings = [];
let activeUser = JSON.parse(sessionStorage.getItem('activeUser')) || null;
let selectedRole = 'user', tempBooking = {}, searchQuery = "";

let locationDetected = false;
let currentCity = "";
let userCoords = null;

// OTP Variables
let generatedOTP = null;
let resetEmail = "";
let tempRegUser = null; // To hold user data during registration OTP phase

(function(){ emailjs.init("UBoCaMD4uz6NNv7jD"); })();

// 1. GLOBAL SEARCH
function handleSearch() {
    searchQuery = document.getElementById('global-search').value.toLowerCase();
    renderCars(); 
}

// 2. LOCATION SERVICES
async function fetchUserLocation() {
    if (!activeUser || activeUser.role !== 'user') return;
    document.getElementById('location-bar').classList.remove('hidden');
    const locText = document.getElementById('loc-text');
    const locDot = document.getElementById('loc-dot');

    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            locationDetected = true;
            userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
                const data = await res.json();
                currentCity = data.address.city || data.address.town || data.address.village || "";
                locText.innerText = `Available vehicles in: ${currentCity || 'Your Location'}`;
                locDot.classList.replace('bg-yellow-400', 'bg-green-500');
            } catch (err) { 
                locText.innerText = "Location Verified (Offline Map Mode)"; 
                locDot.classList.replace('bg-yellow-400', 'bg-green-500');
            }
            locDot.classList.remove('animate-pulse');
            renderCars();
        },
        () => {
            locationDetected = false;
            locText.innerText = "Location access denied. Please enable for local results.";
            locDot.classList.replace('bg-yellow-400', 'bg-red-500');
            renderCars();
        }
    );
}

// 3. VEHICLE MANAGEMENT
async function addNewCar() {
    const name = document.getElementById('add-car-name').value;
    const price = document.getElementById('add-car-price').value;
    const loc = document.getElementById('add-car-loc').value;
    const img = document.getElementById('add-car-img').value;

    if(!name || !price || !loc || !img) return alert("Please fill in all vehicle details.");

    const newVehicle = { id: Date.now().toString(), name, price: parseInt(price), location: loc.trim(), img };
    const res = await fetch(`${API_URL}/cars`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(newVehicle) });

    if(res.ok) {
        alert("Vehicle successfully added!");
        ["add-car-name", "add-car-price", "add-car-loc", "add-car-img"].forEach(id => document.getElementById(id).value = '');
        loadAllData();
    }
}

// 4. RENDERING LOGIC (Remains unchanged)
function renderCars() {
    let filtered = cars;
    if (activeUser?.role === 'user' && locationDetected && currentCity) {
        filtered = filtered.filter(v => v.location && v.location.toLowerCase() === currentCity.toLowerCase());
    }
    if (searchQuery.trim() !== "") {
        filtered = filtered.filter(v => v.name.toLowerCase().includes(searchQuery));
    }
    
    document.getElementById('home-title').innerText = searchQuery ? `Search Results for "${searchQuery}"` : "Explore Our Fleet";

    document.getElementById('car-list').innerHTML = filtered.length ? filtered.map(x => `
        <div class="bg-white rounded-[40px] overflow-hidden shadow-xl border car-card transition-all">
            <img src="${x.img}" class="w-full h-72 object-cover" onerror="this.src='https://via.placeholder.com/400x300?text=No+Image'">
            <div class="p-8">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="text-2xl font-black">${x.name}</h3>
                    ${(activeUser?.role === 'admin') ? `<button onclick="deleteVehicle('${x.id}')" class="text-red-500 font-black text-[10px] border border-red-200 px-2 py-1 rounded-lg">DELETE</button>` : ''}
                </div>
                <p class="text-[10px] font-bold text-blue-600 uppercase mb-4 tracking-widest">📍 ${x.location || 'Pan India'}</p>
                <div class="flex justify-between items-center pt-4 border-t">
                    <span class="text-2xl font-black text-blue-600">₹${x.price}<span class="text-xs text-gray-400">/day</span></span>
                    <button onclick="initBooking('${x.id}')" 
                        class="px-8 py-3 rounded-2xl font-bold transition 
                        ${(!locationDetected && activeUser?.role === 'user') ? 'bg-gray-200 text-gray-400' : 'bg-black text-white hover:bg-blue-600'}">
                        ${(!locationDetected && activeUser?.role === 'user') ? 'ENABLE LOCATION' : 'BOOK NOW'}
                    </button>
                </div>
            </div>
        </div>`).join('') : `<div class="col-span-full text-center py-20 text-gray-400 font-bold">No vehicles found in your location.</div>`;
}

function renderUserDash() {
    const userBookings = bookings.filter(b => b.uEmail === activeUser.email);
    document.getElementById('u-history').innerHTML = userBookings.map(x => `
        <tr class="border-b">
            <td class="p-6"><b>${x.car}</b><br><small class="text-gray-400">ID: ${x.id}</small></td>
            <td class="p-6 font-black">₹${x.total}</td>
            <td class="p-6"><span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase ${x.status === 'Confirmed' ? 'bg-green-100 text-green-700' : x.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}">${x.status}</span></td>
            <td class="p-6 text-right"><button onclick="generateReceipt('${x.id}')" class="text-blue-600 font-bold text-xs underline">Receipt</button></td>
        </tr>`).join('');
}

function renderAdminDash() {
    document.getElementById('a-pending-bookings').innerHTML = bookings.map(x => `
        <tr class="border-b">
            <td class="p-4"><b>${x.uName}</b><br><small class="text-blue-600">${x.car}</small></td>
            <td class="p-4 font-black">₹${x.total}</td>
            <td class="p-4 text-xs font-bold">${x.status.toUpperCase()}</td>
            <td class="p-4 text-right space-x-2">
                ${x.status === 'Pending' ? `
                    <button onclick="updateStatus('${x.id}', 'Confirmed')" class="text-green-600 font-bold text-[10px] border border-green-200 px-2 py-1 rounded">APPROVE</button>
                    <button onclick="updateStatus('${x.id}', 'Rejected')" class="text-orange-600 font-bold text-[10px] border border-orange-200 px-2 py-1 rounded">REJECT</button>
                ` : ''}
                <button onclick="deleteBooking('${x.id}')" class="text-red-500 font-bold text-[10px] px-2 py-1">REMOVE</button>
            </td>
        </tr>`).join('');
}

// 5. AUTH LOGIC WITH OTP
async function handleRegistration() {
    const name = document.getElementById('reg-n').value;
    const email = document.getElementById('reg-e').value;
    const pass = document.getElementById('reg-p').value;
    const otpInput = document.getElementById('reg-otp').value;

    if(!name || !email || !pass) return alert("All fields are required.");

    // Step 1: Send OTP if not already generated
    if (!generatedOTP) {
        generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
        tempRegUser = { id: Date.now().toString(), name, email, pass, role: 'user' };
        
        try {
            await emailjs.send("service_8bkoyy9", "template_7diwc1a", {
                email: email,           
                passcode: generatedOTP, 
                time: "10 minutes"      
            });
            document.getElementById('otp-section').classList.remove('hidden');
            document.getElementById('reg-btn').innerText = "VERIFY & REGISTER";
            alert("OTP sent to your email!");
        } catch (e) { alert("Email service error."); }
        return;
    }

    // Step 2: Verify OTP
    if (otpInput !== generatedOTP) {
        return alert("Invalid OTP. Please check your email.");
    }

    // Step 3: Finalize Registration
    const res = await fetch(`${API_URL}/users`, { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify(tempRegUser) 
    });
    
    if(res.ok) {
        alert("Registration Successful! Please login.");
        generatedOTP = null;
        tempRegUser = null;
        toggleAuth('login');
        loadAllData();
    }
}

function login() {
    const e = document.getElementById('l-email').value, p = document.getElementById('l-pass').value;
    const u = users.find(x => x.email === e && x.pass === p && x.role === selectedRole);
    if(u) { 
        activeUser = u; 
        sessionStorage.setItem('activeUser', JSON.stringify(u)); 
        if(u.role === 'user') fetchUserLocation(); 
        showPage('home'); 
    } else alert("Invalid credentials.");
}

async function forgotPassword() {
    const email = document.getElementById('l-email').value;
    if (!email) return alert("Enter your email in the login box first.");
    
    const user = users.find(u => u.email === email && u.role === selectedRole);
    if (!user) return alert("Account not found.");

    generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
    resetEmail = email;

    try {
        await emailjs.send("service_8bkoyy9", "template_7diwc1a", { 
            to_email: email, 
            otp_code: generatedOTP,
            user_name: user.name 
        });
        document.getElementById('reset-modal').classList.remove('hidden');
        document.getElementById('reset-msg').innerText = `OTP sent to ${email}`;
    } catch (e) { alert("Email service error."); }
}

async function verifyAndResetPassword() {
    const enteredOTP = document.getElementById('reset-otp').value;
    const newPass = document.getElementById('reset-new-pass').value;
    
    if (enteredOTP !== generatedOTP) return alert("Invalid OTP.");
    if (newPass.length < 4) return alert("Password too short.");
    
    const user = users.find(u => u.email === resetEmail);
    const res = await fetch(`${API_URL}/users/${user.id}`, { 
        method: 'PATCH', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ pass: newPass }) 
    });
    
    if(res.ok) { 
        alert("Password updated successfully!"); 
        generatedOTP = null;
        location.reload(); 
    }
}

// 6. BOOKING & SYSTEM SYNC (Remains unchanged)
async function initBooking(id) {
    if(!activeUser) return showPage('auth');
    if(activeUser.role === 'admin') return alert("Admins cannot book.");
    if(!locationDetected) { fetchUserLocation(); return; }
    
    const c = cars.find(x => x.id == id);
    const d = prompt(`Rent ${c.name} for how many days?`, "1");
    if(!d || isNaN(d)) return;

    tempBooking = { id: "BK-"+Date.now(), uEmail: activeUser.email, uName: activeUser.name, car: c.name, total: c.price * d, status: 'Pending', date: new Date().toLocaleDateString() };
    document.getElementById('kyc-modal').classList.remove('hidden');
}

async function finalSubmit() {
    const res = await fetch(`${API_URL}/bookings`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(tempBooking) });
    if(res.ok) { alert("Request submitted!"); location.reload(); }
}

async function loadAllData() {
    try {
        const [resC, resU, resB] = await Promise.all([
            fetch(`${API_URL}/cars`), fetch(`${API_URL}/users`), fetch(`${API_URL}/bookings`)
        ]);
        cars = await resC.json();
        users = await resU.json();
        bookings = await resB.json();
        updateNav();
        renderCars();
    } catch(e) { console.error("Sync Error: Is json-server running?"); }
}

function updateNav() {
    const nav = document.getElementById('nav-actions');
    const activePage = document.querySelector('.page:not(.hidden)')?.id;
    
    if(!activeUser) {
        nav.innerHTML = `<button onclick="showPage('auth')" class="bg-black text-white px-6 py-2 rounded-xl font-bold">Sign In</button>`;
    } else {
        const dashPage = activeUser.role === 'user' ? 'user-dash' : 'admin-dash';
        nav.innerHTML = `
            <button onclick="showPage('${activePage === dashPage ? 'home' : dashPage}')" class="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold text-xs">
                ${activePage === dashPage ? 'Back to Fleet' : 'My Dashboard'}
            </button> 
            <button onclick="logout()" class="text-red-500 font-bold text-xs">Logout</button>`;
    }
}

function showPage(id) { 
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden')); 
    document.getElementById(id).classList.remove('hidden'); 
    updateNav();
    if(id === 'user-dash') renderUserDash();
    if(id === 'admin-dash') renderAdminDash();
}

function logout() { if(confirm("Log out?")) { sessionStorage.clear(); location.reload(); } }
function setRole(r) { selectedRole = r; document.getElementById('r-user').classList.toggle('active-role', r==='user'); document.getElementById('r-admin').classList.toggle('active-role', r==='admin'); }
function toggleAuth(m) { 
    generatedOTP = null; // Reset OTP state if user switches views
    document.getElementById('otp-section').classList.add('hidden');
    document.getElementById('reg-btn').innerText = "REGISTER NOW";
    document.getElementById('login-box').classList.toggle('hidden', m==='reg'); 
    document.getElementById('reg-box').classList.toggle('hidden', m==='login'); 
}
function closeModal() { document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); }

// Initial Call
loadAllData();