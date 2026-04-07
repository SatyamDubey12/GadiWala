const API_URL = "http://localhost:3000"; 
let cars = [], users = [], bookings = [];
let activeUser = JSON.parse(sessionStorage.getItem('activeUser')) || null;
let selectedRole = 'user', tempBooking = {}, searchQuery = "", currentCity = "", generatedOtp = "", forgotOtp = "", resetUserEmail = "";

// Initialize Stripe & EmailJS
const stripe = typeof Stripe !== 'undefined' ? Stripe('pk_test_your_key_here') : null;
(function(){ emailjs.init("UBoCaMD4uz6NNv7jD"); })();

function showLoader() { document.getElementById('loader').classList.remove('hidden'); }
function hideLoader() { document.getElementById('loader').classList.add('hidden'); }

// 1. DATA SYNC
async function loadAllData() {
    showLoader();
    try {
        const [resC, resU, resB] = await Promise.all([
            fetch(`${API_URL}/cars`).catch(() => null),
            fetch(`${API_URL}/users`).catch(() => null),
            fetch(`${API_URL}/bookings`).catch(() => null)
        ]);

        if(!resC || !resU || !resB) throw new Error("Server connection failed.");

        cars = await resC.json();
        users = await resU.json();
        bookings = await resB.json();
        
        updateNav();
        renderCars();
        if(activeUser?.role === 'user') renderUserDash();
        if(activeUser?.role === 'admin') renderAdminDash();
        
        // Auto-detect location after data is ready
        fetchUserLocation();
    } catch(e) { 
        console.error("Database Error:", e);
        cars = []; users = []; bookings = [];
        renderCars();
        alert("Warning: Could not connect to database. Ensure json-server is on port 3000.");
    } finally { hideLoader(); }
}

// 2. AUTHENTICATION
function login() {
    const e = document.getElementById('l-email').value.trim().toLowerCase();
    const p = document.getElementById('l-pass').value.trim();
    if(!e || !p) return alert("Please fill all fields.");

    const userMatch = users.find(x => x.email.toLowerCase() === e && x.pass === p && x.role === selectedRole);
    if(userMatch) { 
        activeUser = userMatch; 
        sessionStorage.setItem('activeUser', JSON.stringify(userMatch)); 
        location.reload(); 
    } else {
        alert("Invalid credentials. Please check email/password and role.");
    }
}

function toggleAuth(type) {
    if(type === 'reg') {
        document.getElementById('login-box').classList.add('hidden');
        document.getElementById('reg-box').classList.remove('hidden');
    } else {
        document.getElementById('reg-box').classList.add('hidden');
        document.getElementById('login-box').classList.remove('hidden');
    }
}

function loginWithGoogle() {
    if(selectedRole === 'admin') return alert("Google Login is only for Customers.");
    document.getElementById('google-modal').classList.remove('hidden');
}

async function simulateGoogleLogin(name, email) {
    showLoader();
    try {
        // Check if user already exists
        let user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
        
        if(!user) {
            // Create new user if not exists
            const newUser = { id: Date.now().toString(), name: name, email: email, pass: "google_auth", role: 'user' };
            const res = await fetch(`${API_URL}/users`, {
                method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(newUser)
            });
            user = await res.json();
        }

        activeUser = user;
        sessionStorage.setItem('activeUser', JSON.stringify(user));
        alert(`Welcome, ${name}! Logged in via Google.`);
        location.reload();
    } catch(e) {
        alert("Google Login failed.");
    } finally {
        hideLoader();
    }
}

async function startRegistration() {
    const n = document.getElementById('reg-n').value.trim();
    const e = document.getElementById('reg-e').value.trim().toLowerCase();
    const p = document.getElementById('reg-p').value.trim();

    if(!n || !e || !p) return alert("All fields are required.");
    if(users.some(u => u.email.toLowerCase() === e)) return alert("Email already registered.");

    generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    showLoader();
    try {
        await emailjs.send("service_8bkoyy9", "template_7diwc1a", { 
            email: e, 
            passcode: `Your Registration OTP: ${generatedOtp}` 
        });
        alert("OTP sent to your email!");
        document.getElementById('otp-section').classList.remove('hidden');
        document.getElementById('reg-btn').classList.add('hidden');
        document.getElementById('verify-btn').classList.remove('hidden');
    } catch(err) { alert("Failed to send OTP."); }
    finally { hideLoader(); }
}

