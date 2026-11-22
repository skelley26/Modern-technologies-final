(function () {
  const storageKey = "fridgekeeper-items-v1";
  const form = document.getElementById("add-form");
  const nameInput = document.getElementById("food-name");
  const dateInput = document.getElementById("expiry-date");
  const list = document.getElementById("food-list");
  const emptyState = document.getElementById("empty-state");
  const itemCount = document.getElementById("item-count");
  const notice = document.getElementById("notice");
  let items = [];

  function showNotice(message) {
    notice.textContent = message;
    notice.hidden = !message;
  }

  function loadItems() {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === null) return [];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed) || parsed.some(function (item) {
        return !item || typeof item.id !== "string" ||
          typeof item.name !== "string" ||
          typeof item.expiry !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(item.expiry);
      })) {
        throw new Error("Saved fridge data has an unexpected format.");
      }
      return parsed;
    } catch (error) {
      showNotice("Your saved fridge list couldn’t be read. You can add items again, but the old saved data may need attention.");
      return [];
    }
  }

  function saveItems() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
      showNotice("");
    } catch (error) {
      showNotice("Your changes are shown for now, but couldn’t be saved in this browser.");
    }
  }

  function daysUntil(expiry) {
    const parts = expiry.split("-").map(Number);
    const expiryDay = Date.UTC(parts[0], parts[1] - 1, parts[2]);
    const now = new Date();
    const todayDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((expiryDay - todayDay) / 86400000);
  }

  function getStatus(days) {
    if (days < 0) return { color: "red", label: "Expired" };
    if (days <= 3) return { color: "red", label: days === 0 ? "Due today" : days + (days === 1 ? " day left" : " days left") };
    if (days <= 7) return { color: "yellow", label: days + " days left" };
    return { color: "green", label: days + " days left" };
  }

  function createFoodItem(item) {
    const days = daysUntil(item.expiry);
    const status = getStatus(days);
    const row = document.createElement("li");
    row.className = "food-item";

    const main = document.createElement("div");
    main.className = "food-main";
    const indicator = document.createElement("span");
    indicator.className = "food-indicator" + (status.color === "green" ? "" : " " + status.color);
    indicator.setAttribute("aria-label", status.color + " expiration status");
    const details = document.createElement("div");
    details.style.minWidth = "0";
    const name = document.createElement("div");
    name.className = "food-name";
    name.textContent = item.name;
    const date = document.createElement("div");
    date.className = "food-date";
    date.textContent = "Expires " + new Date(item.expiry + "T00:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
    details.append(name, date);
    main.append(indicator, details);

    const meta = document.createElement("div");
    meta.className = "food-meta";
    const freshness = document.createElement("span");
    freshness.className = "freshness" + (status.color === "green" ? "" : " " + status.color);
    freshness.textContent = status.label;
    const remove = document.createElement("button");
    remove.className = "remove-button";
    remove.type = "button";
    remove.setAttribute("aria-label", "Remove " + item.name);
    remove.title = "Remove item";
    remove.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.75 7.25h14.5m-12.5 0 .75 12h9l.75-12M9.25 7.25V4.75h5.5v2.5m-4.5 3v5.5m3.5-5.5v5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    remove.addEventListener("click", function () {
      items = items.filter(function (candidate) {
        return candidate.id !== item.id;
      });
      saveItems();
      render();
    });
    meta.append(freshness, remove);
    row.append(main, meta);
    return row;
  }

  function render() {
    list.replaceChildren();
    const sorted = items.slice().sort(function (a, b) {
      return a.expiry.localeCompare(b.expiry) || a.name.localeCompare(b.name);
    });
    sorted.forEach(function (item) {
      list.append(createFoodItem(item));
    });
    emptyState.hidden = sorted.length > 0;
    itemCount.textContent = String(sorted.length);
    itemCount.setAttribute("aria-label", sorted.length + (sorted.length === 1 ? " item" : " items"));
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const name = nameInput.value.trim();
    const expiry = dateInput.value;
    if (!name || !expiry) return;

    items.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      name: name,
      expiry: expiry
    });
    saveItems();
    render();
    form.reset();
    nameInput.focus();
  });

  items = loadItems();
  render();
})();
