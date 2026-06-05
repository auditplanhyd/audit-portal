/**
 * AUDIT INTELLIGENCE PORTAL — app.js
 * Handles: Firebase sync, card rendering, settings panel,
 *          card CRUD, search, filtering, viewer iframe.
 */

"use strict";

// ─────────────────────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────────────────────
const state = {
  cards: [],
  activeCategory: "all",
  searchQuery: "",
  firebaseReady: false,
};

// ─────────────────────────────────────────────────────────────
//  DOM REFS
// ─────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const el = {
  cardsGrid:         $("cardsGrid"),
  emptyState:        $("emptyState"),
  gridTitle:         $("gridTitle"),
  gridCount:         $("gridCount"),
  categoryBar:       $("categoryBar"),
  syncStatus:        $("syncStatus"),
  syncLabel:         $("syncStatus").querySelector(".sync-label"),

  // Settings panel
  settingsPanel:     $("settingsPanel"),
  settingsOverlay:   $("settingsOverlay"),
  btnSettings:       $("btnSettings"),
  btnCloseSettings:  $("btnCloseSettings"),
  existingCardsList: $("existingCardsList"),
  categoryList:      $("categoryList"),

  // Add form
  newCardName:       $("newCardName"),
  newCardDesc:       $("newCardDesc"),
  newCardCategory:   $("newCardCategory"),
  newCardUrl:        $("newCardUrl"),
  newCardIcon:       $("newCardIcon"),
  newCardVersion:    $("newCardVersion"),
  newCardStatus:     $("newCardStatus"),
  btnAddCard:        $("btnAddCard"),

  // Edit modal
  editModalOverlay:  $("editModalOverlay"),
  btnCloseEdit:      $("btnCloseEdit"),
  editCardId:        $("editCardId"),
  editCardName:      $("editCardName"),
  editCardDesc:      $("editCardDesc"),
  editCardCategory:  $("editCardCategory"),
  editCardUrl:       $("editCardUrl"),
  editCardIcon:      $("editCardIcon"),
  editCardVersion:   $("editCardVersion"),
  editCardChangelog: $("editCardChangelog"),
  editCardStatus:    $("editCardStatus"),
  btnSaveEdit:       $("btnSaveEdit"),
  btnDeleteCard:     $("btnDeleteCard"),

  // Viewer
  viewerOverlay:     $("viewerOverlay"),
  cardFrame:         $("cardFrame"),
  viewerTitle:       $("viewerTitle"),
  viewerOpenTab:     $("viewerOpenTab"),
  btnCloseViewer:    $("btnCloseViewer"),

  // Search
  cardSearch:        $("cardSearch"),
  btnRefresh:        $("btnRefresh"),

  // Toast
  toastContainer:    $("toastContainer"),
};

// ─────────────────────────────────────────────────────────────
//  SESSION & LOGOUT
// ─────────────────────────────────────────────────────────────
// Show workspace name in topbar
const workspaceBadge = $("workspaceBadge");
if (workspaceBadge && window.WORKSPACE_NAME) {
  workspaceBadge.textContent = window.WORKSPACE_NAME;
}

// Logout button
const btnLogout = $("btnLogout");
if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    if (!confirm("Disconnect from Firebase and return to login?")) return;
    sessionStorage.removeItem("auditportal_session");
    window.location.href = "login.html";
  });
}

// ─────────────────────────────────────────────────────────────
//  SYNC STATUS
// ─────────────────────────────────────────────────────────────
function setSyncStatus(status, label) {
  el.syncStatus.className = "sync-status " + status;
  el.syncLabel.textContent = label;
}

// ─────────────────────────────────────────────────────────────
//  FIREBASE INIT
// ─────────────────────────────────────────────────────────────
document.addEventListener("firebase-ready", () => {
  state.firebaseReady = true;
  setSyncStatus("syncing", "Connecting…");

  window._db.subscribe(docs => {
    state.cards = docs;
    setSyncStatus("synced", "Live");
    renderAll();
  });
});

// Fallback: if Firebase config not set, use localStorage
window.addEventListener("load", () => {
  if (!state.firebaseReady) {
    setTimeout(() => {
      if (!state.firebaseReady) {
        console.warn("Firebase not ready — using localStorage fallback");
        setSyncStatus("error", "Offline");
        loadLocalCards();
      }
    }, 3000);
  }
});

// ─────────────────────────────────────────────────────────────
//  LOCAL STORAGE FALLBACK
// ─────────────────────────────────────────────────────────────
const LS_KEY = "auditportal_cards";