async function verifyOtpAndRegister() {
    const userOtp = document.getElementById('reg-otp').value.trim();
    if(userOtp !== generatedOtp) return alert("Invalid OTP.");

    const n = document.getElementById('reg-n').value.trim();
    const e = document.getElementById('reg-e').value.trim().toLowerCase();
    const p = document.getElementById('reg-p').value.trim();

    const newUser = { id: Date.now().toString(), name: n, email: e, pass: p, role: 'user' };
    showLoader();
    try {
        const res = await fetch(`${API_URL}/users`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(newUser)
        });
        if(res.ok) {
            alert("Registration Successful! Please Login.");
            toggleAuth('login');
            loadAllData();
        }
    } catch(err) { alert("Registration failed."); }
    finally { hideLoader(); }
}

function forgotPassword() {
    document.getElementById('forgot-modal').classList.remove('hidden');
    document.getElementById('forgot-step-1').classList.remove('hidden');
    document.getElementById('forgot-step-2').classList.add('hidden');
    document.getElementById('forgot-step-3').classList.add('hidden');
}

async function processForgotPassword() {
    const email = document.getElementById('f-email').value.trim().toLowerCase();
    if(!email) return alert("Enter email.");
    
    const user = users.find(u => u.email.toLowerCase() === email);
    if(user) {
        forgotOtp = Math.floor(100000 + Math.random() * 900000).toString();
        resetUserEmail = email;
        showLoader();
        try {
            await emailjs.send("service_8bkoyy9", "template_7diwc1a", { 
                email: email, 
                passcode: `Your Password Reset OTP: ${forgotOtp}` 
            });
            alert("OTP sent to your email!");
            document.getElementById('forgot-step-1').classList.add('hidden');
            document.getElementById('forgot-step-2').classList.remove('hidden');
        } catch(e) { alert("Error sending OTP."); }
        finally { hideLoader(); }
    } else { alert("Email not found."); }
}

function verifyForgotOtp() {
    const otp = document.getElementById('f-otp').value.trim();
    if(otp === forgotOtp) {
        document.getElementById('forgot-step-2').classList.add('hidden');
        document.getElementById('forgot-step-3').classList.remove('hidden');
    } else { alert("Invalid OTP."); }
}

