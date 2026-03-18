import { createContext, useContext, useState, useEffect } from 'react';
import {
  getUsers, saveUsers, getCurrentUser, saveCurrentUser, clearCurrentUser,
} from '../utils/localStorage';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());

  const signup = (username, email, password) => {
    const users = getUsers();
    if (users.find((u) => u.email === email)) {
      return { success: false, message: 'Email already registered.' };
    }
    const newUser = { username, email, password };
    saveUsers([...users, newUser]);
    saveCurrentUser(newUser);
    setCurrentUser(newUser);
    return { success: true };
  };

  const login = (email, password) => {
    const users = getUsers();
    const user = users.find((u) => u.email === email && u.password === password);
    if (!user) return { success: false, message: 'Invalid email or password.' };
    saveCurrentUser(user);
    setCurrentUser(user);
    return { success: true };
  };

  const logout = () => {
    clearCurrentUser();
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
