/**
 * SearchableSelect — backward-compatibility shim.
 * All rendering is now handled by UnifiedSelect.
 *
 * Prop mapping:
 *   isMulti / multiple → multiple
 *   All other props forwarded as-is.
 */
import UnifiedSelect from './UnifiedSelect';

export default function SearchableSelect({ isMulti, multiple, chipColor: _ignored, ...rest }) {
  const multi = multiple ?? isMulti ?? false;
  return <UnifiedSelect multiple={multi} {...rest} />;
}