async function resetPasswordFinal() {
    const newPass = document.getElementById('f-new-pass').value.trim();
    if(!newPass) return alert("Enter new password.");

    const user = users.find(u => u.email.toLowerCase() === resetUserEmail);
    showLoader();
    try {
        const res = await fetch(`${API_URL}/users/${user.id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ pass: newPass })
        });
        if(res.ok) {
            alert("Password reset successful!");
            closeModal();
            loadAllData();
        }
    } catch(e) { alert("Reset failed."); }
    finally { hideLoader(); }
}

// 3. VEHICLE RENDERING & SEARCH
function renderCars() {
    const list = document.getElementById('car-list');
    
    if(!cars || cars.length === 0) {
        list.innerHTML = `
            <div class="col-span-full text-center py-20">
                <p class="text-gray-400 font-bold mb-4">No vehicles available or Server is offline.</p>
                <button onclick="loadAllData()" class="bg-blue-600 text-white px-6 py-2 rounded-xl font-black text-xs shadow-lg hover:bg-blue-700 transition">RETRY CONNECTION</button>
                <p class="text-[10px] text-gray-400 mt-4 uppercase font-black">Make sure "json-server" is running on port 3000</p>
            </div>`;
        return;
    }
    const filtered = cars.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (c.city && c.city.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Prioritize cars in currentCity and Available ones
    const sorted = [...filtered].sort((a, b) => {
        const aInCity = a.city && a.city.toLowerCase() === currentCity.toLowerCase();
        const bInCity = b.city && b.city.toLowerCase() === currentCity.toLowerCase();
        const aAvailable = a.status !== 'Not Available';
        const bAvailable = b.status !== 'Not Available';

        // 1. City Match (Prioritize city match)
        if (aInCity && !bInCity) return -1;
        if (!aInCity && bInCity) return 1;

        // 2. Availability (If both match city or both don't, prioritize availability)
        if (aAvailable && !bAvailable) return -1;
        if (!aAvailable && bAvailable) return 1;

        return 0;
    });

    list.innerHTML = sorted.map(c => {
        const isAvailable = c.status !== 'Not Available';
        const isAdmin = activeUser?.role === 'admin';
        
        // Availability Tag
        const tagClickAction = isAdmin ? `onclick="toggleAvailability('${c.id}')" title="Click to Toggle Status" style="cursor: pointer;"` : '';
        const statusTag = isAvailable 
            ? `<div ${tagClickAction} class="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase shadow-lg hover:scale-105 transition">${isAvailable ? 'Available' : 'Not Available'} ${isAdmin ? '✎' : ''}</div>`
            : `<div ${tagClickAction} class="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase shadow-lg hover:scale-105 transition">${isAvailable ? 'Available' : 'Not Available'} ${isAdmin ? '✎' : ''}</div>`;

        // Button logic
        let actionBtn = "";
        if(isAdmin) {
            actionBtn = `<button onclick="goToAdminAndEdit('${c.id}')" class="w-full bg-blue-600 text-white py-3 rounded-2xl font-bold hover:bg-blue-700 transition">Edit Price/Info</button>`;
        } else {
            actionBtn = isAvailable 
                ? `<button onclick="initBooking('${c.id}')" class="w-full bg-gray-900 text-white py-3 rounded-2xl font-bold group-hover:bg-blue-600 transition">Book Now</button>`
                : `<button disabled class="w-full bg-gray-300 text-gray-500 py-3 rounded-2xl font-bold cursor-not-allowed">Currently Booked</button>`;
        }

        return `
        <div class="car-card bg-white rounded-[30px] overflow-hidden shadow-lg border border-gray-100 group relative">
            <div class="relative h-48">
                <img src="${c.img}" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
                ${statusTag}
                <div class="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-black">₹${c.price}/day</div>
            </div>
            <div class="p-6">
                <h4 class="text-xl font-black mb-1">${c.name}</h4>
                <p class="text-gray-400 text-sm mb-4">📍 ${c.city || 'Available Nationwide'}</p>
                ${actionBtn}
            </div>
        </div>`;
    }).join('');
}

function goToAdminAndEdit(id) {
    showPage('admin-dash');
    editCar(id);
    // Scroll to the top where the edit form is
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function toggleAvailability(id) {
    const car = cars.find(c => c.id == id);
    if(!car) return;
    const newStatus = car.status === 'Not Available' ? 'Available' : 'Not Available';
    
    showLoader();
    try {
        const res = await fetch(`${API_URL}/cars/${id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ status: newStatus })
        });
        if(res.ok) {
            loadAllData();
        }
    } catch(e) { alert("Failed to update status."); }
    finally { hideLoader(); }
}

function handleSearchSuggestions() {
    const input = document.getElementById('global-search');
    const box = document.getElementById('search-suggestions');
    searchQuery = input.value.trim();
    
    if(!searchQuery) {
        box.classList.add('hidden');
        renderCars();
        return;
    }

    const matches = cars.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    if(matches.length) {
        box.innerHTML = matches.map(c => `
            <div class="p-3 hover:bg-gray-50 cursor-pointer flex items-center gap-3 border-b last:border-0" onclick="selectSuggestion('${c.name}')">
                <img src="${c.img}" class="w-8 h-8 rounded object-cover">
                <div><div class="text-sm font-bold">${c.name}</div><div class="text-[10px] text-gray-400">₹${c.price}/day</div></div>
            </div>`).join('');
        box.classList.remove('hidden');
    } else {
        box.classList.add('hidden');
    }
    renderCars();
}

function selectSuggestion(name) {
    document.getElementById('global-search').value = name;
    searchQuery = name;
    document.getElementById('search-suggestions').classList.add('hidden');
    renderCars();
}

async function fetchUserLocation() {
    const locText = document.getElementById('loc-text');
    const locBar = document.getElementById('location-bar');
    const filterBtn = document.getElementById('filter-city-btn');
    const manualInput = document.getElementById('manual-loc-input');
    
    // Ensure bar is visible
    locBar.classList.remove('hidden');
    manualInput.classList.add('hidden');
    filterBtn.classList.add('hidden');
    
    // Browser Check
    if (!navigator.geolocation) {
        locText.innerText = "Location not supported by your browser.";
        return;
    }

    locText.innerText = "Attempting automatic location detection...";

    const options = {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        locText.innerText = "📍 Location found! Identifying city...";
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            const data = await res.json();
            const city = data.address.city || data.address.town || data.address.village || "Unknown City";
            applyCityFilter(city);
        } catch(e) { 
            locText.innerText = "City identification failed."; 
        }
    }, (err) => { 
        // Fallback to IP-based location if GPS is blocked or fails
        fetchIpLocation();
    }, options);
}