function loadLocalCards() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    state.cards = raw ? JSON.parse(raw) : [];
  } catch { state.cards = []; }
  renderAll();
}

function saveLocalCards() {
  localStorage.setItem(LS_KEY, JSON.stringify(state.cards));
}

function localAdd(data) {
  const card = { ...data, id: "local_" + Date.now(), createdAt: new Date().toISOString() };
  state.cards.push(card);
  saveLocalCards();
  renderAll();
}
function localUpdate(id, data) {
  state.cards = state.cards.map(c => c.id === id ? { ...c, ...data } : c);
  saveLocalCards();
  renderAll();
}
function localDelete(id) {
  state.cards = state.cards.filter(c => c.id !== id);
  saveLocalCards();
  renderAll();
}

// ─────────────────────────────────────────────────────────────
//  CARD CRUD (delegates to Firebase or localStorage)
// ─────────────────────────────────────────────────────────────
async function addCard(data) {
  if (state.firebaseReady) {
    try { await window._db.add(data); toast("Card added", "success"); }
    catch(e) { toast("Error: " + e.message, "error"); }
  } else {
    localAdd(data);
    toast("Card added (offline)", "info");
  }
}

async function updateCard(id, data) {
  if (state.firebaseReady) {
    try { await window._db.update(id, data); toast("Card updated", "success"); }
    catch(e) { toast("Error: " + e.message, "error"); }
  } else {
    localUpdate(id, data);
    toast("Card updated (offline)", "info");
  }
}

async function deleteCard(id) {
  if (state.firebaseReady) {
    try { await window._db.delete(id); toast("Card deleted", "info"); }
    catch(e) { toast("Error: " + e.message, "error"); }
  } else {
    localDelete(id);
    toast("Card deleted (offline)", "info");
  }
}

// ─────────────────────────────────────────────────────────────
//  RENDER
// ─────────────────────────────────────────────────────────────
function getFilteredCards() {
  let cards = state.cards;

  if (state.activeCategory !== "all") {
    cards = cards.filter(c =>
      (c.category || "Uncategorised").toLowerCase() === state.activeCategory.toLowerCase()
    );
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    cards = cards.filter(c =>
      (c.name || "").toLowerCase().includes(q) ||
      (c.description || "").toLowerCase().includes(q) ||
      (c.category || "").toLowerCase().includes(q)
    );
  }

  return cards;
}

function renderAll() {
  renderCategories();
  renderCards();
  renderExistingList();
  updateCategoryDatalist();
}

function renderCategories() {
  // Gather unique categories
  const cats = [...new Set(state.cards.map(c => c.category || "Uncategorised"))].sort();

  // Preserve existing pills except 'All'
  el.categoryBar.innerHTML = `<button class="cat-pill ${state.activeCategory === 'all' ? 'active' : ''}" data-cat="all">All Tools</button>`;

  cats.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "cat-pill" + (state.activeCategory === cat ? " active" : "");
    btn.dataset.cat = cat;
    btn.textContent = cat;
    el.categoryBar.appendChild(btn);
  });
}

function renderCards() {
  const cards = getFilteredCards();

  el.gridTitle.textContent = state.activeCategory === "all"
    ? "All Tools"
    : state.activeCategory;

  el.gridCount.textContent = cards.length + " tool" + (cards.length !== 1 ? "s" : "");

  if (cards.length === 0) {
    el.cardsGrid.style.display = "none";
    el.emptyState.style.display = "block";
    return;
  }

  el.cardsGrid.style.display = "grid";
  el.emptyState.style.display = "none";
  el.cardsGrid.innerHTML = "";

  cards.forEach((card, i) => {
    const div = document.createElement("div");
    div.className = "audit-card";
    div.style.animationDelay = (i * 0.04) + "s";
    div.dataset.id = card.id;
    div.innerHTML = cardHTML(card);
    el.cardsGrid.appendChild(div);
  });
}

function cardHTML(card) {
  const icon    = card.icon || "📋";
  const status  = card.status || "active";
  const version = card.version || "v1.0";
  const cat     = card.category || "Uncategorised";
  const desc    = card.description || "No description provided.";
  const name    = card.name || "Unnamed Tool";

  return `
    <div class="card-top">
      <div class="card-icon">${icon}</div>
      <div class="card-meta-top">
        <span class="status-badge status-${status}">${status}</span>
        <span class="card-version">${version}</span>
      </div>
    </div>
    <div class="card-name">${escHtml(name)}</div>
    <div class="card-description">${escHtml(desc)}</div>
    <div class="card-footer">
      <span class="card-category">${escHtml(cat)}</span>
      <div class="card-actions">
        <button class="card-btn edit-btn" data-id="${card.id}" title="Edit card">✎</button>
        <button class="card-btn delete-btn" data-id="${card.id}" title="Delete card">✕</button>
      </div>
    </div>
  `;
}

