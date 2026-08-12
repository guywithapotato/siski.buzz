const button = document.querySelector("[data-test]");
const audio = document.querySelector("#siski-audio");

button.addEventListener("click", async () => {
  button.classList.add("testing");
  button.textContent = "SISKI TESTING...";
  audio.currentTime = 0;
  audio.volume = 1;

  try {
    await audio.play();
  } catch {
    button.textContent = "CLICK HARDER";
  }

  setTimeout(() => {
    button.textContent = "TEST UR SISKI RN!!!111!1";
    button.classList.remove("testing");
  }, 2200);
});
