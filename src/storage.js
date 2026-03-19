const KEYS = {
  users: "the-terminal.users.v1",
  session: "the-terminal.session.v1",
  userStatePrefix: "the-terminal.user-state.v1",
};

function safeParse(rawValue, fallbackValue) {
  if (!rawValue) {
    return fallbackValue;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return fallbackValue;
  }
}

export function loadJson(key, fallbackValue) {
  return safeParse(window.localStorage.getItem(key), fallbackValue);
}

export function saveJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getUsers() {
  return loadJson(KEYS.users, []);
}

export function saveUsers(users) {
  saveJson(KEYS.users, users);
}

export function getSession() {
  return loadJson(KEYS.session, null);
}

export function saveSession(session) {
  saveJson(KEYS.session, session);
}

export function clearSession() {
  window.localStorage.removeItem(KEYS.session);
}

export function getUserStateKey(userId) {
  return `${KEYS.userStatePrefix}.${userId}`;
}

export function buildDefaultUserState(seed = {}) {
  return {
    watchlist: seed.watchlist ?? ["AAPL", "MSFT", "NVDA", "QQQ", "BTC-USD", "PLTR"],
    alerts: seed.alerts ?? [],
    positions: seed.positions ?? [],
    panelModules: seed.panelModules ?? { 1: "home", 2: "quote", 3: "chart", 4: "news" },
    panelSymbols: seed.panelSymbols ?? { 1: "NVDA", 2: "AAPL", 3: "MSFT", 4: "QQQ" },
    commandHistory: seed.commandHistory ?? [],
    layoutMode: seed.layoutMode ?? "quad",
    createdAt: seed.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function getUserState(userId, seed = {}) {
  const key = getUserStateKey(userId);
  const stored = loadJson(key, null);
  return buildDefaultUserState({ ...seed, ...(stored ?? {}) });
}

export function saveUserState(userId, state) {
  const key = getUserStateKey(userId);
  saveJson(key, {
    ...state,
    updatedAt: new Date().toISOString(),
  });
}