function renderExistingList() {
  el.existingCardsList.innerHTML = "";

  if (state.cards.length === 0) {
    el.existingCardsList.innerHTML = `<p style="color:var(--text-muted);font-size:12px;">No cards yet.</p>`;
    return;
  }

  state.cards.forEach(card => {
    const div = document.createElement("div");
    div.className = "existing-card-item";
    div.innerHTML = `
      <span class="eci-icon">${card.icon || "📋"}</span>
      <div class="eci-info">
        <div class="eci-name">${escHtml(card.name || "Unnamed")}</div>
        <div class="eci-cat">${escHtml(card.category || "Uncategorised")} · ${card.version || "v1.0"}</div>
      </div>
      <div class="eci-actions">
        <button class="eci-btn edit" data-id="${card.id}" title="Edit">✎</button>
        <button class="eci-btn del"  data-id="${card.id}" title="Delete">✕</button>
      </div>
    `;
    el.existingCardsList.appendChild(div);
  });
}

function updateCategoryDatalist() {
  const cats = [...new Set(state.cards.map(c => c.category || "Uncategorised"))].sort();
  el.categoryList.innerHTML = cats.map(c => `<option value="${c}"></option>`).join("");
}

// ─────────────────────────────────────────────────────────────
//  SETTINGS PANEL
// ─────────────────────────────────────────────────────────────
function openSettings() {
  el.settingsPanel.classList.add("open");
  el.settingsOverlay.classList.add("show");
}
function closeSettings() {
  el.settingsPanel.classList.remove("open");
  el.settingsOverlay.classList.remove("show");
}

el.btnSettings.addEventListener("click", openSettings);
el.btnCloseSettings.addEventListener("click", closeSettings);
el.settingsOverlay.addEventListener("click", closeSettings);

// ─────────────────────────────────────────────────────────────
//  ADD CARD FORM
// ─────────────────────────────────────────────────────────────
el.btnAddCard.addEventListener("click", async () => {
  const name = el.newCardName.value.trim();
  const url  = el.newCardUrl.value.trim();

  if (!name) { toast("Tool name is required", "error"); el.newCardName.focus(); return; }
  if (!url)  { toast("HTML file path is required", "error"); el.newCardUrl.focus(); return; }

  const data = {
    name,
    description: el.newCardDesc.value.trim(),
    category:    el.newCardCategory.value.trim() || "Uncategorised",
    url,
    icon:    el.newCardIcon.value.trim() || "📋",
    version: el.newCardVersion.value.trim() || "v1.0",
    status:  el.newCardStatus.value,
    changelog: "",
  };

  await addCard(data);

  // Clear form
  [el.newCardName, el.newCardDesc, el.newCardCategory, el.newCardUrl,
   el.newCardIcon, el.newCardVersion].forEach(i => i.value = "");
  el.newCardStatus.value = "active";
});

// ─────────────────────────────────────────────────────────────
//  EDIT MODAL
// ─────────────────────────────────────────────────────────────
function openEditModal(id) {
  const card = state.cards.find(c => c.id === id);
  if (!card) return;

  el.editCardId.value        = card.id;
  el.editCardName.value      = card.name || "";
  el.editCardDesc.value      = card.description || "";
  el.editCardCategory.value  = card.category || "";
  el.editCardUrl.value       = card.url || "";
  el.editCardIcon.value      = card.icon || "📋";
  el.editCardVersion.value   = card.version || "v1.0";
  el.editCardChangelog.value = card.changelog || "";
  el.editCardStatus.value    = card.status || "active";

  el.editModalOverlay.classList.add("show");
}
function closeEditModal() {
  el.editModalOverlay.classList.remove("show");
}

el.btnCloseEdit.addEventListener("click", closeEditModal);
el.editModalOverlay.addEventListener("click", e => {
  if (e.target === el.editModalOverlay) closeEditModal();
});

