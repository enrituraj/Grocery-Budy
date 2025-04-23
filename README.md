# 🛒 Grocery Buddy

Grocery Buddy is a React Native (Expo) mobile app designed for students and roommates to manage shared grocery expenses efficiently. With group chat, expense splitting, and a collaborative to-do list, staying organized is now easier than ever.

---

## ✨ Features

- 👥 **Group Creation & Management**
  - Create or join grocery groups
  - View and manage group members

- 💬 **Group Chat**
  - Real-time chat within groups
  - Coordinate who buys what and when

- 💸 **Expense Splitting**
  - Add grocery expenses
  - Automatically split costs evenly per head
  - Assign who will pay
  - Track pending and completed payments

- ✅ **Shared Grocery To-Do List**
  - Maintain a grocery checklist within each group
  - Mark items as completed
  - Assign tasks to members

- 👤 **User Profiles**
  - Edit personal profile (name, avatar, etc.)
  - View other group members' profiles

- 🔐 **Authentication**
  - Firebase Authentication (Email & Password)
  - Secure login/signup system

- ☁️ **Firebase Backend**
  - Firebase Firestore for real-time data storage
  - Firebase Auth for user management

---

## 🛠️ Built With

- **React Native (Expo)**
- **Firebase (Firestore + Auth)**
- **React Navigation**
- **React Native Gifted Chat (or similar)** for messaging
- **Context API / Redux** for state management

---

## 📲 Getting Started

### Prerequisites

- Node.js
- Expo CLI
- Firebase Project Setup

### Installation

```bash
git clone https://github.com/enrituraj/Grocery-Budy.git
cd Grocery-Buddy
npm install
```

### Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable **Email/Password Authentication**
3. Create a Firestore database
4. Copy your Firebase config and add it to the project in a `firebase.js` file

### Run the App

```bash
npx expo start
```

Scan the QR code on your mobile device with the Expo Go app.

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request for improvements or new features.

---

## 📬 Contact

Feel free to reach out for feedback, ideas, or collaboration.
