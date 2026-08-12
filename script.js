const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  sound: false,
  context: null,
  buzz: Number(localStorage.getItem("siski.buzz.level") || 17),
  bothers: Number(localStorage.getItem("siski.buzz.bothers") || 0),
  secrets: Number(localStorage.getItem("siski.buzz.secrets") || 0),
  visits: Number(localStorage.getItem("siski.buzz.visits") || 0) + 1,
  typed: "",
};

const moods = ["itchy", "luminous", "dial-up", "overclocked", "suspicious", "carbonated"];
const omens = [
  "A tab you closed in 2011 forgives you.",
  "The cursor knows a shortcut and refuses to share.",
  "Three pixels have unionized behind the footer.",
  "Your next refresh will smell faintly like batteries.",
  "Somewhere, a guestbook entry becomes legally binding.",
];

const relicMessages = {
  modem: ["Warm Modem", "It whispers: krrr-eeee-bong-bong. Nobody has heard from the cloud since."],
  jar: ["Jar of Alerts", "ALERT: you are standing inside the alert. Please remain moisturized."],
  coupon: ["Coupon Accepted", "Seven invisible pixels have been added to your account. They are very proud."],
};

function save() {
  localStorage.setItem("siski.buzz.level", String(state.buzz));
  localStorage.setItem("siski.buzz.bothers", String(state.bothers));
  localStorage.setItem("siski.buzz.secrets", String(state.secrets));
  localStorage.setItem("siski.buzz.visits", String(state.visits));
}

function updateReadouts() {
  $("[data-index]").textContent = `${state.buzz}%`;
  $("[data-visits]").textContent = state.visits;
  $("[data-bothers]").textContent = state.bothers;
  $("[data-secrets]").textContent = state.secrets;
  $("[data-needle]").style.setProperty("--angle", `${-115 + state.buzz * 2.3}deg`);
  $("[data-mood]").textContent = moods[state.bothers % moods.length];
  save();
}

function terminalLine(kind, message) {
  const terminal = $("[data-terminal]");
  const line = document.createElement("p");
  const label = document.createElement("span");
  label.textContent = kind;
  line.append(label, document.createTextNode(message));
  terminal.append(line);
  terminal.scrollTop = terminal.scrollHeight;
}

function toast(title, message) {
  const node = $("#toast-template").content.firstElementChild.cloneNode(true);
  $("strong", node).textContent = title;
  $("p", node).textContent = message;
  $("[data-toasts]").append(node);
  setTimeout(() => node.remove(), 5200);
}

function ensureAudio() {
  if (!state.context) {
    state.context = new AudioContext();
  }
  return state.context;
}

function beep(freq = 330, length = 0.08, type = "square") {
  if (!state.sound) return;
  const ctx = ensureAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + length + 0.02);
}

function bother(amount = 7) {
  state.bothers += 1;
  state.buzz = Math.max(0, Math.min(100, state.buzz + amount));
  updateReadouts();
}

function requestBuzz() {
  bother(9);
  beep(220 + state.buzz * 5, 0.08);
  terminalLine("BUZZ", `index climbed to ${state.buzz} after approved button interference`);
  toast("Buzz Granted", omens[Math.floor(Math.random() * omens.length)]);
  releasePixels(18);
}

function panicPolitely() {
  bother(4);
  document.body.classList.add("alarm");
  beep(180, 0.12, "sawtooth");
  setTimeout(() => document.body.classList.remove("alarm"), 1300);
  toast("Polite Panic", "The system has filed a tiny complaint with itself.");
  terminalLine("WARN", "panic accepted, folded, and placed under the welcome mat");
}

function releasePixels(count = 45) {
  const colors = ["#fff12b", "#79ff39", "#ff4fd8", "#48f4ff", "#ff6048"];
  for (let i = 0; i < count; i += 1) {
    const pixel = document.createElement("i");
    pixel.className = "pixel";
    pixel.style.left = `${window.innerWidth / 2 + (Math.random() - 0.5) * 160}px`;
    pixel.style.top = `${window.innerHeight / 2 + (Math.random() - 0.5) * 120}px`;
    pixel.style.background = colors[i % colors.length];
    pixel.style.setProperty("--dx", `${(Math.random() - 0.5) * 90}vw`);
    pixel.style.setProperty("--dy", `${(Math.random() - 0.5) * 80}vh`);
    document.body.append(pixel);
    setTimeout(() => pixel.remove(), 950);
  }
}

