# 🏎️ GadiWala - Premium Vehicle Rental System

**GadiWala** ek fully functional, modern vehicle rental platform hai. Ise specifically full-stack development principles ko demonstrate karne ke liye banaya gaya hai, jisme user-friendly interface aur powerful admin dashboard ka integration hai.

![Banner](https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80&w=1000)

## 🚀 Live Demo
Aap is project ko yahan dekh sakte hain: [GadiWala Live Link](https://gadiwala-1.onrender.com)
*(Note: Server sleep mode mein ho sakta hai, 30 seconds wait karein)*

---

## ✨ Features & Advantages

### 👤 User Portal
- **📍 Smart Geolocation:** Browser API aur IP-based detection se automatic city filter.
- **🔍 Advanced Search:** Vehicles ko name aur city ke basis par real-time filter karne ki suvidha.
- **💳 Integrated Booking Flow:** - Dynamic price calculation.
  - KYC verification (Aadhar/License number entry).
  - Dynamic UPI QR Code generation with amount.
- **📄 Invoice Management:** Har booking ke baad text-based invoice download karne ka option.

### 🔐 Admin Command Center
- **📊 Real-time Analytics:** Total earnings, user count, aur booking stats ka live update.
- **🚗 Fleet Management:** Cars add karna, delete karna, aur status (Available/Rented) toggle karna.
- **✅ Approval Workflow:** User ke payment screenshot ko verify karke booking approve ya reject karna.

---

## 🛠️ Tech Stack & Architecture

- **Frontend:** HTML5, Tailwind CSS (Utility-first styling), JavaScript (ES6+ logic).
- **Backend/API:** JSON Server (REST API simulation for prototyping).
- **Automation:** EmailJS for OTP and notifications.
- **Deployment:** Render (Hosting for both Frontend and JSON Server).

---

## 📂 Project Structure

```text
├── index.html          # Core UI structure and Modals
├── script.js           # State management, API handling, and DOM Logic
├── style.css           # Custom Tailwind configurations and animations
├── db.json             # Mock Database (Users, Vehicles, Bookings)
└── README.md           # Documentation
