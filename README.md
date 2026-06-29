# SportPrice Tracker (Dynamic Sportswear Aggregator)

SportPrice Tracker is a full-stack web application designed to help users track, compare, and monitor the prices of sportswear and equipment across major Malaysian retail platforms such as Al-Ikhsan, Sports Direct, and Original Classic. 

The system features real-time web scraping, price history visualization, and an automated background worker that alerts users via Email or Telegram when prices drop to their targeted threshold.

## 🚀 Features

- **Real-Time Price Comparison**: Instantly search and compare prices from multiple retailers simultaneously.
- **Automated Price Alerts**: Set a "Target Price" and receive automatic notifications via Email or Telegram when the price drops.
- **Price History & Trends**: Visualize historical price changes using interactive charts (powered by Chart.js).
- **Personalized Watchlist**: Save your favorite items to track their availability and current prices.
- **Smart Categorization**: Automatically categorizes items (Footwear, Apparel, Accessories) using localized keyword detection.
- **Admin Control Panel**: View scraping statistics, manage registered users, and manually toggle specific stores for maintenance.
- **Authentication**: Secure user login, registration, and profile management using Firebase Authentication.

## 💻 Tech Stack

**Frontend:**
- React.js (Vite)
- Vanilla CSS (Glassmorphism & modern UI patterns)
- Lucide React (Icons)
- Chart.js & react-chartjs-2 (Data Visualization)
- React Router DOM (Routing)

**Backend:**
- Node.js & Express.js
- Cheerio (Web Scraping / HTML Parsing)
- Axios (HTTP Requests)
- Nodemailer (Email Notifications)
- Telegram Bot API (Telegram Notifications)

**Database & Auth:**
- Firebase Firestore (NoSQL Database)
- Firebase Authentication

**Third-Party Services:**
- ScraperAPI (Proxy routing & JS Rendering to bypass anti-bot restrictions)

## 📊 Core System Logics & Technical Decisions

### 1. 30-Day Price Trend Tracking
- **Initial Tracking**: The price history graph begins recording exactly when a user clicks the "Compare Price" button for a specific product. This is recorded on the client-side (`recordPriceSnapshot`) to ensure instant feedback.
- **Background Auto-Tracking**: Once an item is stored in the Watchlist or Price Alerts, the backend cron worker will automatically scrape its specific URL daily and save the updated prices to Firestore.
- **Firestore Composite Index Bypass**: To circumvent the need for mandatory composite indexing in Firestore (which typically causes silent `getDocs` errors when querying `productId` alongside a `createdAt` date range), the system fetches all records for the `productId` and dynamically filters the 30-day date range in-memory (client-side JavaScript).

### 2. Live Price Comparison vs Historical Graph
- **Live Price Comparison**: The comparison table acts as a real-time agent. It actively searches alternative retailers (e.g., Al-Ikhsan vs Sports Direct) and displays current market alternatives. It uses `Promise.allSettled` to fetch sizes asynchronously without causing race conditions.
- **Historical Graph**: The graph intentionally tracks ONLY the specific source/retailer URL the user originally clicked from the Home page. It does *not* mix prices from different retailers into a single graph to prevent erratic price zigzagging, maintaining clear data integrity for that specific store's pricing trend.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v16.x or higher)
- [npm](https://www.npmjs.com/) (usually comes with Node.js)
- A Firebase Project (with Firestore and Authentication enabled)
- A [ScraperAPI](https://www.scraperapi.com/) account
- A Gmail account for Nodemailer (App Passwords enabled)
- A Telegram Bot Token (from BotFather)

## ⚙️ Installation & Setup

1. **Clone the repository (or download the source code):**
   ```bash
   git clone https://github.com/yourusername/sportprice-tracker.git
   cd sportprice-tracker
   ```

2. **Install Frontend Dependencies:**
   ```bash
   npm install
   ```

3. **Install Backend Dependencies:**
   ```bash
   cd sportprice-backend
   npm install
   ```

## 🔐 Environment Variables

Create a `.env` file inside the `sportprice-backend` folder with the following credentials:

```env
# Scraper API Key
SCRAPER_API_KEY=your_scraperapi_key_here

# Firebase Admin SDK Credentials
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY="your_private_key_with_\n"

# Nodemailer Credentials (Email Alert)
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password

# Telegram Bot Token (Telegram Alert)
TELEGRAM_TOKEN=your_telegram_bot_token
```

*Note: For the frontend, you will need to replace the Firebase configuration inside `src/firebase.js` with your own Firebase Web config.*

## ▶️ Running the Project

You will need to run both the Frontend and the Backend servers concurrently.

**1. Start the Backend Server (Scraper & Alert Worker):**
```bash
cd sportprice-backend
node server.js
# The backend will run on http://localhost:5000
```

**2. Start the Frontend Application:**
Open a new terminal window/tab:
```bash
cd sportprice-tracker
npm run dev
# The frontend will run on http://localhost:5173
```

## 📂 Project Architecture

```text
sportprice-tracker/
├── src/
│   ├── components/      # Reusable UI components (Navbar, ProtectedRoute)
│   ├── pages/           # Main pages (Home, Dashboard, Watchlist, Auth, etc.)
│   ├── firebase.js      # Firebase client initialization
│   ├── App.jsx          # React Router setup
│   └── index.css        # Global CSS & Design System
├── sportprice-backend/
│   ├── server.js        # Main Express server, scraping logic, & background worker
│   ├── .env             # Backend secrets
│   └── package.json     # Backend dependencies
└── README.md            # Project documentation
```

## 🤝 Contribution
Feel free to fork this project and submit pull requests. For major changes, please open an issue first to discuss what you would like to change.
