import { useCallback, useEffect, useState } from 'react';
import { Alert, Grid, TextField, Typography } from '@mui/material';
import axiosInstance from '../../../api/axiosInstance';
import { ENDPOINTS } from '../../../config/endpoints';
import SearchableSelect from '../../../components/forms/SearchableSelect';
import WizardSectionCard from '../../../components/wizard/WizardSectionCard';

export default function Step1CompanyVendors({ state, updateFields, groupFieldsLocked = false }) {
  const [companyOptions, setCompanyOptions] = useState([]);
  const [groupOptions, setGroupOptions] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [createNewGroup, setCreateNewGroup] = useState(false);

  const searchCompanies = useCallback(async (query) => {
    setLoadingCompanies(true);
    try {
      const { data } = await axiosInstance.get(ENDPOINTS.COMPANIES, {
        params: query?.trim() ? { search: query.trim() } : {},
      });
      setCompanyOptions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to search companies:', err);
      setFetchError('Failed to load companies. Check API connection.');
      setCompanyOptions([]);
    } finally {
      setLoadingCompanies(false);
    }
  }, []);

  const loadGroups = useCallback(async (companyId) => {
    if (!companyId) {
      setGroupOptions((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    setLoadingGroups(true);
    try {
      const { data } = await axiosInstance.get(ENDPOINTS.COMPANY_AGREEMENT_GROUPS(companyId));
      const activeGroups = (Array.isArray(data) ? data : []).filter((group) => group.isActive !== false);
      setGroupOptions(activeGroups);
    } catch (err) {
      console.error('Failed to load company agreement groups:', err);
      setGroupOptions([]);
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  const handleGroupSearch = useCallback(() => {
    loadGroups(state.companyId);
  }, [loadGroups, state.companyId]);

  useEffect(() => {
    if (state.companyId && state.companyName) {
      setSelectedCompany({ id: state.companyId, companyName: state.companyName });
    }
  }, [state.companyId, state.companyName]);

  useEffect(() => {
    if (state.companyId) {
      loadGroups(state.companyId);
    }
  }, [state.companyId, loadGroups]);

  useEffect(() => {
    if (state.newCompanyAgreementGroupName?.trim()) {
      setCreateNewGroup(true);
      setSelectedGroup(null);
      return;
    }
    if (state.companyAgreementGroupId && state.companyAgreementGroupName) {
      setCreateNewGroup(false);
      setSelectedGroup({ id: state.companyAgreementGroupId, name: state.companyAgreementGroupName });
    }
  }, [
    state.companyAgreementGroupId,
    state.companyAgreementGroupName,
    state.newCompanyAgreementGroupName,
  ]);

  const handleCompanyChange = (company) => {
    setSelectedCompany(company);
    setSelectedGroup(null);
    setCreateNewGroup(false);
    updateFields({
      companyId: company?.id || null,
      companyName: company?.companyName || '',
      companyAgreementGroupId: null,
      companyAgreementGroupName: '',
      newCompanyAgreementGroupName: '',
    });
  };

  const handleGroupChange = (group) => {
    setSelectedGroup(group);
    setCreateNewGroup(false);
    updateFields({
      companyAgreementGroupId: group?.id || null,
      companyAgreementGroupName: group?.name || '',
      newCompanyAgreementGroupName: '',
    });
  };

  const handleNewGroupNameChange = (e) => {
    const value = e.target.value;
    setCreateNewGroup(true);
    setSelectedGroup(null);
    updateFields({
      companyAgreementGroupId: null,
      companyAgreementGroupName: '',
      newCompanyAgreementGroupName: value,
    });
  };

  return (
    <WizardSectionCard
      title="Partner Details"
      description="Select the company and agreement group for this wizard session."
    >
      {fetchError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFetchError(null)}>
          {fetchError}
        </Alert>
      )}

      {groupFieldsLocked && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Company and agreement group are locked after the draft is saved. To use a different company or group,
          deactivate this group and create a new one.
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <SearchableSelect
            label="Company"
            placeholder="Search company name…"
            isMulti={false}
            options={companyOptions}
            value={selectedCompany}
            onChange={handleCompanyChange}
            onSearch={searchCompanies}
            getOptionLabel={(o) => o.companyName || ''}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            loading={loadingCompanies}
            disabled={groupFieldsLocked}
            required
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <SearchableSelect
            label="Company Agreement Group"
            placeholder={state.companyId ? 'Select existing group…' : 'Select company first'}
            isMulti={false}
            options={groupOptions}
            value={createNewGroup ? null : selectedGroup}
            onChange={handleGroupChange}
            onSearch={handleGroupSearch}
            getOptionLabel={(o) => o.name || ''}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            loading={loadingGroups}
            disabled={groupFieldsLocked || !state.companyId}
            required={!createNewGroup}
          />
          {!groupFieldsLocked && (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Or create a new group
              </Typography>
              <TextField
                label="New group name"
                value={state.newCompanyAgreementGroupName || ''}
                onChange={handleNewGroupNameChange}
                fullWidth
                size="small"
                disabled={!state.companyId}
                sx={{ mt: 1 }}
                slotProps={{ htmlInput: { maxLength: 255 } }}
              />
            </>
          )}
        </Grid>
      </Grid>
    </WizardSectionCard>
  );
}
