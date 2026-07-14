const STORAGE_KEY = 'agreement-tracker:wizard-steps';

function readStepMap() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStepMap(map) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function rememberWizardStep(agreementKey, internalStep) {
  if (agreementKey == null || agreementKey === '' || internalStep == null) return;
  const map = readStepMap();
  map[String(agreementKey)] = internalStep;
  writeStepMap(map);
}

export function getRememberedWizardStep(agreementKey) {
  if (agreementKey == null || agreementKey === '') return null;
  const value = readStepMap()[String(agreementKey)];
  return typeof value === 'number' && !Number.isNaN(value) ? value : null;
}

export function clearRememberedWizardStep(agreementKey) {
  if (agreementKey == null || agreementKey === '') return;
  const map = readStepMap();
  if (!(String(agreementKey) in map)) return;
  delete map[String(agreementKey)];
  writeStepMap(map);
}

export function resolveWizardStepForAgreement(agreementKey, {
  forcedInternalStep = null,
  urlStepParam = null,
  isActiveAgreement = false,
} = {}) {
  if (forcedInternalStep != null) return forcedInternalStep;

  const remembered = getRememberedWizardStep(agreementKey);
  if (remembered != null) return remembered;

  if (isActiveAgreement && urlStepParam != null && urlStepParam !== '') {
    const parsed = Number.parseInt(urlStepParam, 10);
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 4) {
      return parsed - 1;
    }
  }

  return 0;
}