function runCommand(raw) {
  const command = raw.trim().toLowerCase();
  if (!command) return;
  terminalLine("YOU", command);
  beep(480, 0.035, "triangle");

  if (command === "help") {
    terminalLine("HELP", "commands: help, buzz, omen, siski, secret, guestbook, clear, invert, unmirror");
  } else if (command === "buzz") {
    requestBuzz();
  } else if (command === "omen") {
    terminalLine("OMEN", omens[Math.floor(Math.random() * omens.length)]);
  } else if (command === "siski") {
    state.secrets += 1;
    updateReadouts();
    terminalLine("DOOR", "a maintenance hatch opens: ./hive.html");
    toast("Secret Sniffed", "The console left a hatch unlocked.");
  } else if (command === "secret") {
    state.secrets += 1;
    updateReadouts();
    window.location.href = "secret.html";
  } else if (command === "guestbook") {
    location.hash = "guestbook";
  } else if (command === "clear") {
    $("[data-terminal]").innerHTML = "";
    terminalLine("SYS", "screen wiped with a suspiciously clean sleeve");
  } else if (command === "invert") {
    document.documentElement.style.filter = "invert(1) hue-rotate(180deg)";
    terminalLine("SYS", "colors temporarily sent to the basement");
  } else if (command === "unmirror") {
    document.body.classList.remove("mirrored");
    document.documentElement.style.filter = "";
    terminalLine("SYS", "geometry apologized");
  } else {
    state.buzz = Math.min(100, state.buzz + 1);
    updateReadouts();
    terminalLine("ERR", `"${command}" not found, but it made the room buzzier`);
  }
}

function loadGuests() {
  const defaults = [
    { name: "admin_worm", message: "first. second if you count spiritually." },
    { name: "dialup_dana", message: "heard a beep and came running." },
    { name: "null_friend", message: "please water the archive." },
  ];
  return JSON.parse(localStorage.getItem("siski.buzz.guests") || JSON.stringify(defaults));
}

function saveGuests(guests) {
  localStorage.setItem("siski.buzz.guests", JSON.stringify(guests.slice(0, 12)));
}

function renderGuests() {
  const list = $("[data-guest-list]");
  list.innerHTML = "";
  for (const guest of loadGuests()) {
    const li = document.createElement("li");
    const strong = document.createElement("strong");
    strong.textContent = guest.name;
    li.append(strong, document.createTextNode(`: ${guest.message}`));
    list.append(li);
  }
}

function exportBuzz() {
  const payload = {
    generatedBy: "siski.buzz guestbook that pretends to be a database",
    at: new Date().toISOString(),
    buzzIndex: state.buzz,
    guests: loadGuests(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "guestbook.buzz.json";
  link.click();
  URL.revokeObjectURL(url);
}

function bind() {
  $("[data-buzz]").addEventListener("click", requestBuzz);
  $("[data-panic]").addEventListener("click", panicPolitely);
  $("[data-calibrate]").addEventListener("click", () => {
    state.buzz = Math.floor(20 + Math.random() * 70);
    bother(0);
    terminalLine("CAL", `vibes recalibrated to ${state.buzz}, which is legally a number`);
  });
  $("[data-confetti]").addEventListener("click", () => releasePixels(70));
  $("[data-mirror]").addEventListener("click", () => {
    document.body.classList.toggle("mirrored");
    toast("Mirror Mode", "Use the console command unmirror if you regret this.");
  });
  $("[data-bad-idea]").addEventListener("click", () => {
    panicPolitely();
    setTimeout(() => toast("Bad Idea Completed", "Nothing broke. That feels worse."), 500);
  });
  $("[data-sound-toggle]").addEventListener("click", (event) => {
    state.sound = !state.sound;
    event.currentTarget.setAttribute("aria-pressed", String(state.sound));
    event.currentTarget.querySelector("span").textContent = state.sound ? "●" : "◌";
    if (state.sound) beep(440, 0.07);
  });

  $("[data-command-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    runCommand(event.currentTarget.command.value);
    event.currentTarget.reset();
  });

  $("[data-guest-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "visitor_404").trim().slice(0, 18);
    const message = String(data.get("message") || "buzz.").trim().slice(0, 100);
    const guests = [{ name, message }, ...loadGuests()];
    saveGuests(guests);
    renderGuests();
    event.currentTarget.reset();
    terminalLine("BOOK", `${name} left residue in the fake database`);
  });

  $("[data-export]").addEventListener("click", exportBuzz);

  $$("[data-relic]").forEach((button) => {
    button.addEventListener("click", () => {
      const [title, message] = relicMessages[button.dataset.relic];
      bother(3);
      toast(title, message);
      terminalLine("RELIC", message);
    });
  });

  window.addEventListener("pointermove", (event) => {
    document.documentElement.style.setProperty("--x", `${event.clientX}px`);
    document.documentElement.style.setProperty("--y", `${event.clientY}px`);
  });

  window.addEventListener("keydown", (event) => {
    state.typed = (state.typed + event.key.toLowerCase()).slice(-8);
    if (state.typed.includes("buzz")) {
      releasePixels(35);
      toast("Keyboard Charm", "You typed the tiny spell.");
      state.typed = "";
    }
  });
}

function tick() {
  $("[data-clock]").textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function boot() {
  bind();
  updateReadouts();
  renderGuests();
  tick();
  setInterval(tick, 1000);
  setInterval(() => {
    if (Math.random() > 0.72) terminalLine("SYS", omens[Math.floor(Math.random() * omens.length)]);
  }, 12000);
  terminalLine("SYS", `visit ${state.visits} registered in local storage`);
}

boot();
