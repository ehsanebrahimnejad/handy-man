
const scriptURL = window.ERS_SCRIPT_URL || "";

const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");

menuBtn.addEventListener("click", () => {
  navLinks.classList.toggle("open");
  menuBtn.textContent = navLinks.classList.contains("open") ? "✕" : "☰";
});

document.querySelectorAll(".nav-links a").forEach(link => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("open");
    menuBtn.textContent = "☰";
  });
});

document.querySelectorAll(".service-card").forEach(card => {
  card.addEventListener("click", () => {
    document.getElementById("serviceInput").value = card.dataset.service || "";
    document.getElementById("ersForm").scrollIntoView({ behavior: "smooth" });
  });
});

document.getElementById("ersForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form));

  if (!scriptURL) {
    alert("Your estimate form is ready, but the Google Apps Script URL is missing.");
    return;
  }

  try {
    const response = await fetch(scriptURL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (data.result === "success") {
      alert("✅ Estimate request sent!");
      form.reset();
    } else {
      alert("❌ " + (data.message || "Unable to send your request."));
    }
  } catch (error) {
    alert("❌ " + error.message);
  }
});

const reviewForm = document.getElementById("reviewForm");
const reviewList = document.getElementById("reviewList");

reviewForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(reviewForm);
  const name = String(formData.get("name") || "");
  const review = String(formData.get("review") || "");
  const rating = Number(formData.get("rating") || 0);
  const date = new Date().toLocaleDateString();

  const card = document.createElement("div");
  card.className = "review-card";

  const header = document.createElement("div");
  const reviewer = document.createElement("span");
  reviewer.className = "reviewer";
  reviewer.textContent = name;

  const dateSpan = document.createElement("span");
  dateSpan.className = "date";
  dateSpan.textContent = date;

  const stars = document.createElement("div");
  stars.className = "review-stars";
  stars.textContent = "★".repeat(rating) + "☆".repeat(5 - rating);

  const body = document.createElement("div");
  body.textContent = review;

  header.append(reviewer, dateSpan);
  card.append(header, stars, body);
  reviewList.prepend(card);
  reviewForm.reset();

  if (scriptURL) {
    try {
      await fetch(scriptURL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ name, review, rating, date, type: "review" })
      });
    } catch (error) {
      console.error("Review submission error:", error);
    }
  }
});

document.getElementById("year").textContent = new Date().getFullYear();
