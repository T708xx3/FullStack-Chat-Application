// Adapter that exposes the same high-level functions your frontend expects,
// but implemented against a Directus REST API and mapping shapes to the frontend.

import { directusAxios, setDirectusAuthToken } from "./directusAxios";

// Utility: map Directus user -> frontend shaped user (keeps _id to reduce UI changes)
function mapUser(directusUser) {
  if (!directusUser) return null;
  // directus returns { data: { id, email, first_name, last_name, ... } } when using /users/me
  const u = directusUser?.data?.data || directusUser?.data || directusUser;
  return {
    _id: u.id,
    email: u.email,
    username: u.username || `${u.first_name || ""} ${u.last_name || ""}`.trim(),
    displayName: u.display_name || u.first_name || u.username,
    raw: u, // keep full data if needed
  };
}

// AUTH
export async function authLogin({ email, password }) {
  // POST /auth/login
  const res = await directusAxios.post("/auth/login", { email, password });
  const token = res.data?.data?.access_token || res.data?.data?.token || res.data?.data;
  if (!token) throw new Error("No token from Directus login");
  setDirectusAuthToken(token);

  // fetch user info
  const me = await directusAxios.get("/users/me");
  return { token, user: mapUser(me) };
}

export async function authRegister(payload) {
  // Directus registration: POST /auth/register
  const res = await directusAxios.post("/auth/register", payload);
  const token = res.data?.data?.access_token || res.data?.data?.token || res.data?.data;
  if (token) setDirectusAuthToken(token);

  // fetch profile/user
  const me = await directusAxios.get("/users/me");
  return { token, user: mapUser(me) };
}

export async function authCheck() {
  // GET /users/me using token already set in directusAxios
  const me = await directusAxios.get("/users/me");
  return mapUser(me);
}

export async function authLogout() {
  // POST /auth/logout
  try {
    await directusAxios.post("/auth/logout");
  } finally {
    setDirectusAuthToken(null);
  }
}

export async function updateProfile(userId, payload) {
  // Update user record fields (you might store UI fields on a profiles collection instead)
  const res = await directusAxios.patch(`/users/${userId}`, payload);
  const me = await directusAxios.get("/users/me");
  return mapUser(me);
}

// USERS for sidebar
export async function getUsersList() {
  // Returns other users (map to frontend _id)
  // Request a few fields to reduce payload
  const res = await directusAxios.get("/users?fields=id,email,first_name,last_name,display_name");
  const results = (res.data?.data || []);
  return results.map((u) => ({
    _id: u.id,
    email: u.email,
    username: u.display_name || `${u.first_name || ""} ${u.last_name || ""}`.trim(),
    raw: u,
  }));
}

// CONVERSATIONS & MESSAGES
// Helper: find or create a 1:1 conversation for two user ids
export async function findOrCreateDirectConversation(currentUserId, otherUserId) {
  // Attempt to find conversation that contains both participants.
  // Note: Directus filter syntax may vary by setup; you might need to tune this filter.
  // Here we attempt to find conversations where participants contains both user ids.
  const filter = {
    "filter[participants][_contains]": `[${currentUserId}]`,
    "filter[participants][_contains]": `[${otherUserId}]`,
    limit: 1,
  };

  // Because identical keys above would collide, perform a simple all-conversations fetch for one-to-one chats.
  // A more robust method: add a deterministic "slug" (e.g., minId_maxId) when creating conversation and query by slug.

  // First try a slug approach: deterministic slug
  const slug = [currentUserId, otherUserId].sort().join("_");
  const bySlug = await directusAxios.get(`/items/conversations?filter[slug][_eq]=${encodeURIComponent(slug)}&limit=1`);
  if (bySlug.data?.data?.length) return bySlug.data.data[0];

  // If not found, create the conversation
  const createRes = await directusAxios.post("/items/conversations", {
    data: {
      slug,
      is_direct: true,
      participants: [currentUserId, otherUserId],
    },
  });
  return createRes.data.data;
}

function mapMessageItem(item) {
  // Directus message item shape assumed: { id, content, sender, conversation, created_on }
  return {
    _id: item.id,
    content: item.content,
    senderId: item.sender,
    conversationId: item.conversation,
    createdAt: item.created_on,
    raw: item,
  };
}

export async function getMessagesWithUser(currentUserId, otherUserId) {
  // Find conversation and fetch its messages
  // If no conversation exists, return []
  // We rely on slug approach to find conversation
  const slug = [currentUserId, otherUserId].sort().join("_");
  const convRes = await directusAxios.get(`/items/conversations?filter[slug][_eq]=${encodeURIComponent(slug)}&limit=1`);
  const conv = convRes.data?.data?.[0];
  if (!conv) return [];

  // fetch messages for conversation, sorted asc
  const msgRes = await directusAxios.get(`/items/messages?filter[conversation][_eq]=${conv.id}&sort=created_on`);
  const msgs = msgRes.data?.data || [];
  return msgs.map(mapMessageItem);
}

export async function sendMessageToUser(currentUserId, otherUserId, messageData) {
  // Ensure conversation exists
  const conv = await findOrCreateDirectConversation(currentUserId, otherUserId);
  // Create message
  const body = {
    data: {
      content: messageData.content,
      sender: currentUserId,
      conversation: conv.id,
    },
  };
  const res = await directusAxios.post("/items/messages", body);
  const created = res.data?.data;
  return mapMessageItem(created);
}
