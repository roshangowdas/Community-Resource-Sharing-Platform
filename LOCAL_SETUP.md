# Local Setup & Firebase Configuration

To resolve all Firebase errors when running this project locally in VS Code, follow these steps:

## 1. Enable Email/Password Authentication
If you see the error `auth/operation-not-allowed`:
1. Go to your [Firebase Console](https://console.firebase.google.com/).
2. Select your project.
3. Click on **Authentication** in the left sidebar.
4. Go to the **Sign-in method** tab.
5. Click **Add new provider** and select **Email/Password**.
6. **Enable** it and save.

## 2. Authorize Localhost for Google Login
If Google Login fails or says "Domain not authorized":
1. In the **Authentication** section of Firebase Console.
2. Go to the **Settings** tab.
3. Select **Authorized domains**.
4. Click **Add domain** and enter `localhost`.

## 3. Verify Your Configuration
Ensure your `firebase-applet-config.json` file in the root directory contains the correct credentials for your Firebase project.

## 4. Environment Variables
The `.env` file **must be created in the same folder as `.env.example`** (the root directory of the project). 

Make sure your `.env` file contains:
```env
MONGODB_URI=your_mongodb_connection_string
PORT=3000
GEMINI_API_KEY=your_actual_gemini_api_key_here
FIREBASE_SERVICE_ACCOUNT='{"type": "service_account", "project_id": "...", ...}'
```

## 5. Troubleshooting Authentication Errors

### "Invalid credentials. Verification failed."
If you see this error while logging in:
1. **You might not have an account yet**: Even if you used this app in AI Studio, your local run uses the same Firebase project but you might need to register the user again if you are switching environments or using a different email.
2. **Try Registering**: Click the **"Register now"** link at the bottom of the login page and create a new account with your email and password.
3. **Check Firebase Console**: Go to the **Authentication > Users** tab in your Firebase Console to verify if your email exists there.

### "Token is not valid" when posting or uploading
This is usually caused by the Server (running locally) not having permission to verify the login tokens from Google/Firebase.
1. **Get a Service Account Key**:
   - Go to [Firebase Console](https://console.firebase.google.com/).
   - Click the gear icon (Project Settings) > **Service accounts**.
   - Click **Generate new private key**.
   - Download the JSON file.
2. **Add to `.env`**:
   - Open the downloaded JSON file.
   - Copy the *entire* content.
   - In your `.env` file, add: `FIREBASE_SERVICE_ACCOUNT='paste_the_entire_json_here'` (keep it on one line or make sure it's wrapped in quotes).
3. **Restart your server**: `npm run dev`.

### MongoDB Connection Issues
If you see "Database connection failure" in the browser or "MongoDB connection error" in your VS Code terminal:
1. **Check `.env` file**: 
   - Ensure the `MONGODB_URI` variable is exactly correctly named and contains your connection string from MongoDB Atlas.
   - It should look like: `MONGODB_URI=mongodb+srv://username:password@cluster.abcde.mongodb.net/database_name?retryWrites=true&w=majority`
2. **Whitelist your IP address**:
   - Go to your [MongoDB Atlas Dashboard](https://cloud.mongodb.com/).
   - Go to **Security > Network Access**.
   - Click **Add IP Address**.
   - Choose **Add Current IP Address** or **Allow Access From Anywhere** (0.0.0.0/0) if you are traveling or have a dynamic IP.
3. **Database User Permissions**:
   - Go to **Security > Database Access**.
   - Ensure your database user has "Read and write to any database" permissions.
4. **Network Restrictions**:
   - If you are on a corporate or restricted network, port `27017` (default MongoDB port) might be blocked. Try a different network or use a VPN if necessary.
5. **Install Dependencies**:
   - Run `npm install` just in case some local binaries are missing.

## 6. Gemini API Key
This project is configured to use the Gemini AI API via `process.env.GEMINI_API_KEY`.
- At runtime in AI Studio, this is handled automatically.
- Locally in VS Code, you should add your own key to a `.env` file:
  `GEMINI_API_KEY=your_actual_gemini_api_key_here`
- You can get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

## 7. Running the Project
1. Install dependencies: `npm install`
2. Run the developer server: `npm run dev`
3. The app will be available at `http://localhost:3000`