async function fetchIpLocation() {
    const locText = document.getElementById('loc-text');
    locText.innerText = "GPS blocked. Using IP-based detection...";
    
    try {
        // Try Service 1: ipapi.co
        const res1 = await fetch('https://ipapi.co/json/');
        const data1 = await res1.json();
        if(data1.city) {
            applyCityFilter(data1.city);
            return;
        }
    } catch(e) {
        console.warn("Service 1 failed, trying Service 2...");
    }

    try {
        // Try Service 2: ip-api.com (Fallback)
        const res2 = await fetch('http://ip-api.com/json/');
        const data2 = await res2.json();
        if(data2.city) {
            applyCityFilter(data2.city);
            return;
        }
    } catch(e) {
        console.warn("Service 2 failed, showing manual input.");
    }

    // Both services failed, show manual input
    locText.innerText = "Automatic detection failed. Type manually ->"; 
    document.getElementById('manual-loc-input').classList.remove('hidden');
}

function applyCityFilter(city) {
    const locText = document.getElementById('loc-text');
    const filterBtn = document.getElementById('filter-city-btn');
    
    currentCity = city; // Set current detected city
    locText.innerHTML = `📍 You are in <b>${city}</b>`;
    
    const hasCars = cars.some(c => c.city && c.city.toLowerCase() === city.toLowerCase());
    if(hasCars) {
        filterBtn.classList.remove('hidden');
        filterBtn.innerText = `Show cars in ${city}`;
        filterBtn.onclick = () => {
            searchQuery = city;
            document.getElementById('global-search').value = city;
            renderCars();
        };
        // By default, we prioritize current city in the main list
        renderCars();
    }
}

function setManualLocation() {
    const city = document.getElementById('manual-city').value.trim();
    if(!city) return alert("Please enter a city name.");
    
    currentCity = city; // Set manual city
    const locText = document.getElementById('loc-text');
    locText.innerText = `Location Set: ${city}`;
    alert(`Location Set to: ${city}`);
    
    // Prioritize this city in the list
    renderCars();
}

// 4. BOOKING
function initBooking(carId) {
    if(!activeUser) return showPage('auth');
    const car = cars.find(c => c.id == carId);
    tempBooking = { carId: car.id, carName: car.name, pricePerDay: car.price, userId: activeUser.id, userName: activeUser.name, uEmail: activeUser.email };
    document.getElementById('kyc-modal').classList.remove('hidden');
}

