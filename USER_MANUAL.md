# ShareLocal User Manual

Welcome to **ShareLocal**, a community-driven platform for sharing, borrowing, and donating items to reduce waste and build local connections.

---

## 1. Getting Started

### Authentication
- Click the **Login** button on the landing page.
- Sign in securely using your **Google Account** or **Email/Password**.
- **Tip:** When typing your password, use the **Eye Icon** in the input field to toggle visibility.
- Once signed in, you will be redirected to the Marketplace.

### Profile Setup
- Navigate to the **Profile** page from the sidebar.
- Update your location and biography.
- View your **Impact Score**, which increases as you share and donate items.

---

## 2. Core Features

### Marketplace & Resource Cards
- **Browse:** View all items currently available for rent (share) or for free (donate).
- **Security Deposit Badge:** Look for the green badge on item cards. This indicates the escrow amount required for high-value shares.
- **Protocol Reservation (Calendar Icon):** Many items feature a calendar icon. Click this to view the availability window and reserve the resource for specific future dates.
- **Filter:** Use the category chips (Electronics, Furniture, etc.) or search bar to find specific goods.
- **Requesting:** Click on an item to view details. Use the "Request to Borrow" or "Claim" buttons to start a conversation with the owner.

### Posting an Item
- Click **"Post Item"** in the sidebar.
- **Title & Category:** Give your item a clear name.
- **Type:** Choose "Share" if you want it back, or "Donate" if you are giving it away.
- **Images:** Upload photos (drag-and-drop or click to select).
- **Location:** Enter your general area so neighbors can find it.

### Map Explorer
- Switch to the **Map** view to see items plotted geographically.
- This is the fastest way to find tools or equipment within walking distance.

### Handover Hub & QR Protocol
The **Handover Hub** is your central terminal for managing physical item transfers.

- **Access:** Find the Handover Hub in the main sidebar or navigation menu.
- **Dual Path Approval Flow:**
  - **Path A (Lend/Rent):** If the item is a 'Share', approving the request triggers a **Security Deposit Hold**. The buyer receives a Pickup QR, and once scanned, the deposit is moved to escrow. Upon return, scan the 'Return' QR to trigger an automatic refund.
  - **Path B (Free Donation):** If listingType is 'Donate', the system completely **bypasses payment screens**. The Pickup QR immediately updates the status to 'Handed Over' with no escrow or returning logic required.
- **Pickup Verification:** Always present your Handover Token (QR) to your neighbor. They must scan it to confirm the resource has physically changed hands.
- **Escrow Release:** Deposits are automatically released back to the borrower's wallet the moment a return is verified via QR code.

---

## 3. Resilience & Network Status

**ShareLocal** is built for high availability. The platform automatically monitors the neural link to the community grid and adjusts its capabilities based on node health:

### 🛰 Establishing Grid Connection (Sky-Blue)
- **Status:** The local node is establishing a neural link to the community grid.
- **Experience:** You can browse existing listings, but write operations are queued until the link is stable.

### 🛰 Community Node Offline (Amber / Read-Only Mode)
- **Status:** The platform is in "Read-Only" mode during synchronization.
- **Browse-Only:** You can still browse the Marketplace and Map Explorer via the decentralized cache.
- **Write Restriction:** Posting new items or sending new requests is temporarily disabled to prevent data conflicts.

### 🛰 Invalid Neural Link Credentials (Rose-Red)
- **Status:** The system detected incorrect credentials in the environment configuration (`MONGODB_URI`).
- **Action:** If you are the node owner, please verify your database password in the platform settings.

### Temporary Guest Identity
- If you log in while the primary ledger is offline, you are assigned a **Temporary Community Node** identity.
- Your Profile will display a security alert notifying you that items and impact scores will be restored once the neural link is re-established.

---

## 4. Sustainable Impact

**ShareLocal** rewards community members through an **Impact Score**:
- **+10 Points:** Sharing an item for the first time.
- **+5 Points:** Successful completion of a borrow request.
- **+20 Points:** Donating an item to someone in need.

---

## 5. Technical Troubleshooting (For Owners)

### Intelligent Failure Handling
ShareLocal now handles database connection issues automatically:
- **503 Errors:** If the database is unreachable, API requests for writing data (POST/PUT/DELETE) will return a structured JSON error explaining the maintenance state.
- **Fallback Profiles:** The authentication middleware now uses JWT token metadata to populate user profiles when MongoDB is unavailable, preventing login loops.

### Manual Connection Recovery
If you see a "Database connection unavailable" error:
1. Log in to your **MongoDB Atlas** account.
2. Go to **Network Access** (under Security).
3. Click **Add IP Address**.
4. Select **"Allow Access From Anywhere"** (0.0.0.0/0). 
   *Note: This is required because the AI Studio cloud environment uses dynamic IP addresses.*
5. Ensure your `MONGODB_URI` in `.env` includes your correct username and password.

### Local Development
To run this app on your laptop:
1. Clone the repository.
2. Run `npm install`.
3. Create a `.env` file based on `.env.example`.
4. Run `npm run dev` to start the server and frontend.
