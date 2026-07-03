import { Box, Step, StepLabel, Stepper, Typography, Paper, Button, Chip, Tabs, Tab, alpha, IconButton } from '@mui/material';
import { Close } from '@mui/icons-material';
import { BRAND } from '../config/theme';

const STEPS = [
  'Foundational Setup',
  'Commercial Configuration',
  'Commercial Structure',
  'Review & Submit',
];

const cardSx = {
  borderRadius: 3.5,
  border: '1px solid rgba(226, 232, 240, 0.8)',
  boxShadow: '0 4px 24px rgba(15, 23, 42, 0.05)',
  bgcolor: '#fff',
};

export default function WizardLayout({
  activeStep,
  agreementTabLabel = 'New Agreement',
  draftTabs = [],
  activeDraftId,
  onDraftTabChange,
  onDraftTabDelete,
  submitButtonLabel = 'Submit for Approval',
  onStepClick,
  maxReachableStep,
  children,
  onBack,
  onCancel,
  footerMode = 'setup',
  onNext,
  onSaveAndClose,
  onSaveAndCreateAnother,
  onFinishAndExit,
  onDetailsNext,
  onCommercialsNext,
  showDraftTabs = true,
  onSubmitForApproval,
  isSavingDraft,
  isSubmitting,
  isSavingLoop,
}) {
  const busy = isSavingDraft || isSubmitting || isSavingLoop;
  const reachableStep = maxReachableStep ?? activeStep;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Paper
        elevation={0}
        sx={{
          ...cardSx,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {showDraftTabs && draftTabs.length > 0 ? (
          <Box sx={{
            px: { xs: 1, md: 2 },
            background: '#FAFBFC',
            borderBottom: '1px solid #F1F5F9',
          }}>
            <Tabs
              value={activeDraftId ?? false}
              onChange={(_, value) => onDraftTabChange?.(value)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                minHeight: 44,
                '& .MuiTab-root': {
                  minHeight: 44,
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  maxWidth: 220,
                },
                '& .Mui-selected': { color: BRAND.red },
                '& .MuiTabs-indicator': { bgcolor: BRAND.red },
              }}
            >
              {draftTabs.map((tab) => (
                <Tab
                  key={tab.agreementId}
                  component="div"
                  value={tab.agreementId}
                  label={(
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, maxWidth: '100%' }}>
                      <Box
                        component="span"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {tab.label}
                      </Box>
                      {onDraftTabDelete && (
                        <IconButton
                          size="small"
                          aria-label={`Delete ${tab.label}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onDraftTabDelete(tab.agreementId);
                          }}
                          sx={{
                            p: 0.25,
                            ml: 0.25,
                            color: 'text.secondary',
                            '&:hover': { color: BRAND.red, bgcolor: alpha(BRAND.red, 0.08) },
                          }}
                        >
                          <Close sx={{ fontSize: 16 }} />
                        </IconButton>
                      )}
                    </Box>
                  )}
                />
              ))}
            </Tabs>
          </Box>
        ) : (
          <Box sx={{
            px: { xs: 2, md: 3 },
            py: 1.25,
            background: '#FAFBFC',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}>
            <Chip
              label={agreementTabLabel}
              size="small"
              sx={{
                fontWeight: 700,
                bgcolor: alpha(BRAND.red, 0.08),
                color: BRAND.red,
                border: `1px solid ${alpha(BRAND.red, 0.2)}`,
                maxWidth: '100%',
                '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
              }}
            />
          </Box>
        )}

        <Box sx={{
          px: { xs: 2, md: 3 },
          py: 2,
          background: 'linear-gradient(180deg, #FAFBFC 0%, #fff 100%)',
          borderBottom: '1px solid #F1F5F9',
        }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {STEPS.map((label, index) => (
              <Step key={label} completed={index < activeStep}>
                <StepLabel
                  onClick={() => {
                    if (index <= reachableStep && onStepClick) {
                      onStepClick(index);
                    }
                  }}
                  sx={{
                    cursor: index <= reachableStep && onStepClick ? 'pointer' : 'default',
                  }}
                  slotProps={{
                    stepIcon: {
                      sx: {
                        width: 32,
                        height: 32,
                        '&.Mui-active': {
                          color: BRAND.red,
                          boxShadow: `0 0 0 4px ${alpha(BRAND.red, 0.12)}`,
                          borderRadius: '50%',
                        },
                        '&.Mui-completed': { color: BRAND.green },
                      },
                    },
                  }}
                >
                  <Typography
                    variant="caption"
                    fontWeight={activeStep === index ? 700 : 500}
                    color={activeStep === index ? BRAND.red : 'text.secondary'}
                    sx={{ display: { xs: 'none', sm: 'block' } }}
                  >
                    {label}
                  </Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        <Box sx={{ flex: 1, p: { xs: 2.5, md: 3.5 }, display: 'flex', flexDirection: 'column' }}>
          {children}
        </Box>

        <Box sx={{
          px: { xs: 2.5, md: 3.5 },
          py: 2.5,
          borderTop: '1px solid #F1F5F9',
          background: '#FAFBFC',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          flexShrink: 0,
          flexWrap: 'wrap',
        }}>
          <Button
            variant="outlined"
            onClick={onCancel}
            sx={{
              color: '#64748B',
              borderColor: '#E2E8F0',
              borderRadius: 2.5,
              px: 2.5,
              '&:hover': { borderColor: '#CBD5E1', bgcolor: '#fff' },
            }}
          >
            Cancel
          </Button>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              onClick={onBack}
              disabled={activeStep === 0 || busy}
              sx={{ borderRadius: 2.5, px: 2.5, minWidth: 90 }}
            >
              Back
            </Button>

            {footerMode === 'setup' && (
              <>
                <Button
                  variant="contained"
                  onClick={onNext}
                  disabled={busy}
                  sx={{
                    borderRadius: 2.5,
                    px: 3,
                    minWidth: 120,
                    fontWeight: 700,
                    background: BRAND.redGradient,
                    boxShadow: `0 4px 14px ${alpha(BRAND.red, 0.3)}`,
                    '&:hover': { background: BRAND.redGradient },
                  }}
                >
                  Next
                </Button>
              </>
            )}

            {footerMode === 'details' && (
              <>
                {onDetailsNext ? (
                  <Button
                    variant="contained"
                    onClick={onDetailsNext}
                    disabled={busy}
                    sx={{
                      borderRadius: 2.5,
                      px: 3,
                      minWidth: 120,
                      fontWeight: 700,
                      background: BRAND.redGradient,
                      boxShadow: `0 4px 14px ${alpha(BRAND.red, 0.3)}`,
                      '&:hover': { background: BRAND.redGradient },
                    }}
                  >
                    {isSavingDraft ? 'Saving…' : 'Next'}
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    onClick={onFinishAndExit}
                    disabled={busy}
                    sx={{ borderRadius: 2.5, px: 2.5, minWidth: 130, fontWeight: 600 }}
                  >
                    {isSavingDraft ? 'Saving…' : 'Finish & Exit'}
                  </Button>
                )}
              </>
            )}

            {footerMode === 'commercials' && onCommercialsNext && (
              <Button
                variant="contained"
                onClick={onCommercialsNext}
                disabled={busy}
                sx={{
                  borderRadius: 2.5,
                  px: 3,
                  minWidth: 120,
                  fontWeight: 700,
                  background: BRAND.redGradient,
                  boxShadow: `0 4px 14px ${alpha(BRAND.red, 0.3)}`,
                  '&:hover': { background: BRAND.redGradient },
                }}
              >
                {isSavingDraft ? 'Saving…' : 'Next'}
              </Button>
            )}

            {footerMode === 'review' && (
              <>
                {onSaveAndCreateAnother && (
                  <Button
                    variant="outlined"
                    onClick={onSaveAndCreateAnother}
                    disabled={busy}
                    sx={{
                      borderRadius: 2.5,
                      px: 2.5,
                      minWidth: 190,
                      fontWeight: 600,
                      borderColor: '#E2E8F0',
                      color: '#334155',
                      '&:hover': { borderColor: '#CBD5E1', bgcolor: '#fff' },
                    }}
                  >
                    {isSavingLoop ? 'Saving…' : 'Save & Create Another'}
                  </Button>
                )}
                <Button
                  variant="contained"
                  onClick={onSubmitForApproval}
                  disabled={busy}
                  sx={{
                    borderRadius: 2.5,
                    px: 3,
                    minWidth: 160,
                    fontWeight: 700,
                    background: BRAND.redGradient,
                    boxShadow: `0 4px 14px ${alpha(BRAND.red, 0.3)}`,
                    '&:hover': { background: BRAND.redGradient },
                  }}
                >
                  {isSubmitting ? 'Submitting…' : submitButtonLabel}
                </Button>
              </>
            )}

            {footerMode === 'revision' && (
              <>
                {activeStep < 3 && (
                  <Button
                    variant="contained"
                    onClick={onNext}
                    disabled={busy}
                    sx={{
                      borderRadius: 2.5,
                      px: 3,
                      minWidth: 120,
                      fontWeight: 700,
                      background: BRAND.redGradient,
                      boxShadow: `0 4px 14px ${alpha(BRAND.red, 0.3)}`,
                      '&:hover': { background: BRAND.redGradient },
                    }}
                  >
                    Next
                  </Button>
                )}
                {activeStep === 3 && (
                  <Button
                    variant="contained"
                    onClick={onSubmitForApproval}
                    disabled={busy}
                    sx={{
                      borderRadius: 2.5,
                      px: 3,
                      minWidth: 160,
                      fontWeight: 700,
                      background: BRAND.redGradient,
                      boxShadow: `0 4px 14px ${alpha(BRAND.red, 0.3)}`,
                      '&:hover': { background: BRAND.redGradient },
                    }}
                  >
                    {isSubmitting ? 'Submitting…' : submitButtonLabel}
                  </Button>
                )}
              </>
            )}
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