function proceedToPayment() {
    const kyc = document.getElementById('kyc-no').value;
    const days = document.getElementById('booking-days').value;
    if(!kyc || !days || days <= 0) return alert("KYC and Days required.");
    tempBooking.kycNo = kyc;
    tempBooking.days = parseInt(days);
    tempBooking.total = tempBooking.pricePerDay * tempBooking.days;
    
    document.getElementById('pay-amount-display').innerText = `Total: ₹${tempBooking.total} (${tempBooking.days} days)`;
    
    // Fetch Admin-set UPI ID or use default
    const upiID = localStorage.getItem('adminUpiID') || "satyamdubey7582@okicici"; 
    const upiName = "GadiWala Payments";
    
    // Dynamic QR with Amount
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=${upiID}&pn=${encodeURIComponent(upiName)}&am=${tempBooking.total}&cu=INR`;
    document.getElementById('upi-qr').src = qrUrl;
    document.getElementById('upi-text-display').innerText = `UPI: ${upiID}`;

    document.getElementById('kyc-modal').classList.add('hidden');
    document.getElementById('pay-modal').classList.remove('hidden');
}

function togglePaymentSection(type) {
    ['upi', 'card', 'net'].forEach(s => {
        const el = document.getElementById(`${s}-section`);
        if(s === type) el.classList.toggle('hidden');
        else el.classList.add('hidden');
    });
}

let tdsGeneratedOtp = "";

function start3DSimulation() {
    const cardNo = document.querySelector("#card-section input[placeholder='Card Number']").value.trim();
    if(cardNo.length < 16) return alert("Please enter a valid 16-digit card number.");
    
    tdsGeneratedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("3DS OTP (Simulated):", tdsGeneratedOtp);
    alert(`3D Secure: A verification code ${tdsGeneratedOtp} has been sent to your bank-registered mobile.`);
    
    document.getElementById('tds-modal').classList.remove('hidden');
}

function verifyTDS() {
    const entered = document.getElementById('tds-otp').value.trim();
    if(entered === tdsGeneratedOtp) {
        document.getElementById('tds-modal').classList.add('hidden');
        finalSubmit('Paid via 3D Secure Card');
    } else {
        alert("Invalid 3DS Verification Code. Please try again.");
    }
}

async function startStripePayment() {
    const btn = document.getElementById('stripe-button');
    btn.innerText = "Processing..."; btn.disabled = true;
    setTimeout(() => { finalSubmit(`Paid ₹${tempBooking.total}`); }, 2000);
}

async function finalSubmit(payStatus) {
    const fileInput = document.getElementById('pay-screenshot');
    let screenshotBase64 = null;

    // For UPI, screenshot is mandatory to prevent fake bookings
    if (payStatus.includes('UPI') && (!fileInput || !fileInput.files[0])) {
        return alert("Please upload a payment screenshot to proceed with your booking.");
    }

    if (fileInput && fileInput.files[0]) {
        screenshotBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(fileInput.files[0]);
        });
    }

    const data = { ...tempBooking, payment: payStatus, screenshot: screenshotBase64, status: 'Pending', date: new Date().toLocaleDateString() };
    showLoader();
    try {
        const res = await fetch(`${API_URL}/bookings`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)
        });
        if(res.ok) {
            alert("Booking Successful! Download your invoice from Dashboard.");
            closeModal(); loadAllData(); showPage('user-dash');
        }
    } catch(e) { alert("Booking failed. Check server."); }
    finally { hideLoader(); }
}

function viewScreenshot(url) {
    const modal = document.getElementById('preview-modal');
    const img = document.getElementById('preview-img');
    img.src = url;
    modal.classList.remove('hidden');
}

function downloadInvoice(bookingId) {
    const b = bookings.find(x => x.id == bookingId);
    if(!b) return;
    const slip = `GADIWALA INVOICE\nID: ${b.id}\nDate: ${b.date}\nCar: ${b.carName}\nCustomer: ${b.userName}\nDays: ${b.days}\nPaid: ${b.payment}\nStatus: ${b.status}`;
    const blob = new Blob([slip], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Invoice_${b.id}.txt`; a.click();
}

function showBookingDetails(id) {
    const b = bookings.find(x => x.id == id);
    if(!b) return;
    
    document.getElementById('bm-id').innerText = `#${b.id}`;
    document.getElementById('bm-user').innerText = b.userName || 'Unknown User';
    document.getElementById('bm-car').innerText = b.carName || 'Unknown Car';
    document.getElementById('bm-days').innerText = `${b.days || 1} Days`;
    document.getElementById('bm-total').innerText = `₹${(b.total || 0).toLocaleString()}`;
    document.getElementById('bm-pay').innerText = b.payment || 'N/A';
    
    const statusEl = document.getElementById('bm-status');
    statusEl.innerText = b.status;
    statusEl.className = `px-4 py-1 rounded-full text-xs font-black uppercase ${b.status==='Approved'?'bg-green-50 text-green-600':(b.status==='Rejected'?'bg-red-50 text-red-600':'bg-blue-50 text-blue-600')}`;
    
    const ssBox = document.getElementById('bm-screenshot-box');
    if(b.screenshot) {
        ssBox.classList.remove('hidden');
        document.getElementById('bm-screenshot').src = b.screenshot;
    } else {
        ssBox.classList.add('hidden');
    }
    
    document.getElementById('booking-modal').classList.remove('hidden');
}

// 5. ADMIN
async function addNewCar() {
    const name = document.getElementById('add-car-name').value;
    const price = document.getElementById('add-car-price').value;
    const city = document.getElementById('add-car-loc').value;
    const img = document.getElementById('add-car-img').value;
    if(!name || !price || !city || !img) return alert("Fill details.");
    const newCar = { id: Date.now().toString(), name, price: parseInt(price), city, img };
    showLoader();
    try {
        const res = await fetch(`${API_URL}/cars`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(newCar) });
        if(res.ok) { alert("Added!"); resetAddCarForm(); loadAllData(); }
    } catch(e) { alert("Failed."); }
    finally { hideLoader(); }
}

async function editCar(id) {
    const car = cars.find(c => c.id == id);
    document.getElementById('add-car-name').value = car.name;
    document.getElementById('add-car-price').value = car.price;
    document.getElementById('add-car-loc').value = car.city || "";
    document.getElementById('add-car-img').value = car.img;
    const btn = document.querySelector("#admin-dash button");
    btn.innerText = "UPDATE"; btn.onclick = () => updateCar(id);
}

