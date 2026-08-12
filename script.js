const page = document.querySelector(".page");
const audio = document.querySelector("#siski-audio");
const counter = document.querySelector("[data-count]");
const popups = document.querySelector("[data-popups]");

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

async function test(button, red) {
  page.classList.add("testing");
  button.classList.add("testing");
  button.textContent = red ? "↓ RED TESTING" : "↓ TESTING";
  counter.textContent = random(8, 99);

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
    button.textContent = red ? "↓ YES BUT RED" : "↓ YES";
  }, 1500);
}

document.querySelector("[data-test]").addEventListener("click", (event) => test(event.currentTarget, false));
document.querySelector("[data-test-red]").addEventListener("click", (event) => test(event.currentTarget, true));
document.querySelector("[data-report]").addEventListener("click", () => {
  popup("REPORT THIS AD", "REPORT DENIED. AD HAS REPORTED YOU.");
});

setInterval(() => {
  counter.textContent = random(3, 12);
}, 2500);
