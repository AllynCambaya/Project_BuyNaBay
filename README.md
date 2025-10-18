🛍️ BUY NA BAY: CAMPUS BUY-AND-SELL & RENTAL PLATFORM FOR USTP STUDENTS
--------------------------------------------------------------
A web application using Node.js as the backend and React with Flowbite for the frontend design and components.
BuyNaBay provides a centralized platform where USTP students can buy, sell, or rent pre-loved items within their campus community — promoting convenience, sustainability, and student engagement.

📂 PROJECT STRUCTURE
--------------------------------------------------------------
```
BuyNaBay/
│── backend/       # Node.js Backend (API & Database Integration)
│
│── frontend/      # React Frontend (User Interface built with Flowbite)
│
│── README.md      # Project Overview
```

---


🛠️ PRE-REQUISITES

Before running this project, make sure you have the following installed:

Node.js (v14+ recommended): https://nodejs.org/

Git (for version control): https://git-scm.com/downloads

Supabase Account (for database & authentication): https://supabase.com/

⚙️📦 Backend (Node.js + Supabase)

📌 Navigate to the backend/ directory:

cd backend


📌 Install dependencies:

npm install


📌 Create an .env file inside backend/ and add your Supabase credentials:

SUPABASE_URL=https://ktezclohitsiegzhhhgo.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0ZXpjbG9oaXRzaWVnemhoaGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMwMjkxNDIsImV4cCI6MjA0ODYwNTE0Mn0.iAMC6qmEzBO-ybtLj9lQLxkrWMddippN6vsGYfmMAjQ


📌 Run the server:

node index.js


✅ The backend provides RESTful APIs for:

User authentication (login, register, verify)

Product listings (buying/selling)

Rental management

In-app messaging

🎨🖥️ Frontend (React + Flowbite)

📌 Navigate to the frontend/ directory:

cd frontend


📌 Install dependencies:

npm install


📌 Start the React app:

npm start


✅ The frontend allows:

Users to register/login securely through Supabase

Students to post and browse buy/sell/rent items

Real-time in-app messaging between buyers and sellers

Viewing of user profiles and item details

🔐 DEFAULT TEST ACCOUNTS
Admin Account:
Email: admin@buynabay.com
Password: admin123

Student Seller Account:
Email: seller@gmail.com
Password: seller123

Student Buyer Account:
Email: buyer@gmail.com
Password: buyer123

🔧 TROUBLESHOOTING

Ensure Node.js and npm are properly installed.

If dependencies fail to load, delete the node_modules folder and re-run:

npm install


Check your Supabase URL and API key if backend requests fail.

If the React app fails to start, ensure ports 3000 (frontend) and 5000 (backend) are not in use.

🧠 ABOUT BUYNABAY

BuyNaBay is a student-centered marketplace for the University of Science and Technology of Southern Philippines (USTP).
It aims to create a secure, organized, and user-friendly digital space where students can:

Buy and sell second-hand items

Rent materials or equipment for temporary use

Chat directly with other students through in-app messaging

Encourage sustainability through the reuse of goods within the campus
