🛍️ BuyNaBay: A CAMPUS-BASED E-COMMERCE PLATFORM FOR USTP STUDENTS
--------------------------------------------------------------
A web application using Node.js as the backend and React for the frontend design and components.
BuyNaBay provides a centralized platform where USTP students can buy, sell, or rent pre-loved items within their campus community, promoting convenience, sustainability, and student engagement.

📂 PROJECT STRUCTURE
--------------------------------------------------------------
```
BuyNaBay/
│── src/ # React Native Source Files
│ ├── screens/                 # App Screens (Login, Register, Profile, Add Item, etc.)
│ ├── components/              # Reusable UI Components
│ ├── supabase/                # Supabase Client Setup
│ ├── firebase/                # Firebase Authentication Config
│
│── assets/                    # Images and Icons
│── App.js                     # Main Application Entry
│── package.json               # Project Dependencies
│── README.md                  # Project Overview
```

---



---

## 🛠️ PRE-REQUISITES
Before running this project, make sure you have the following installed:

- **Node.js** (v14+ recommended): [https://nodejs.org/](https://nodejs.org/)  
- **Git** (for version control): [https://git-scm.com/downloads](https://git-scm.com/downloads)  
- **Supabase Account** (for database & authentication): [https://supabase.com/](https://supabase.com/)

---

## ⚙️📦 Backend (Node.js + Supabase)

### 📌 Navigate to the `backend/` directory:
```bash
cd backend
```

📌 Install dependencies:

```sh
npm install
```


📌 Create an .env file inside backend/ and add your Supabase credentials:

SUPABASE_URL=https://ktezclohitsiegzhhhgo.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0ZXpjbG9oaXRzaWVnemhoaGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMwMjkxNDIsImV4cCI6MjA0ODYwNTE0Mn0.iAMC6qmEzBO-ybtLj9lQLxkrWMddippN6vsGYfmMAjQ


📌 Run the server:

```sh
node index.js
```

✅ The backend provides RESTful APIs for:

-User authentication (login, register, verify)

-Product listings (buying/selling)

-Rental management

-In-app messaging

🎨🖥️ Frontend (React + Flowbite)

📌 Navigate to the frontend/ directory:

```sh 
cd frontend
```

📌 Install dependencies:

```sh 
npm install
```

📌 Start the React app:

```sh 
npm start
```

✅ The frontend allows:

-Users to register/login securely through Supabase

-Students to post and browse buy/sell/rent items

-Real-time in-app messaging between buyers and sellers

-Viewing of user profiles and item details

🔐 CREDENTIALS

```sh 
Admin Account:
Email: admin@buynabay.com
Password: admin123
```
---
```sh 
Student Seller Account:
Email: seller@gmail.com
Password: seller123
```
---
```sh 
Student Buyer Account:
Email: buyer@gmail.com
Password: buyer123
```

💬 CORE FEATURES 

| Feature                       | Description                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| 🛒 **Marketplace**            | Users can list pre-loved items for sale and browse others’ listings.                  |
| 🔄 **Renting System**         | Buyers can rent items from other users directly within the app.                       |
| 💬 **In-App Chat**            | Real-time communication between buyers and sellers using Supabase messages table.     |
| 👤 **User Profiles**          | Each user has a profile (editable avatar, name, school ID, etc.).                     |
| 🔐 **Custom Verification**    | Email verification with code confirmation via Firebase before activating the account. |
| ☁️ **Data Storage**           | Images and item info stored securely using Supabase Storage.                          |


🔧 TROUBLESHOOTING

-Ensure Node.js and npm are properly installed.

-If dependencies fail to load, delete the node_modules folder and re-run:

```sh 
npm install
```
-Check your Supabase URL and API key if backend requests fail.
-If the React app fails to start, ensure ports 3000 (frontend) and 5000 (backend) are not in use.

🧠 ABOUT BUYNABAY

BuyNaBay is a student-centered marketplace for the University of Science and Technology of Southern Philippines (USTP).
It aims to create a secure, organized, and user-friendly digital space where students can:

-Buy and sell second-hand items

-Rent materials or equipment for temporary use

-Chat directly with other students through in-app messaging

-Encourage sustainability through the reuse of goods within the campus

💡 TECHNOLOGY STACK

| Layer               | Technology                     | Description                                            |
| ------------------- | ------------------------------ | ------------------------------------------------------ |
| **Backend**         | Node.js (Express.js)           | Handles APIs, authentication, and Supabase integration |
| **Frontend**        | React                          | UI design, routing, and responsive components          |
| **Database**        | Supabase (PostgreSQL)          | Manages users, listings, messages, and rentals         |
| **Authentication**  | Firebase Auth                  | Secure login and registration                          |
| **Version Control** | Git / GitHub                   | Repository hosting and collaboration                   |
    
---