async function updateCar(id) {
    const data = { name: document.getElementById('add-car-name').value, price: parseInt(document.getElementById('add-car-price').value), city: document.getElementById('add-car-loc').value, img: document.getElementById('add-car-img').value };
    showLoader();
    try {
        const res = await fetch(`${API_URL}/cars/${id}`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
        if(res.ok) { alert("Updated!"); resetAddCarForm(); loadAllData(); }
    } catch(e) { alert("Failed."); }
    finally { hideLoader(); }
}

function resetAddCarForm() {
    ['add-car-name','add-car-price','add-car-loc','add-car-img'].forEach(id => document.getElementById(id).value = "");
    const btn = document.querySelector("#admin-dash button");
    btn.innerText = "ADD TO FLEET"; btn.onclick = addNewCar;
}

async function deleteBooking(id) {
    if(!confirm("Delete?")) return;
    showLoader();
    try { await fetch(`${API_URL}/bookings/${id}`, { method: 'DELETE' }); loadAllData(); } catch(e) {}
    finally { hideLoader(); }
}

async function deleteCar(id) {
    if(!confirm("Remove?")) return;
    showLoader();
    try { await fetch(`${API_URL}/cars/${id}`, { method: 'DELETE' }); loadAllData(); } catch(e) {}
    finally { hideLoader(); }
}

async function updateStatus(id, s) {
    showLoader();
    try { 
        const booking = bookings.find(b => b.id == id);
        if(!booking) throw new Error("Booking not found");

        // 1. Update Booking Status
        await fetch(`${API_URL}/bookings/${id}`, { 
            method: 'PATCH', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ status: s }) 
        }); 

        // 2. If APPROVED, mark the car as "Not Available"
        if(s === 'Approved' && booking.carId) {
            await fetch(`${API_URL}/cars/${booking.carId}`, {
                method: 'PATCH',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ status: 'Not Available' })
            });
        }
        
        loadAllData(); 
    } catch(e) {
        console.error("Status Update Error:", e);
        alert("Failed to update status.");
    } finally { hideLoader(); }
}

// 6. DASHBOARDS
function renderUserDash() {
    const hist = document.getElementById('u-history');
    const myB = bookings.filter(b => b.userId === activeUser.id);
    
    // Set Name
    if(activeUser) document.getElementById('u-display-name').innerText = activeUser.name;

    hist.innerHTML = myB.map(b => `<tr><td class="p-6 cursor-pointer hover:bg-gray-50 transition" onclick="showBookingDetails('${b.id}')"><b>${b.carName}</b><br><small>${b.days} Days</small></td><td class="p-6 text-green-600 font-bold">${b.payment}</td><td class="p-6"><span class="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-bold">${b.status}</span></td><td class="p-6 text-right"><button onclick="downloadInvoice('${b.id}')" class="text-blue-600 font-bold text-xs hover:underline">Invoice</button></td></tr>`).join('');
}

