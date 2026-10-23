const PHONES = [
  { label: "01270282602", id: "201270282602" },
  { label: "01220289119", id: "201220289119" },
];

const DEFAULT_TEXT = "مرحباً، أرغب في الاستفسار عن الجملة من مصنع مدريد للملابس الجاهزة.";

const dialog = document.querySelector("#wa");
const preview = document.querySelector("#wa-preview");
const progress = document.querySelector(".progress");
const header = document.querySelector(".nav");
const menu = document.querySelector("#menu");
const toggle = document.querySelector(".nav-toggle");
const intro = document.querySelector(".intro");

function waUrl(phoneId, text) {
  return `https://wa.me/${phoneId}?text=${encodeURIComponent(text)}`;
}

function openWa(text) {
  const message = (text || DEFAULT_TEXT).trim();
  if (!dialog || typeof dialog.showModal !== "function") {
    window.location.href = waUrl(PHONES[0].id, message);
    return;
  }
  preview.textContent = message;
  dialog.querySelectorAll("[data-phone]").forEach((link) => {
    link.href = waUrl(link.dataset.phone, message);
  });
  dialog.showModal();
}

document.querySelectorAll("[data-wa]").forEach((node) => {
  node.addEventListener("click", (event) => {
    event.preventDefault();
    const color = node.dataset.color;
    const text = color
      ? `مرحباً مصنع مدريد، أرغب في طلب جملة من البنطلون الرياضي. اللون: ${color}.`
      : node.dataset.text || DEFAULT_TEXT;
    if (color) {
      document.querySelectorAll(".band").forEach((band) => {
        band.classList.toggle("is-selected", band === node);
      });
      const select = document.querySelector("#color");
      if (select) select.value = color;
      window.__madridAccent?.(node.dataset.hex);
    }
    openWa(text);
  });
});

const form = document.querySelector("#order-form");
form?.addEventListener("submit", (event) => {
  event.preventDefault();
});

document.querySelectorAll("[data-send]").forEach((button) => {
  button.addEventListener("click", () => {
    const data = new FormData(form);
    const lines = ["مرحباً مصنع مدريد، أرغب في الاستفسار عن الجملة."];
    const name = String(data.get("name") || "").trim();
    const shop = String(data.get("shop") || "").trim();
    const activity = String(data.get("activity") || "").trim();
    const color = String(data.get("color") || "").trim();
    const qty = String(data.get("qty") || "").trim();
    const note = String(data.get("note") || "").trim();
    if (name) lines.push(`الاسم: ${name}`);
    if (shop) lines.push(`المحل أو المكتب: ${shop}`);
    if (activity) lines.push(`النشاط: ${activity}`);
    if (color) lines.push(`اللون: ${color}`);
    if (qty) lines.push(`الكمية التقريبية: ${qty}`);
    if (note) lines.push(`ملاحظة: ${note}`);
    window.location.href = waUrl(button.dataset.send, lines.join("\n"));
  });
});

toggle?.addEventListener("click", () => {
  const open = menu.classList.toggle("is-open");
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  document.body.classList.toggle("menu-open", open);
});

menu?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    menu.classList.remove("is-open");
    toggle?.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menu?.classList.contains("is-open")) {
    menu.classList.remove("is-open");
    toggle?.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
  }
});

const revealItems = document.querySelectorAll("[data-reveal]");
if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16 }
  );
  revealItems.forEach((item) => io.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-in"));
}

function onScroll() {
  const y = window.scrollY || document.documentElement.scrollTop;
  header?.classList.toggle("is-solid", y > 24);
  const hero = document.querySelector(".hero-pin");
  const contact = document.querySelector("#contact");
  const floatEl = document.querySelector(".wa-float");
  if (hero && floatEl) {
    const heroVisible = hero.getBoundingClientRect().bottom > window.innerHeight * 0.7;
    const contactRect = contact?.getBoundingClientRect();
    const contactVisible = contactRect
      ? contactRect.top < window.innerHeight * 0.5 && contactRect.bottom > 140
      : false;
    floatEl.classList.toggle("is-hidden", heroVisible || contactVisible);
  }
  if (progress) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  }
}
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

async function bootScene() {
  if (document.documentElement.classList.contains("lite")) return;
  const canvas = document.querySelector("#stage");
  if (!canvas) return;
  try {
    const { mountStage } = await import("./scene.js");
    const api = await mountStage(canvas);
    window.__madridAccent = api.setAccent;
  } catch (error) {
    console.error(error);
    document.documentElement.classList.add("no-webgl");
  }
}

async function bootIntro() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const seen = (() => {
    try {
      return sessionStorage.getItem("madrid-intro") === "1";
    } catch {
      return false;
    }
  })();
  const lite = document.documentElement.classList.contains("lite");
  const scenePromise = bootScene();
  if (!intro || reduce || seen || lite) {
    intro?.classList.add("is-done");
    document.documentElement.classList.add("is-entered");
    await scenePromise;
    return;
  }
  await Promise.all([scenePromise, wait(2500)]);
  intro.classList.add("is-done");
  document.documentElement.classList.add("is-entered");
  try {
    sessionStorage.setItem("madrid-intro", "1");
  } catch {
    /* private mode */
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

bootIntro();
