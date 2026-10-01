/**
 * MultiSearchSelect — backward-compatibility shim.
 * All rendering is now handled by UnifiedSelect.
 *
 * Prop mapping:
 *   chipColor is silently dropped (UnifiedSelect always uses BRAND.red)
 *   All other props forwarded as-is.
 */
import UnifiedSelect from './UnifiedSelect';

export default function MultiSearchSelect({ chipColor: _ignored, ...rest }) {
  return <UnifiedSelect multiple {...rest} />;
}
