# ShareCycle: Neighborhood Resource Sharing App

ShareCycle is a peer-to-peer resource sharing platform designed to foster community sustainability. It allows neighbors to list items for borrow, swap, or giveaway, coordinating through a real-time messaging system and map-based explorer.

## 🚀 Features

- **Real-time Map Explorer**: Find resources in your physical neighborhood.
- **Resource Broadcasting**: Easily list items with images and expiration dates.
- **Neighborhood Trust Ledger**: A decentralized escrow system to secure high-value items. Deposits are held in escrow and automatically refunded upon successful verified return.
- **QR Handover Protocol (Handover Hub)**: Centralized terminal for secure physical resource exchange using dual-token QR verification. Now features a dedicated **Handover Hub** for managing active transfers and returns.
- **Dual Path Approval Flow**: Intelligent branching for coordination cycles.
    - **Path A (Lend)**: Automatically triggers the Neighborhood Escrow protocol for security deposits.
    - **Path B (Donate)**: Completely bypasses payment and deposit screens for 100% free community donations.
- **Protocol Reservation**: A date-based locking system (via the Calendar icon) that allows users to reserve resources for specific time windows, preventing coordination overlaps.
- **Visual Trust Indicators**: Item cards now display clear **Security Deposit Badges**, providing immediate financial transparency before initiating a request.
- **Automated Neighborhood Escrow**: Integrated security deposits that are automatically released and refunded to the borrower upon verified return of the item.
- **Resilient Architecture**: Automated three-tier maintenance system (Connecting, Read-Only, and Auth-Alert) with fallback authentication for high availability.

---

## 🛰 Status Resilience Modes & Troubleshooting

If you encounter a **403 User Sync Error** or a **MongoDB Authentication Failure**, please verify the following:

1. **MONGODB_URI Format**: Ensure your MongoDB connection string is correctly encoded. If your password contains special characters (like `@`, `:`, `/`, `+`), they MUST be URL-encoded (e.g., `@` becomes `%40`).
2. **Access Control**: Ensure the MongoDB user has `readWrite` permissions on the database.
3. **Connectivity**: If the "Neural Link" status in the app says "Auth Alert", the application is running in read-only mode because it cannot verify your account against the node ledger. Update your credentials in the Settings menu then restart the server.

| Status View | Color | Meaning | Capability |
| :--- | :--- | :--- | :--- |
| **Grid Connection** | Sky Blue | Establishing neural link to the grid | Attempting to connect; browsing allowed. |
| **Node Offline** | Amber | synchronization in progress | Read-only mode active; Browsing allowed; Writes disabled. |
| **Auth Alert** | Rose Red | Invalid MONGODB_URI/Auth | Database credentials rejected; Check environment configs. |
| **Grid Online** | Aqua | Full connection established | All features (including writes and messages) active. |

---

## 🛠 Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS 4, Motion (Animations), Lucide Icons.
- **Backend**: Node.js, Express, Socket.io, JWT.
- **Database**: MongoDB (Mongoose ODM).
- **Authentication**: Firebase Authentication.

---

## 💻 Local Setup & Execution

Follow these steps to get the project running on your local machine.

### 1. Prerequisites
- **Node.js**: [LTS Version](https://nodejs.org/) (v18+ recommended).
- **MongoDB**: A local instance or a [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster.
- **Firebase Project**: Create one at the [Firebase Console](https://console.firebase.google.com/).

### 2. Installation
Clone the repository and install dependencies:
```bash
npm install
```

### 3. Environment Configuration
You need to set up your private environment variables. Create a `.env` file in the root directory:

```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secure_random_string
GEMINI_API_KEY=your_gemini_api_key (optional)
```

### 4. Firebase Configuration
Create a `firebase-applet-config.json` file in the root directory with your Firebase Web App credentials:
```json
{
  "apiKey": "...",
  "authDomain": "...",
  "projectId": "...",
  "storageBucket": "...",
  "messagingSenderId": "...",
  "appId": "..."
}
```

### 5. Running the App

#### Development Mode (Frontend + Backend)
```bash
npm run dev
```
The app will be available at `http://localhost:3000`.

#### Production Build
```bash
# Build the project
npm run build

# Start the production server
npm run start
```

---

## 📂 Project Structure

- `/src`: React frontend application.
- `/server`: Express API routes and database models.
- `server.ts`: Main entry point (Express + Vite Middleware).

---

## 🔒 Security & Privacy

**Important for GitHub contributors:** 
The following files are ignored via `.gitignore` and should **NEVER** be committed to public repositories:
- `.env`: Contains your MongoDB credentials and secret keys.
- `firebase-applet-config.json`: Contains your Firebase project keys.
- `node_modules/`: Dependency binaries.

---

## 🤝 Contributing
Contributions are what make the open-source community an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.
