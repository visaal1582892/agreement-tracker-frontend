import { useState, useEffect } from 'react';
import { assetTypeApi } from '../api/masterApi';

let cachedAssetTypes = null;
let inFlightPromise = null;

export async function fetchActiveAssetTypes(forceRefresh = false) {
  if (cachedAssetTypes && !forceRefresh) {
    return cachedAssetTypes;
  }
  if (inFlightPromise && !forceRefresh) {
    return inFlightPromise;
  }

  inFlightPromise = assetTypeApi
    .list()
    .then((data) => {
      const items = Array.isArray(data) ? data : [];
      cachedAssetTypes = items;
      inFlightPromise = null;
      return items;
    })
    .catch((err) => {
      console.warn('Failed to fetch active asset types, using fallback:', err);
      inFlightPromise = null;
      return null;
    });

  return inFlightPromise;
}

export function invalidateAssetTypesCache() {
  cachedAssetTypes = null;
  inFlightPromise = null;
}

export function useAssetTypes() {
  const [assetTypes, setAssetTypes] = useState(cachedAssetTypes || []);
  const [loading, setLoading] = useState(!cachedAssetTypes);

  useEffect(() => {
    let isMounted = true;

    if (cachedAssetTypes) {
      setAssetTypes(cachedAssetTypes);
      setLoading(false);
      return;
    }

    fetchActiveAssetTypes().then((data) => {
      if (isMounted) {
        if (data && data.length > 0) {
          setAssetTypes(data);
        }
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return { assetTypes, loading };
}
