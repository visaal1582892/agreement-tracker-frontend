import { Link, Typography } from '@mui/material';
import { openDocumentPreview } from '../../api/uploadApi';
import { BRAND } from '../../config/theme';

export default function DocumentFileLink({
  fileUrl,
  fileName,
  variant = 'body2',
  noWrap = false,
  fontWeight,
  sx,
  ...typographyProps
}) {
  const label = fileName || 'Document';

  if (!fileUrl) {
    return (
      <Typography
        variant={variant}
        noWrap={noWrap}
        fontWeight={fontWeight}
        sx={sx}
        title={label}
        {...typographyProps}
      >
        {label}
      </Typography>
    );
  }

  return (
    <Link
      component="button"
      type="button"
      variant={variant}
      onClick={() => openDocumentPreview(fileUrl)}
      title={`Open ${label} in new tab`}
      sx={{
        textAlign: 'left',
        color: BRAND.red,
        cursor: 'pointer',
        textDecoration: 'none',
        fontWeight,
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: noWrap ? 'nowrap' : 'normal',
        '&:hover': { textDecoration: 'underline' },
        ...sx,
      }}
      {...typographyProps}
    >
      {label}
    </Link>
  );
}
