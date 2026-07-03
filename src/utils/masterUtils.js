/** Jackson may serialize boolean isActive as "active"; support both keys. */
export function isRecordActive(record) {
  if (!record) return false;
  if (typeof record.isActive === 'boolean') return record.isActive;
  if (typeof record.active === 'boolean') return record.active;
  return false;
}
