(function () {
  const storageKey = "fridgekeeper-items-v1";
  const apiBase = "https://www.themealdb.com/api/json/v1/1";
  const maxIngredients = 5;
  const maxRecipes = 9;
  const ingredientList = document.getElementById("ingredient-list");
  const ingredientCount = document.getElementById("ingredient-count");
  const ingredientSummary = document.getElementById("ingredient-summary");
  const ingredientNote = document.getElementById("ingredient-note");
  const searchButton = document.getElementById("search-button");
  const searchButtonLabel = document.getElementById("search-button-label");
  const message = document.getElementById("recipe-message");
  const results = document.getElementById("recipe-results");
  const resultsCount = document.getElementById("results-count");
  const emptyState = document.getElementById("recipe-empty");
  const emptyText = document.getElementById("recipe-empty-text");
  let ingredients = [];
  let searchNumber = 0;

  function showMessage(text, type) {
    message.textContent = text;
    message.className = "recipe-message" + (type ? " " + type : "");
    message.hidden = !text;
  }

  function getDaysUntil(expiry) {
    const parts = expiry.split("-").map(Number);
    const expiryDay = Date.UTC(parts[0], parts[1] - 1, parts[2]);
    const today = new Date();
    const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.round((expiryDay - todayDay) / 86400000);
  }

  function readFridgeItems() {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === null) return [];

      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed) || parsed.some(function (item) {
        return !item || typeof item.name !== "string" ||
          typeof item.expiry !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(item.expiry);
      })) {
        throw new Error("Saved fridge items have an unexpected format.");
      }
      return parsed;
    } catch (error) {
      showMessage("Your fridge list couldn’t be read. Return to the fridge page to check your saved items.", "error");
      return [];
    }
  }

  function normalizeIngredient(name) {
    return name.trim().toLowerCase().replace(/\s+/g, "_");
  }

  function getSoonestIngredients(items) {
    const seen = new Set();
    return items
      .filter(function (item) {
        return getDaysUntil(item.expiry) >= 0;
      })
      .sort(function (a, b) {
        return a.expiry.localeCompare(b.expiry) || a.name.localeCompare(b.name);
      })
      .filter(function (item) {
        const key = normalizeIngredient(item.name);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, maxIngredients);
  }

  function formatExpiry(days) {
    if (days === 0) return "Expires today";
    if (days === 1) return "1 day left";
    return days + " days left";
  }

  function renderIngredients() {
    ingredientList.replaceChildren();
    ingredientCount.textContent = String(ingredients.length);
    ingredientCount.setAttribute("aria-label", ingredients.length + (ingredients.length === 1 ? " ingredient" : " ingredients"));
    searchButton.disabled = ingredients.length === 0;

    if (ingredients.length === 0) {
      ingredientSummary.textContent = "No current fridge ingredients to search.";
      ingredientNote.textContent = "Add food to your fridge first. Expired items are left out of recipe searches.";
      return;
    }

    ingredientSummary.textContent = "Searching with your " + Math.min(maxIngredients, ingredients.length) + " soonest-expiring ingredients.";
    ingredientNote.textContent = "Recipes are matched one ingredient at a time, then ranked by how many of these you already have.";
    ingredients.forEach(function (item) {
      const days = getDaysUntil(item.expiry);
      const chip = document.createElement("span");
      chip.className = "ingredient-chip" + (days <= 3 ? " red" : days <= 7 ? " yellow" : "");

      const name = document.createElement("span");
      name.textContent = item.name;
      const expiry = document.createElement("span");
      expiry.className = "ingredient-expiry";
      expiry.textContent = formatExpiry(days);

      chip.append(name, expiry);
      ingredientList.append(chip);
    });
  }

  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Recipe service returned HTTP " + response.status + ".");
    }
    return response.json();
  }

  async function fetchMealsByIngredient(ingredient) {
    const query = encodeURIComponent(normalizeIngredient(ingredient.name));
    const data = await fetchJson(apiBase + "/filter.php?i=" + query);
    return Array.isArray(data.meals) ? data.meals : [];
  }

  async function fetchMealDetails(mealId) {
    const data = await fetchJson(apiBase + "/lookup.php?i=" + encodeURIComponent(mealId));
    if (!Array.isArray(data.meals) || !data.meals[0]) {
      throw new Error("Recipe details were not available.");
    }
    return data.meals[0];
  }

  function formatIngredients(meal) {
    const formatted = [];
    for (let index = 1; index <= 20; index += 1) {
      const ingredient = meal["strIngredient" + index];
      const measure = meal["strMeasure" + index];
      if (ingredient && ingredient.trim()) {
        formatted.push((measure ? measure.trim() + " " : "") + ingredient.trim());
      }
    }
    return formatted;
  }

  function appendText(parent, tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text;
    parent.append(element);
    return element;
  }

  function safeLink(value) {
    if (!value) return null;
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
    } catch (error) {
      return null;
    }
  }

  function createRecipeCard(meal, matchedIngredients) {
    const column = document.createElement("div");
    column.className = "col";
    const card = document.createElement("article");
    card.className = "card h-100 recipe-card";

    const imageUrl = safeLink(meal.strMealThumb);
    if (imageUrl) {
      const image = document.createElement("img");
      image.className = "card-img-top";
      image.src = imageUrl;
      image.alt = meal.strMeal ? "Photo of " + meal.strMeal : "Recipe photo";
      image.loading = "lazy";
      card.append(image);
    }

    const body = document.createElement("div");
    body.className = "card-body d-flex flex-column";
    const tags = document.createElement("div");
    tags.className = "recipe-tags";
    if (meal.strCategory) appendText(tags, "span", "recipe-tag", meal.strCategory);
    if (meal.strArea) appendText(tags, "span", "recipe-tag", meal.strArea);
    body.append(tags);

    appendText(body, "h3", "card-title", meal.strMeal || "Untitled recipe");
    const match = document.createElement("p");
    match.className = "recipe-match";
    const matchLabel = document.createElement("strong");
    matchLabel.textContent = matchedIngredients.length + (matchedIngredients.length === 1 ? " fridge match" : " fridge matches");
    match.append(matchLabel, document.createTextNode(": " + matchedIngredients.join(", ")));
    body.append(match);

    const details = document.createElement("details");
    details.className = "recipe-details";
    appendText(details, "summary", "", "Ingredients and instructions");
    appendText(details, "h3", "", "Ingredients");
    const ingredientItems = formatIngredients(meal);
    const ingredientList = document.createElement("ul");
    ingredientItems.forEach(function (ingredient) {
      appendText(ingredientList, "li", "", ingredient);
    });
    details.append(ingredientList);

    appendText(details, "h3", "", "Instructions");
    appendText(details, "p", "recipe-instructions", meal.strInstructions || "Instructions are not available.");
    body.append(details);

    const source = safeLink(meal.strSource) || safeLink(meal.strYoutube);
    if (source) {
      const sourceLink = appendText(body, "a", "recipe-source", "View original recipe");
      sourceLink.href = source;
      sourceLink.target = "_blank";
      sourceLink.rel = "noopener noreferrer";
    }

    card.append(body);
    column.append(card);
    return column;
  }

  async function searchRecipes() {
    if (ingredients.length === 0) {
      showMessage("Add non-expired ingredients to your fridge before searching.", "warning");
      return;
    }

    const currentSearch = ++searchNumber;
    searchButton.disabled = true;
    searchButtonLabel.textContent = "Searching…";
    results.replaceChildren();
    resultsCount.textContent = "";
    emptyState.hidden = true;
    showMessage("Searching TheMealDB for recipes using your soonest-expiring ingredients.");

    try {
      const ingredientResults = await Promise.allSettled(ingredients.map(fetchMealsByIngredient));
      if (currentSearch !== searchNumber) return;

      const recipeMatches = new Map();
      const failedIngredients = [];
      ingredientResults.forEach(function (result, index) {
        if (result.status === "rejected") {
          failedIngredients.push(ingredients[index].name);
          return;
        }
        result.value.forEach(function (meal) {
          if (!meal || !meal.idMeal) return;
          let match = recipeMatches.get(meal.idMeal);
          if (!match) {
            match = { preview: meal, matchedIngredients: [] };
            recipeMatches.set(meal.idMeal, match);
          }
          match.matchedIngredients.push(ingredients[index].name);
        });
      });

      const rankedMatches = Array.from(recipeMatches.values())
        .sort(function (a, b) {
          return b.matchedIngredients.length - a.matchedIngredients.length ||
            (a.preview.strMeal || "").localeCompare(b.preview.strMeal || "");
        })
        .slice(0, maxRecipes);

      if (rankedMatches.length === 0) {
        results.replaceChildren();
        resultsCount.textContent = "0 recipes";
        emptyState.hidden = false;
        emptyState.querySelector("strong").textContent = "No recipes found";
        emptyText.textContent = failedIngredients.length === ingredients.length
          ? "The recipe service couldn’t be reached. Check your connection and try again."
          : "Try common ingredient names such as chicken, tomato, or rice.";
        if (failedIngredients.length === ingredients.length) {
          showMessage("TheMealDB could not be reached for any of the selected ingredients.", "error");
        } else if (failedIngredients.length > 0) {
          showMessage("Couldn’t search: " + failedIngredients.join(", ") + ".", "warning");
        } else {
          showMessage("");
        }
        return;
      }

      const detailedResults = await Promise.allSettled(rankedMatches.map(function (match) {
        return fetchMealDetails(match.preview.idMeal).then(function (meal) {
          return { meal: meal, matchedIngredients: match.matchedIngredients };
        });
      }));
      if (currentSearch !== searchNumber) return;

      let renderedCount = 0;
      detailedResults.forEach(function (result) {
        if (result.status !== "fulfilled") return;
        results.append(createRecipeCard(result.value.meal, result.value.matchedIngredients));
        renderedCount += 1;
      });

      resultsCount.textContent = renderedCount + (renderedCount === 1 ? " recipe" : " recipes");
      emptyState.hidden = renderedCount > 0;
      if (renderedCount === 0) {
        emptyState.querySelector("strong").textContent = "Recipe details unavailable";
        emptyText.textContent = "The recipe service returned matches, but their details couldn’t be loaded. Please try again.";
      }

      const warnings = [];
      if (failedIngredients.length > 0) {
        warnings.push("Couldn’t search: " + failedIngredients.join(", ") + ".");
      }
      const failedDetails = detailedResults.length - renderedCount;
      if (failedDetails > 0) {
        warnings.push(failedDetails + (failedDetails === 1 ? " recipe detail" : " recipe details") + " couldn’t be loaded.");
      }
      showMessage(warnings.join(" "), warnings.length ? "warning" : "");
    } catch (error) {
      if (currentSearch !== searchNumber) return;
      results.replaceChildren();
      resultsCount.textContent = "";
      emptyState.hidden = false;
      emptyState.querySelector("strong").textContent = "Couldn’t load recipes";
      emptyText.textContent = "Check your internet connection and try searching again.";
      showMessage("TheMealDB request failed: " + error.message, "error");
    } finally {
      if (currentSearch === searchNumber) {
        searchButton.disabled = ingredients.length === 0;
        searchButtonLabel.textContent = "Find recipes";
      }
    }
  }

  searchButton.addEventListener("click", searchRecipes);
  ingredients = getSoonestIngredients(readFridgeItems());
  renderIngredients();
})();
