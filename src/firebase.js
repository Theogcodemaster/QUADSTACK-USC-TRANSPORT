import { initializeApp } from 'firebase/app'
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyBw6w3S8RU3W78O8s-cDbJ5oQk8xGxjnBA',
  authDomain: 'transp-31dcd.firebaseapp.com',
  projectId: 'transp-31dcd',
  storageBucket: 'transp-31dcd.firebasestorage.app',
  messagingSenderId: '1098717633107',
  appId: '1:1098717633107:web:f2cb3db6216d166ad7c4a6',
  measurementId: 'G-BNP5JWBSZB',
}

const app = initializeApp(firebaseConfig)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() })
})
export const auth = getAuth(app)
