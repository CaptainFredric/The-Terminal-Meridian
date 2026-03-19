import {
  buildDefaultUserState,
  clearSession,
  getSession,
  getUserState,
  getUsers,
  saveSession,
  saveUserState,
  saveUsers,
} from "./storage.js";

function normalizeIdentifier(value) {
  return value.trim().toLowerCase();
}

function generateId() {
  return `usr_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function createAccount(payload) {
  const users = getUsers();
  const username = payload.username.trim();
  const email = payload.email.trim().toLowerCase();

  if (users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
    throw new Error("Username already exists.");
  }

  if (users.some((user) => user.email.toLowerCase() === email)) {
    throw new Error("Email already exists.");
  }

  const passwordHash = await hashPassword(payload.password);
  const user = {
    id: generateId(),
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    email,
    username,
    role: payload.role,
    createdAt: new Date().toISOString(),
    passwordHash,
  };

  users.push(user);
  saveUsers(users);
  saveUserState(user.id, buildDefaultUserState());
  saveSession({ userId: user.id, createdAt: new Date().toISOString() });

  return { ...user, passwordHash: undefined };
}

export async function login(payload) {
  const users = getUsers();
  const identifier = normalizeIdentifier(payload.identifier);
  const user = users.find((item) => item.username.toLowerCase() === identifier || item.email.toLowerCase() === identifier);

  if (!user) {
    throw new Error("Account not found.");
  }

  const passwordHash = await hashPassword(payload.password);
  if (passwordHash != user.passwordHash) {
    throw new Error("Incorrect password.");
  }

  saveSession({ userId: user.id, createdAt: new Date().toISOString() });
  return { ...user, passwordHash: undefined };
}

export function logout() {
  clearSession();
}

export function restoreSessionUser() {
  const session = getSession();
  if (!session?.userId) {
    return null;
  }

  const user = getUsers().find((item) => item.id === session.userId);
  if (!user) {
    clearSession();
    return null;
  }

  return { ...user, passwordHash: undefined, state: getUserState(user.id) };
}
