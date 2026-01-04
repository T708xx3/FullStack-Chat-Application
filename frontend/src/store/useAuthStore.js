import { create } from "zustand";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

import {
  authLogin,
  authRegister,
  authCheck,
  authLogout,
  updateProfile as adapterUpdateProfile,
  setDirectusAuthToken
} from "../lib/directusAdapter.js";

const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:5001" : "/";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,

  checkAuth: async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      set({ authUser: null, isCheckingAuth: false });
      return;
    }
    try {
      // set token for directus axios
      setDirectusAuthToken(token);
      const user = await authCheck();
      set({ authUser: user });
      get().connectSocket();
    } catch (error) {
      console.log("Error in checkAuth:", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const { token, user } = await authRegister(data);
      set({ authUser: user });
      toast.success("Account created successfully");
      get().connectSocket();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || error.message || "An error occurred");
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const { token, user } = await authLogin(data);
      set({ authUser: user });
      toast.success("Logged in successfully");
      get().connectSocket();
    } catch (error) {
      console.error("Login error:", error);
      toast.error(error.response?.data?.message || error.message || "An error occured");
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await authLogout();
      set({ authUser: null });
      toast.success("Logged out successfully");
      get().disconnectSocket();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "An error occurred");
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const updated = await adapterUpdateProfile(get().authUser._id, data);
      set({ authUser: updated });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.log("error in update profile:", error);
      toast.error(error.response?.data?.message || error.message || "error occured");
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  connectSocket: () => {
    const { authUser } = get();
    if (!authUser || get().socket?.connected) return;

    const socket = io(BASE_URL, {
      query: {
        userId: authUser._id,
      },
    });
    socket.connect();
    set({ socket: socket });
    socket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });
  },

  disconnectSocket: () => {
    const socket = get().socket;
    if (!socket) return;
    socket.disconnect();
    set({ socket: null, onlineUsers: [] });
  },
}));
