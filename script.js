const pluginFiles = ['_meta.lua', 'main.lua', 'kchat_protocol.lua'];

const ui = {
  supportPill: document.querySelector('#support-pill'),
  unsupported: document.querySelector('#unsupported'),
  chooseButton: document.querySelector('#choose-button'),
  chooseLabel: document.querySelector('#choose-label'),
  installButton: document.querySelector('#install-button'),
  installLabel: document.querySelector('#install-label'),
  deviceCard: document.querySelector('#device-card'),
  deviceName: document.querySelector('#device-name'),
  existingNote: document.querySelector('#existing-note'),
  errorBox: document.querySelector('#error-box'),
  errorText: document.querySelector('#error-text'),
  progressWrap: document.querySelector('#progress-wrap'),
  progressValue: document.querySelector('#progress-value'),
  progressBar: document.querySelector('#progress-bar'),
  successBox: document.querySelector('#success-box'),
  successText: document.querySelector('#success-text'),
  stepConnect: document.querySelector('#step-connect'),
  stepVerify: document.querySelector('#step-verify'),
  stepInstall: document.querySelector('#step-install'),
};

let pluginsDirectory = null;
let selectedDeviceName = '';
let existingInstall = false;

function setHidden(element, hidden) {
  element.classList.toggle('hidden', hidden);
}

function setProgress(value) {
  ui.progressValue.textContent = `${value}%`;
  ui.progressBar.style.width = `${value}%`;
}

function clearMessages() {
  setHidden(ui.errorBox, true);
  setHidden(ui.successBox, true);
}

function showError(message) {
  ui.errorText.textContent = message;
  setHidden(ui.errorBox, false);
  setHidden(ui.progressWrap, true);
  ui.installButton.disabled = false;
  ui.chooseButton.disabled = false;
}

function setStep(element, state) {
  element.classList.toggle('active', state === 'active');
  element.classList.toggle('complete', state === 'complete');
}

async function getKoreaderPlugins(root) {
  const adds = await root.getDirectoryHandle('.adds');
  const koreader = await adds.getDirectoryHandle('koreader');
  return koreader.getDirectoryHandle('plugins');
}

async function hasExistingKChat(plugins) {
  try {
    await plugins.getDirectoryHandle('kchat.koplugin');
    return true;
  } catch {
    return false;
  }
}

async function writePluginFile(pluginDirectory, filename) {
  const response = await fetch(`/plugin/${filename}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not download ${filename}.`);
  const target = await pluginDirectory.getFileHandle(filename, { create: true });
  const writable = await target.createWritable();
  await writable.write(await response.blob());
  await writable.close();
}

async function chooseKobo() {
  clearMessages();
  try {
    const root = await window.showDirectoryPicker({ id: 'kchat-kobo-drive', mode: 'readwrite' });
    const plugins = await getKoreaderPlugins(root);
    existingInstall = await hasExistingKChat(plugins);
    pluginsDirectory = plugins;
    selectedDeviceName = root.name;

    ui.deviceName.textContent = selectedDeviceName;
    ui.chooseLabel.textContent = 'Choose a different Kobo';
    ui.installLabel.textContent = existingInstall ? 'Update KChat' : 'Install KChat';
    setHidden(ui.deviceCard, false);
    setHidden(ui.existingNote, !existingInstall);
    setHidden(ui.installButton, false);
    setHidden(ui.progressWrap, true);
    setProgress(0);
    setStep(ui.stepConnect, 'complete');
    setStep(ui.stepVerify, 'active');
    setStep(ui.stepInstall, 'idle');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    showError('That folder does not look like a Kobo with KOReader installed. Choose the KOBOeReader drive itself, not a folder inside it.');
  }
}

async function installKChat() {
  if (!pluginsDirectory) return;
  clearMessages();
  ui.chooseButton.disabled = true;
  ui.installButton.disabled = true;
  setHidden(ui.progressWrap, false);
  setStep(ui.stepVerify, 'complete');
  setStep(ui.stepInstall, 'active');
  setProgress(8);

  try {
    const plugin = await pluginsDirectory.getDirectoryHandle('kchat.koplugin', { create: true });
    for (let index = 0; index < pluginFiles.length; index += 1) {
      await writePluginFile(plugin, pluginFiles[index]);
      setProgress(28 + (index + 1) * 22);
    }

    const verification = await plugin.getFileHandle('main.lua');
    const installedMain = await verification.getFile();
    if (installedMain.size < 1000) throw new Error('The installed file is incomplete.');

    setProgress(100);
    existingInstall = true;
    setHidden(ui.progressWrap, true);
    setHidden(ui.installButton, true);
    setHidden(ui.existingNote, true);
    setStep(ui.stepInstall, 'complete');
    ui.successText.textContent = `Safely eject ${selectedDeviceName}, restart KOReader, then open Tools → KChat. Repeat on the second Kobo.`;
    setHidden(ui.successBox, false);
    ui.chooseButton.disabled = false;
  } catch (error) {
    showError(error instanceof Error ? error.message : 'The browser could not write to the Kobo. Reconnect it and try again.');
  }
}

const supported = typeof window.showDirectoryPicker === 'function';
ui.chooseButton.disabled = !supported;
ui.supportPill.textContent = supported ? '✓ Runs locally in your browser' : '⚠ Chrome or Edge required';
ui.supportPill.classList.toggle('unsupported', !supported);
setHidden(ui.unsupported, supported);
ui.chooseButton.addEventListener('click', chooseKobo);
ui.installButton.addEventListener('click', installKChat);
