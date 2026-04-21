/**
 * SettingsRenderer — full settings panel for the Meridian workspace.
 *
 * Registered in the module registry as "settings" so users can open it as
 * a panel view.  All form submissions are delegated to AppBootstrap's
 * existing auth/settings handlers via custom events.
 */

export function createSettingsRenderer(context) {
  const { state } = context;

  return function renderSettings() {
    const user = state.user;
    const tier = state.subscription?.tier || "free";
    const status = state.subscription?.status;
    const isPro = tier === "pro" || tier === "pro_plus";
    const isProPlus = tier === "pro_plus";
    const tierLabel = isProPlus ? "PRO+" : isPro ? "PRO" : "FREE";
    const tierClass = isProPlus ? "tier-pro-plus" : isPro ? "tier-pro" : "tier-free";
    const statusText = status && status !== "active" ? ` · ${status}` : "";

    // ── Theme grid ──────────────────────────────────────────────────────────
    const themeOptions = [
      { key: "dark",      label: "Cosmic Dark",   desc: "Default · cool blue",    swatch: "theme-swatch-dark" },
      { key: "bloomberg", label: "Bloomberg",      desc: "Pure black · amber",     swatch: "theme-swatch-bloomberg" },
      { key: "synthwave", label: "Synthwave",      desc: "Deep purple · neon",     swatch: "theme-swatch-synthwave" },
      { key: "emerald",   label: "Emerald",        desc: "Forest · gold accents",  swatch: "theme-swatch-emerald" },
      { key: "paper",     label: "Paper",          desc: "Light · daytime work",   swatch: "theme-swatch-paper" },
      { key: "midnight",  label: "Midnight",       desc: "Deep navy · electric",   swatch: "theme-swatch-midnight" },
      { key: "crimson",   label: "Crimson",        desc: "Dark wine · deep red",   swatch: "theme-swatch-crimson" },
      { key: "slate",     label: "Slate",          desc: "Steel blue · cool gray", swatch: "theme-swatch-slate" },
      { key: "amber",     label: "Amber",          desc: "Warm honey · dark gold", swatch: "theme-swatch-amber" },
    ];
    const currentTheme = document.documentElement.dataset.theme || "dark";
    const themeGrid = themeOptions.map(({ key, label, desc, swatch }) =>
      `<button class="theme-option${currentTheme === key ? " is-active" : ""}" type="button" data-theme-set="${key}">
        <span class="theme-swatch ${swatch}"></span>
        <strong>${label}</strong>
        <small>${desc}</small>
      </button>`
    ).join("");

    // ── Account section ──────────────────────────────────────────────────────
    let accountSection;
    if (user) {
      // Use camelCase property names as stored in state.user
      const firstName = user.firstName || "";
      const lastName = user.lastName || "";
      const displayName = (firstName + " " + lastName).trim() || user.username || "Account";
      const avatarLetter = (firstName[0] || user.username?.[0] || "?").toUpperCase();

      accountSection = `
        <div class="settings-panel-user">
          <div class="settings-avatar">${avatarLetter}</div>
          <div class="settings-user-info">
            <strong>${displayName}</strong>
            <small>${user.email || ""}</small>
            <small class="settings-username">@${user.username || "—"} · ${user.role || "Trader"}</small>
          </div>
          <span class="settings-tier-badge ${tierClass}">${tierLabel}${statusText}</span>
        </div>
        <div class="settings-section-row">
          <button class="btn btn-sm btn-ghost" data-settings-action="edit-profile">Edit Profile</button>
          <button class="btn btn-sm btn-ghost" data-settings-action="change-password">Change Password</button>
          ${isPro ? `<button class="btn btn-sm btn-ghost" data-settings-action="manage-billing">Manage Billing</button>` : ""}
          ${!isPro ? `<button class="btn btn-sm btn-primary" data-settings-action="upgrade">Upgrade to Pro</button>` : ""}
        </div>`;
    } else {
      accountSection = `
        <div class="settings-panel-guest">
          <p class="settings-guest-msg">Sign in to sync your workspace, alerts, and watchlist across all devices.</p>
          <div class="settings-section-row">
            <button class="btn btn-sm btn-primary" data-settings-action="sign-in">Sign in</button>
            <button class="btn btn-sm btn-ghost" data-settings-action="create-account">Create account</button>
          </div>
        </div>`;
    }

    // ── Subscription section ─────────────────────────────────────────────────
    let subscriptionSection = "";
    if (user) {
      const planDetails = tier === "free" ? `
        <p class="settings-sub-desc">You're on the free tier. Upgrade for unlimited watchlists, alerts, AI commentary, advanced screener, and priority data.</p>
        <div class="settings-plan-grid">
          <div class="settings-plan-card">
            <strong>Pro</strong>
            <span>$7.99 / mo</span>
            <ul>
              <li>✓ Unlimited watchlist</li>
              <li>✓ Unlimited alerts</li>
              <li>✓ AI market briefings</li>
              <li>✓ Advanced screener</li>
            </ul>
            <button class="btn btn-sm btn-primary" data-settings-action="upgrade-pro">Start free trial</button>
          </div>
          <div class="settings-plan-card settings-plan-featured">
            <div class="settings-plan-badge">Best value</div>
            <strong>Pro+</strong>
            <span>$14.99 / mo</span>
            <ul>
              <li>✓ Everything in Pro</li>
              <li>✓ Options chain</li>
              <li>✓ Deep dive reports</li>
              <li>✓ Priority support</li>
            </ul>
            <button class="btn btn-sm btn-primary" data-settings-action="upgrade-pro-plus">Start free trial</button>
          </div>
        </div>` : `
        <p class="settings-sub-desc">
          ${statusText ? `Plan status: <strong>${status}</strong>.` : "Your subscription is active."}
          ${isProPlus ? "You have full access to all Meridian features." : "Upgrade to Pro+ for options chain and deep dive reports."}
        </p>
        <div class="settings-section-row">
          <button class="btn btn-sm btn-ghost" data-settings-action="manage-billing">Manage billing →</button>
          ${!isProPlus ? `<button class="btn btn-sm btn-primary" data-settings-action="upgrade-pro-plus">Upgrade to Pro+</button>` : ""}
        </div>`;

      subscriptionSection = `
        <div class="settings-sub-card ${tierClass}">
          <div class="settings-sub-header">
            <strong>Subscription</strong>
            <span class="settings-tier-badge ${tierClass}">${tierLabel}</span>
          </div>
          ${planDetails}
        </div>`;
    }

    // ── Keyboard shortcuts ───────────────────────────────────────────────────
    const shortcuts = [
      ["T", "Cycle themes"],
      ["F1–F4", "Jump to panel module"],
      ["Alt + 1–4", "Focus / unfocus panel"],
      ["Enter", "Load ticker in active panel"],
      ["?", "Show keyboard shortcuts"],
      ["Cmd/Ctrl + K", "Open command palette"],
      ["SETTINGS (cmd)", "Open this settings panel"],
    ];
    const shortcutRows = shortcuts.map(([key, desc]) =>
      `<tr><td><kbd>${key}</kbd></td><td>${desc}</td></tr>`
    ).join("");

    return `
      <div class="settings-panel-root" data-panel-type="settings">
        <div class="settings-panel-inner">

          <section class="settings-section">
            <h3 class="settings-section-title">Account</h3>
            ${accountSection}
          </section>

          ${user ? `
          <section class="settings-section">
            <h3 class="settings-section-title">Plan</h3>
            ${subscriptionSection}
          </section>` : ""}

          <section class="settings-section">
            <h3 class="settings-section-title">Theme <small class="settings-hint">Press T to cycle</small></h3>
            <div class="settings-theme-grid">${themeGrid}</div>
          </section>

          <section class="settings-section">
            <h3 class="settings-section-title">Display</h3>
            <div class="settings-pref-list">
              <label class="settings-pref-row">
                <div>
                  <strong>Compact mode</strong>
                  <small>Denser layout: more data, less whitespace</small>
                </div>
                <button class="settings-toggle${state.compactMode ? " is-on" : ""}" data-pref-toggle="compactMode" type="button" aria-pressed="${Boolean(state.compactMode)}">
                  <span class="settings-toggle-knob"></span>
                </button>
              </label>
            </div>
          </section>

          <section class="settings-section">
            <h3 class="settings-section-title">Keyboard shortcuts</h3>
            <table class="settings-shortcut-table"><tbody>${shortcutRows}</tbody></table>
          </section>

          <section class="settings-section">
            <h3 class="settings-section-title">Data &amp; Privacy</h3>
            <div class="settings-pref-list">
              <div class="settings-pref-row settings-pref-action">
                <div>
                  <strong>Clear local data</strong>
                  <small>Resets workspace, watchlist, and preferences to defaults</small>
                </div>
                <button class="btn btn-sm btn-ghost" data-settings-action="clear-local">Clear</button>
              </div>
              ${user ? `
              <div class="settings-pref-row settings-pref-action">
                <div>
                  <strong>Delete account</strong>
                  <small>Permanently removes your account and all data</small>
                </div>
                <button class="btn btn-sm btn-danger-ghost" data-settings-action="delete-account">Delete</button>
              </div>` : ""}
            </div>
          </section>

          <footer class="settings-panel-footer">
            <small>Meridian Market Terminal · <a href="https://captainfredric.github.io/The-Terminal-Meridian/" target="_blank" rel="noopener">meridianmarket.app</a></small>
          </footer>

        </div>
      </div>`;
  };
}
