import { useCallback, useEffect, useState } from 'react';
import { Alert, Grid, TextField, Typography } from '@mui/material';
import axiosInstance from '../../../api/axiosInstance';
import { ENDPOINTS } from '../../../config/endpoints';
import { normalizePageResponse } from '../../../utils/pageResponse';
import SearchableSelect from '../../../components/forms/SearchableSelect';
import WizardSectionCard from '../../../components/wizard/WizardSectionCard';

export default function Step1GroupSetup({ state, updateFields, groupFieldsLocked = false }) {
  const [groupOptions, setGroupOptions] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [createNewGroup, setCreateNewGroup] = useState(false);

  const loadGroups = useCallback(async (query) => {
    setLoadingGroups(true);
    try {
      const { data } = await axiosInstance.get(ENDPOINTS.AGREEMENT_GROUPS, {
        params: {
          ...(query?.trim() ? { groupName: query.trim() } : {}),
          isActive: true,
          size: 50,
          page: 0,
        },
      });
      const normalized = normalizePageResponse(data);
      const activeGroups = normalized.content.filter((group) => group.isActive !== false);
      setGroupOptions(activeGroups);
    } catch (err) {
      console.error('Failed to load agreement groups:', err);
      setFetchError('Failed to load agreement groups. Check API connection.');
      setGroupOptions([]);
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  useEffect(() => {
    loadGroups('');
  }, [loadGroups]);

  useEffect(() => {
    if (state.newAgreementGroupName?.trim()) {
      setCreateNewGroup(true);
      setSelectedGroup(null);
      return;
    }
    if (state.agreementGroupId && state.agreementGroupName) {
      setCreateNewGroup(false);
      setSelectedGroup({ id: state.agreementGroupId, name: state.agreementGroupName });
    }
  }, [
    state.agreementGroupId,
    state.agreementGroupName,
    state.newAgreementGroupName,
  ]);

  const handleGroupChange = (group) => {
    setSelectedGroup(group);
    setCreateNewGroup(false);
    updateFields({
      agreementGroupId: group?.id || null,
      agreementGroupName: group?.name || '',
      newAgreementGroupName: '',
    });
  };

  const handleNewGroupNameChange = (e) => {
    const value = e.target.value;
    setCreateNewGroup(true);
    setSelectedGroup(null);
    updateFields({
      agreementGroupId: null,
      agreementGroupName: '',
      newAgreementGroupName: value,
    });
  };

  return (
    <WizardSectionCard
      title="Agreement Group"
      description="Select an existing agreement group or create a new one for this wizard session."
    >
      {fetchError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFetchError(null)}>
          {fetchError}
        </Alert>
      )}

      {groupFieldsLocked && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Agreement group is locked after the draft is saved. To use a different group,
          deactivate this group and create a new one.
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }} sx={{ overflow: 'visible' }}>
          <SearchableSelect
            label="Agreement Group"
            placeholder="Search existing groups…"
            isMulti={false}
            options={groupOptions}
            value={createNewGroup ? null : selectedGroup}
            onChange={handleGroupChange}
            onSearch={loadGroups}
            getOptionLabel={(o) => o.name || ''}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            loading={loadingGroups}
            disabled={groupFieldsLocked}
            required={!createNewGroup}
          />
        </Grid>

        {!groupFieldsLocked && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Or create a new group
            </Typography>
            <TextField
              label="New group name"
              value={state.newAgreementGroupName || ''}
              onChange={handleNewGroupNameChange}
              fullWidth
              size="small"
              slotProps={{ htmlInput: { maxLength: 255 } }}
            />
          </Grid>
        )}
      </Grid>
    </WizardSectionCard>
  );
}