function renderAdminDash() {
    const bookingsList = document.getElementById('a-bookings-list');
    const fleetList = document.getElementById('a-fleet-list');
    
    // Set Name
    if(activeUser) document.getElementById('a-display-name').innerText = activeUser.name;

    // Stats Calculation
    const approvedBookings = bookings.filter(b => b.status === 'Approved');
    const totalEarnings = approvedBookings.reduce((sum, b) => sum + (b.total || 0), 0);
    
    document.getElementById('a-total-earnings').innerText = `₹${totalEarnings.toLocaleString()}`;
    document.getElementById('a-total-bookings').innerText = bookings.length;
    document.getElementById('a-total-users').innerText = users.length;

    // 1. Render Bookings
    bookingsList.innerHTML = bookings.length ? bookings.map(b => `
        <div class="p-6 bg-white border rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center shadow-sm gap-4">
            <div class="flex-1 cursor-pointer group" onclick="showBookingDetails('${b.id}')">
                <div class="flex items-center gap-2 mb-1">
                    <b class="text-lg group-hover:text-blue-600 transition">${b.userName || 'Unknown User'}</b>
                    <span class="px-2 py-0.5 bg-gray-100 text-[8px] font-black rounded uppercase">${b.id}</span>
                </div>
                <div class="text-blue-600 font-bold mb-2">${b.carName || 'Unknown Car'}</div>
                <div class="flex flex-wrap gap-x-4 gap-y-1">
                    <small class="text-gray-400 font-bold uppercase text-[9px]">📅 ${b.date}</small>
                    <small class="text-gray-400 font-bold uppercase text-[9px]">⏳ ${b.days || 1} Days</small>
                    <small class="text-gray-400 font-bold uppercase text-[9px]">💰 ${b.payment || 'N/A'}</small>
                </div>
                ${b.screenshot ? `<button onclick="event.stopPropagation(); viewScreenshot('${b.screenshot}')" class="mt-3 text-blue-600 font-black text-[9px] uppercase border-b-2 border-blue-100 pb-0.5 hover:border-blue-600 transition">View Payment Proof</button>` : ''}
            </div>
            <div class="flex gap-2 w-full md:w-auto">
                ${b.status === 'Pending' ? `
                    <button onclick="updateStatus('${b.id}', 'Approved')" class="flex-1 md:flex-none bg-green-500 text-white px-6 py-2 rounded-xl text-xs font-black hover:bg-green-600 shadow-md">APPROVE</button>
                    <button onclick="updateStatus('${b.id}', 'Rejected')" class="flex-1 md:flex-none bg-red-500 text-white px-6 py-2 rounded-xl text-xs font-black hover:bg-red-600 shadow-md">REJECT</button>
                ` : `<span class="px-4 py-2 rounded-xl text-xs font-black uppercase ${b.status==='Approved'?'bg-green-50 text-green-600':'bg-red-50 text-red-600'}">${b.status}</span>`}
                <button onclick="deleteBooking('${b.id}')" class="bg-gray-100 text-gray-400 p-2 rounded-xl hover:bg-red-500 hover:text-white transition">🗑️</button>
            </div>
        </div>`).join('') : `<div class="py-20 text-center text-gray-400 font-black uppercase tracking-widest">No bookings found</div>`;

    // 2. Render Fleet
    fleetList.innerHTML = cars.length ? cars.map(c => {
        const isAvailable = c.status !== 'Not Available';
        return `
        <div class="p-4 bg-white border rounded-[30px] flex justify-between items-center shadow-sm hover:shadow-md transition">
            <div class="flex items-center gap-4">
                <div class="relative cursor-pointer group" onclick="toggleAvailability('${c.id}')" title="Click to toggle status">
                    <img src="${c.img}" class="w-16 h-16 object-cover rounded-2xl shadow-sm group-hover:opacity-70 transition">
                    <span class="absolute -top-1 -left-1 w-4 h-4 rounded-full border-2 border-white ${isAvailable?'bg-green-500':'bg-red-500'} shadow-sm"></span>
                    <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                        <span class="bg-black/50 text-white text-[8px] font-black px-1 rounded">TOGGLE</span>
                    </div>
                </div>
                <div>
                    <b class="text-sm">${c.name}</b><br>
                    <div class="flex items-center gap-2 mt-1">
                        <span class="text-[10px] font-black text-blue-600">₹${c.price}/day</span>
                        <span class="w-1 h-1 bg-gray-300 rounded-full"></span>
                        <span onclick="toggleAvailability('${c.id}')" class="${isAvailable?'text-green-600 bg-green-50':'text-red-600 bg-red-50'} text-[9px] font-black uppercase px-2 py-0.5 rounded-full cursor-pointer hover:scale-105 transition shadow-sm border border-current">${isAvailable?'Available':'Not Available'} (Click to Edit)</span>
                    </div>
                </div>
            </div>
            <div class="flex gap-2">
                <button onclick="toggleAvailability('${c.id}')" class="p-2 rounded-xl bg-gray-50 hover:bg-orange-500 hover:text-white transition text-xs" title="Toggle Status">🔄</button>
                <button onclick="editCar('${c.id}')" class="p-2 rounded-xl bg-gray-50 hover:bg-blue-600 hover:text-white transition text-xs" title="Edit Car">✏️</button>
                <button onclick="deleteCar('${c.id}')" class="p-2 rounded-xl bg-gray-50 hover:bg-red-600 hover:text-white transition text-xs" title="Delete Car">🗑️</button>
            </div>
        </div>`;
    }).join('') : `<div class="col-span-full py-20 text-center text-gray-400 font-black uppercase tracking-widest">Fleet is empty</div>`;
}