el.btnSaveEdit.addEventListener("click", async () => {
  const id   = el.editCardId.value;
  const name = el.editCardName.value.trim();
  const url  = el.editCardUrl.value.trim();

  if (!name) { toast("Tool name is required", "error"); return; }
  if (!url)  { toast("URL is required", "error"); return; }

  const data = {
    name,
    description: el.editCardDesc.value.trim(),
    category:    el.editCardCategory.value.trim() || "Uncategorised",
    url,
    icon:      el.editCardIcon.value.trim() || "📋",
    version:   el.editCardVersion.value.trim() || "v1.0",
    changelog: el.editCardChangelog.value.trim(),
    status:    el.editCardStatus.value,
  };

  await updateCard(id, data);
  closeEditModal();
});

el.btnDeleteCard.addEventListener("click", async () => {
  const id = el.editCardId.value;
  if (!confirm("Delete this card? This cannot be undone.")) return;
  await deleteCard(id);
  closeEditModal();
});

// ─────────────────────────────────────────────────────────────
//  CARD VIEWER (iframe)
// ─────────────────────────────────────────────────────────────
function openViewer(id) {
  const card = state.cards.find(c => c.id === id);
  if (!card) return;

  el.viewerTitle.textContent = (card.icon || "") + "  " + card.name + "  ·  " + (card.version || "v1.0");
  el.cardFrame.src = card.url;
  el.viewerOpenTab.href = card.url;
  el.viewerOverlay.classList.add("show");
  document.body.style.overflow = "hidden";
}
function closeViewer() {
  el.viewerOverlay.classList.remove("show");
  el.cardFrame.src = "";
  document.body.style.overflow = "";
}

el.btnCloseViewer.addEventListener("click", closeViewer);

// Keyboard: Escape closes modals
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if (el.viewerOverlay.classList.contains("show"))   { closeViewer(); return; }
    if (el.editModalOverlay.classList.contains("show")) { closeEditModal(); return; }
    if (el.settingsPanel.classList.contains("open"))   { closeSettings(); return; }
  }
});

// ─────────────────────────────────────────────────────────────
//  EVENT DELEGATION (cards grid & settings list)
// ─────────────────────────────────────────────────────────────
el.cardsGrid.addEventListener("click", e => {
  const editBtn   = e.target.closest(".edit-btn");
  const deleteBtn = e.target.closest(".delete-btn");
  const card      = e.target.closest(".audit-card");

  if (editBtn) {
    e.stopPropagation();
    openEditModal(editBtn.dataset.id);
    return;
  }
  if (deleteBtn) {
    e.stopPropagation();
    if (!confirm("Delete this card?")) return;
    deleteCard(deleteBtn.dataset.id);
    return;
  }
  if (card) {
    openViewer(card.dataset.id);
  }
});

el.existingCardsList.addEventListener("click", e => {
  const editBtn = e.target.closest(".eci-btn.edit");
  const delBtn  = e.target.closest(".eci-btn.del");

  if (editBtn) { openEditModal(editBtn.dataset.id); return; }
  if (delBtn)  {
    if (!confirm("Delete this card?")) return;
    deleteCard(delBtn.dataset.id);
  }
});

// ─────────────────────────────────────────────────────────────
//  CATEGORY FILTER
// ─────────────────────────────────────────────────────────────
el.categoryBar.addEventListener("click", e => {
  const pill = e.target.closest(".cat-pill");
  if (!pill) return;
  state.activeCategory = pill.dataset.cat;
  document.querySelectorAll(".cat-pill").forEach(p => p.classList.remove("active"));
  pill.classList.add("active");
  renderCards();
});

// ─────────────────────────────────────────────────────────────
//  SEARCH
// ─────────────────────────────────────────────────────────────
el.cardSearch.addEventListener("input", e => {
  state.searchQuery = e.target.value.trim();
  renderCards();
});

// ─────────────────────────────────────────────────────────────
//  REFRESH
// ─────────────────────────────────────────────────────────────
el.btnRefresh.addEventListener("click", () => {
  if (!state.firebaseReady) {
    loadLocalCards();
    toast("Refreshed from local storage", "info");
  } else {
    toast("Live — Firebase keeps data in sync automatically", "info");
  }
});

// ─────────────────────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────────────────────
function toast(msg, type = "info") {
  const icons = { success: "✓", error: "✕", info: "◎" };
  const div = document.createElement("div");
  div.className = "toast " + type;
  div.innerHTML = `<span>${icons[type] || "◎"}</span><span>${msg}</span>`;
  el.toastContainer.appendChild(div);
  setTimeout(() => div.remove(), 3500);
}

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

// ─────────────────────────────────────────────────────────────
//  INIT — show loading state
// ─────────────────────────────────────────────────────────────
setSyncStatus("syncing", "Connecting…");
renderAll(); // render empty state until Firebase fires
