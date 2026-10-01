import re

file_path = "src/pages/agreements/AgreementDetailPage.jsx"
with open(file_path, "r") as f:
    content = f.read()

# 1. Update loadVersionDetail
old_load_version_detail = """  const loadVersionDetail = useCallback(async (versionId) => {
    if (!versionId) return null;
    try {
      const [agrRes, tlRes] = await Promise.all([
        axiosInstance.get(ENDPOINTS.AGREEMENT_VERSION_BY_ID(versionId)),
        axiosInstance.get(ENDPOINTS.AGREEMENT_VERSION_TIMELINE(versionId)),
      ]);

      setAgreement(agrRes.data);

      // Fetch any missing vendor states
      if (agrRes.data?.vendors) {
        const vendorsMissingState = agrRes.data.vendors.filter(v => !v.state).map(v => v.vendorId);
        if (vendorsMissingState.length > 0) {
          integrationApi.getVendorsByIds(vendorsMissingState)
            .then(vendorRes => {
              const items = Array.isArray(vendorRes.data) ? vendorRes.data : [];
              const detailsMap = {};
              items.forEach(item => {
                detailsMap[item.vendorId ?? item.id ?? item.accountId] = item.state || item.company?.state || '';
              });
              setVendorDetails(detailsMap);
            })
            .catch(err => console.error("Failed to fetch missing vendor details", err));
        }
      }

      setTimeline(tlRes.data);
      return agrRes.data;
    } catch {
      enqueueSnackbar('Failed to load version details', { variant: 'error' });
      return null;
    }
  }, [enqueueSnackbar]);"""

new_load_version_detail = """  const loadVersionDetail = useCallback(async (versionId) => {
    if (!versionId) return null;
    try {
      const [agrRes, tlRes] = await Promise.all([
        axiosInstance.get(ENDPOINTS.AGREEMENT_VERSION_BY_ID(versionId)),
        axiosInstance.get(ENDPOINTS.AGREEMENT_VERSION_TIMELINE(versionId)),
      ]);

      const data = agrRes.data;
      setAgreement(data);
      setTimeline(tlRes.data);

      const isCommercialContracts = isCommercialContractsIncomeType([], data.incomeTypeId, data.incomeTypeName);
      const isAssetRental = isAssetRentalIncomeType([], data.incomeTypeId, data.incomeTypeName);

      // Fetch auxiliaries concurrently and catch individually to prevent crashing main details
      Promise.allSettled([
        (data.vendors && data.vendors.some(v => !v.state))
          ? integrationApi.getVendorsByIds(data.vendors.filter(v => !v.state).map(v => v.vendorId))
              .then(vendorRes => {
                const items = Array.isArray(vendorRes.data) ? vendorRes.data : [];
                const detailsMap = {};
                items.forEach(item => {
                  detailsMap[item.vendorId ?? item.id ?? item.accountId] = item.state || item.company?.state || '';
                });
                setVendorDetails(detailsMap);
              })
          : Promise.resolve(),
          
        (!isCommercialContracts && data.commercialStructure === 'SLAB')
          ? axiosInstance.get(ENDPOINTS.AGREEMENT_VERSION_SLABS(versionId))
              .then(res => setSlabs(Array.isArray(res.data) ? res.data : []))
          : Promise.resolve(setSlabs([])),
          
        isAssetRental
          ? fetchStoreMappings(versionId)
              .then(res => setAssetStoreMappings(Array.isArray(res) ? res : []))
          : Promise.resolve(setAssetStoreMappings([]))
      ]).catch(() => {
        // Fallback catch (should be handled by individual endpoints, but just in case)
      });

      return data;
    } catch {
      enqueueSnackbar('Failed to load version details', { variant: 'error' });
      return null;
    }
  }, [enqueueSnackbar]);"""

content = content.replace(old_load_version_detail, new_load_version_detail)

# 2. Remove useEffect for slabs
slab_effect = """  useEffect(() => {
    if (!selectedVersionId || !agreement) {
      setSlabs([]);
      return;
    }
    const isCommercialContracts = isCommercialContractsIncomeType(
      [],
      agreement.incomeTypeId,
      agreement.incomeTypeName,
    );
    if (isCommercialContracts || agreement.commercialStructure !== 'SLAB') {
      setSlabs([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axiosInstance.get(ENDPOINTS.AGREEMENT_VERSION_SLABS(selectedVersionId));
        if (!cancelled) setSlabs(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setSlabs([]);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedVersionId, agreement?.commercialStructure, agreement?.incomeTypeId, agreement?.incomeTypeName]);"""

content = content.replace(slab_effect, "")

# 3. Remove useEffect for stores (line 390 onwards)
store_effect_pattern = r"\s*useEffect\(\(\) => \{\s*if \(\!selectedVersionId \|\| \!isAssetRental\) \{.*?\s*\}, \[selectedVersionId, isAssetRental\]\);"
content = re.sub(store_effect_pattern, "", content, flags=re.DOTALL)

with open(file_path, "w") as f:
    f.write(content)
