import { createContext, useContext } from 'react';

export const WizardStateContext = createContext(null);
export const WizardDispatchContext = createContext(null);

export function useWizardState() {
  const context = useContext(WizardStateContext);
  if (!context) {
    throw new Error('useWizardState must be used within a WizardStateContext.Provider');
  }
  return context;
}

export function useWizardDispatch() {
  const context = useContext(WizardDispatchContext);
  if (!context) {
    throw new Error('useWizardDispatch must be used within a WizardDispatchContext.Provider');
  }
  return context;
}