function switchAdminTab(tabId) {
    // Update Buttons
    document.querySelectorAll('.admin-tab').forEach(btn => {
        btn.classList.remove('bg-black', 'text-white');
        btn.classList.add('text-gray-400');
    });
    const activeBtn = document.getElementById(`tab-${tabId}`);
    activeBtn.classList.remove('text-gray-400');
    activeBtn.classList.add('bg-black', 'text-white');

    // Update Sections
    document.querySelectorAll('.admin-section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(`admin-section-${tabId}`).classList.remove('hidden');

    // If switching to settings, pre-fill profile fields
    if(tabId === 'settings') {
        document.getElementById('prof-n').value = activeUser.name || "";
        document.getElementById('prof-e').value = activeUser.email || "";
        document.getElementById('prof-m').value = activeUser.mobile || "";
    }
}

function switchUserTab(tabId) {
    document.querySelectorAll('.user-tab').forEach(btn => {
        btn.classList.remove('bg-black', 'text-white');
        btn.classList.add('text-gray-400');
    });
    document.getElementById(`utab-${tabId}`).classList.remove('text-gray-400');
    document.getElementById(`utab-${tabId}`).classList.add('bg-black', 'text-white');

    document.querySelectorAll('.user-section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(`user-section-${tabId}`).classList.remove('hidden');

    if(tabId === 'profile') {
        document.getElementById('u-prof-n').value = activeUser.name || "";
        document.getElementById('u-prof-e').value = activeUser.email || "";
        document.getElementById('u-prof-m').value = activeUser.mobile || "";
    }
}

async function updateProfile(roleType = 'admin') {
    const prefix = roleType === 'user' ? 'u-' : '';
    const name = document.getElementById(`${prefix}prof-n`).value.trim();
    const email = document.getElementById(`${prefix}prof-e`).value.trim();
    const mobile = document.getElementById(`${prefix}prof-m`).value.trim();

    if(!name || !email) return alert("Name and Email are required.");

    const updateData = { name, email, mobile };

    showLoader();
    try {
        const res = await fetch(`${API_URL}/users/${activeUser.id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(updateData)
        });
        if(res.ok) {
            const updatedUser = await res.json();
            activeUser = updatedUser;
            sessionStorage.setItem('activeUser', JSON.stringify(updatedUser));
            alert("Profile updated successfully!");
            updateNav();
            loadAllData();
        }
    } catch(e) { alert("Failed to update profile."); }
    finally { hideLoader(); }
}

async function updateAdminUpi() {
    const newUpi = document.getElementById('admin-upi-id').value.trim();
    if(!newUpi) return alert("Please enter a valid UPI ID.");
    
    // In a real app, you'd save this to a settings object in db.json
    // For now, we'll store it in localStorage so it persists for this admin
    localStorage.setItem('adminUpiID', newUpi);
    alert("UPI ID updated successfully! Users will now see this ID for payments.");
}

// UI HELPERS
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    window.scrollTo(0,0);
}
function setRole(r) { 
    selectedRole = r; 
    document.getElementById('r-user').className = r==='user'?'flex-1 py-3 border-2 rounded-2xl font-bold bg-black text-white':'flex-1 py-3 border-2 rounded-2xl font-bold';
    document.getElementById('r-admin').className = r==='admin'?'flex-1 py-3 border-2 rounded-2xl font-bold bg-black text-white':'flex-1 py-3 border-2 rounded-2xl font-bold';
    updateNav(); 
}
function closeModal() { document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); }
function updateNav() {
    const nav = document.getElementById('nav-actions');
    const homeBtn = `<button onclick="showPage('home')" class="text-xs font-bold hover:text-blue-600 transition mr-2">Home</button>`;
    if(!activeUser) {
        nav.innerHTML = `${homeBtn} <button onclick="showPage('auth')" class="bg-black text-white px-6 py-2 rounded-xl font-bold">Sign In</button>`;
    } else {
        const dashPage = activeUser.role === 'user' ? 'user-dash' : 'admin-dash';
        nav.innerHTML = `
            ${homeBtn}
            <button onclick="showPage('${dashPage}')" class="hidden md:flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full mr-2 hover:bg-gray-200 transition group">
                <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span class="text-[10px] font-black uppercase text-gray-500 group-hover:text-black">${activeUser.name}</span>
            </button>
            <button onclick="showPage('${dashPage}')" class="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-blue-700 transition">Dashboard</button> 
            <button onclick="sessionStorage.clear(); location.reload();" class="text-red-500 font-bold text-xs ml-2 hover:underline">Logout</button>
        `;
    }
}

// Start
loadAllData();

// Add helper to close modals on escape key
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});
