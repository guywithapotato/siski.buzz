const $ = (selector, root = document) => root.querySelector(selector);

const audio = $("#siski-audio");
const people = $("[data-people]");
const popups = $("[data-popups]");
const result = $("[data-result]");

const fakeWarnings = [
  "SISKI DRIVER OUTDATED",
  "YOU ARE THE 9,000,001ST USER",
  "LOCAL AURA DETECTED",
  "CLICK CONFIRMED BY MUNICIPAL INTERNET",
  "PLEASE DO NOT TURN OFF YOUR SISKI",
  "AD BLOCKER SAW THIS AND LEFT",
  "SISKI TEST HAS ENTERED THE ROOM",
];

function randomBetween(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function popup(title, text) {
  const node = document.createElement("div");
  node.className = "popup";
  node.style.left = `${randomBetween(8, Math.max(8, window.innerWidth - 310))}px`;
  node.style.top = `${randomBetween(8, Math.max(8, window.innerHeight - 140))}px`;
  node.innerHTML = `<strong>${title}</strong><p>${text}</p>`;
  popups.append(node);
  setTimeout(() => node.remove(), 3600);
}

function scoreFromIp(ip) {
  const text = String(ip || "siski");
  let total = 0;
  for (const char of text) total += char.charCodeAt(0);
  return 37 + (total % 64);
}

async function lookupSiski() {
  $("[data-ip]").textContent = "checking...";
  $("[data-geo]").textContent = "checking...";
  $("[data-isp]").textContent = "checking...";
  $("[data-score]").textContent = "spinning...";
  $("[data-verdict]").textContent = "contacting the public internet weather station...";

  try {
    const response = await fetch("https://ipapi.co/json/");
    if (!response.ok) throw new Error("lookup failed");
    const data = await response.json();
    const city = [data.city, data.region, data.country_name].filter(Boolean).join(", ");
    const score = scoreFromIp(data.ip);
    $("[data-ip]").textContent = data.ip || "unknown";
    $("[data-geo]").textContent = city || "somewhere with packets";
    $("[data-isp]").textContent = data.org || data.network || "mysterious internet pipe";
    $("[data-score]").textContent = `${score}/100`;
    $("[data-verdict]").textContent =
      score > 80
        ? "EXTREME SISKI. hydrate immediately."
        : score > 60
          ? "strong siski signature. legally sparkly."
          : "medium siski. still valid. still weird.";
  } catch (error) {
    $("[data-ip]").textContent = "blocked";
    $("[data-geo]").textContent = "unknown";
    $("[data-isp]").textContent = "lookup refused";
    $("[data-score]").textContent = `${randomBetween(55, 99)}/100`;
    $("[data-verdict]").textContent = "the lookup failed, which is also a kind of result.";
  }
}

async function testSiski(red = false) {
  document.body.classList.add("shake");
  setTimeout(() => document.body.classList.remove("shake"), 1500);
  result.hidden = false;
  result.scrollIntoView({ behavior: "smooth", block: "center" });

  people.textContent = randomBetween(7, 88);

  audio.currentTime = 0;
  audio.volume = red ? 1 : 0.82;
  try {
    await audio.play();
  } catch {
    popup("BROWSER BLOCKED AUDIO", "Click again with more belief.");
  }

  for (let i = 0; i < 5; i += 1) {
    setTimeout(() => {
      popup(
        fakeWarnings[randomBetween(0, fakeWarnings.length - 1)],
        red ? "RED SISKI MODE HAS NO REFUNDS." : "Testing... please enjoy this rectangle."
      );
    }, i * 260);
  }

  lookupSiski();
}

$("[data-test]").addEventListener("click", () => testSiski(false));
$("[data-test-red]").addEventListener("click", () => testSiski(true));
$("[data-close]").addEventListener("click", () => {
  result.hidden = true;
});
$("[data-fake-link]").addEventListener("click", () => {
  popup("REPORT RECEIVED", "The ad has reported you back. Fair is fair.");
});

setInterval(() => {
  people.textContent = randomBetween(3, 12);
}, 2200);

setTimeout(() => {
  popup("HELLO VISITOR", "You have been selected by diagonal stripes.");
}, 800);
