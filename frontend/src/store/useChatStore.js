import { create } from "zustand";
import toast from "react-hot-toast";

import { useAuthStore } from "./useAuthStore";

import {
  getUsersList,
  getMessagesWithUser,
  sendMessageToUser,
} from "../lib/directusAdapter.js";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const users = await getUsersList();
      const authUser = useAuthStore.getState().authUser;
      const filteredUsers = users.filter((user) => user._id !== authUser?._id);
      set({ users: filteredUsers });
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Failed to load users");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const authUser = useAuthStore.getState().authUser;
      const messages = await getMessagesWithUser(authUser._id, userId);
      set({ messages });
    } catch (error) {
      toast.error(error.response?.data?.messages || error.message || "Failed to load messages");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      const authUser = useAuthStore.getState().authUser;
      const newMessage = await sendMessageToUser(authUser._id, selectedUser._id, messageData);
      set({ messages: [...messages, newMessage] });
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Failed to send message");
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;

    socket.on("newMessage", (newMessage) => {
      const isMessageSentMesageFromSelectedUser = newMessage.senderId === selectedUser._id;
      if (!isMessageSentMesageFromSelectedUser) return;
      set({ messages: [...get().messages, newMessage] });
    });
  },

  unsubscribeFromMessage: () => {
    const socket = useAuthStore.getState().socket;
    socket.off("newMessage");
  },

  setSelectedUser: (selectedUser) => set({ selectedUser }),
}));
