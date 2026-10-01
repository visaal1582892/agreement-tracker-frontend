import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { urlStepFromInternal } from '../utils/agreementWizardUtils';

export function useDraftRouting() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingStepIndex, setPendingStepIndex] = useState(null);
  const [isNavWarningOpen, setIsNavWarningOpen] = useState(false);

  const syncStepToUrl = useCallback((internalStep) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('step', String(urlStepFromInternal(internalStep)));
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  return {
    searchParams,
    setSearchParams,
    pendingStepIndex,
    setPendingStepIndex,
    isNavWarningOpen,
    setIsNavWarningOpen,
    syncStepToUrl,
  };
}
