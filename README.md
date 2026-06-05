# Audit Intelligence Portal

A professional audit tools dashboard with Firebase real-time sync.
**No credentials are stored in code.** Firebase config is entered at login time and held only in sessionStorage for that browser session.

---

## 🔐 Security Model

| Where | What is stored |
|-------|---------------|
| GitHub repo | Zero credentials. Safe to make public. |
| sessionStorage | Firebase config for current tab only. Cleared on tab close. |
| localStorage (opt-in) | Obfuscated config only if user ticks "Remember on this device". |
| Firebase Firestore | Card metadata (names, URLs, categories). No secrets. |

---

## 🚀 Deploy to GitHub Pages

```bash
git init
git add .
git commit -m "Launch audit portal"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Then in GitHub → **Settings → Pages → Deploy from branch → main → / (root)**

Your portal: `https://YOUR_USERNAME.github.io/YOUR_REPO/login.html`

---

## 🔑 How Login Works

1. Open the portal URL — you land on **login.html**
2. Enter your Firebase credentials (3 ways):
   - **Manual Entry** — paste each field individually
   - **Paste Config** — paste the entire `firebaseConfig = { … }` block from Firebase Console
   - **Saved** — one-click reconnect if you've saved previously
3. The portal validates the credentials by doing a test Firestore read
4. On success, config is stored in `sessionStorage` only and you're redirected to the dashboard
5. Closing the tab clears the session — next visit requires login again

---

## 📁 Project Structure

```
audit-dashboard/
├── login.html              # Secure login / Firebase config entry
├── index.html              # Main dashboard
├── css/dashboard.css       # All styles
├── js/app.js               # Core logic, Firebase sync, CRUD
├── cards/
│   ├── sample-risk-checklist.html
│   └── your-tool.html      # Add audit tools here
└── README.md
```

---

## ➕ Adding Audit Tool Cards

1. Upload your `tool.html` to the `cards/` folder on GitHub
2. On the dashboard, click **⚙ Settings** → fill in card details
3. Set **HTML File Path** to `cards/tool.html`
4. Click **Add Card** — syncs to Firebase instantly

---

## 🔄 Updating a Card

Settings → find card → **✎ Edit** → update version, URL, changelog → **Save**

---

## 🛡️ Firebase Firestore Rules (recommended)

Start in test mode. For production, restrict to authenticated users:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /audit_cards/{doc} {
      allow read, write: if true; // tighten after testing
    }
  }
}
```

---

*Zero credentials in code · sessionStorage only · GitHub Pages ready*
