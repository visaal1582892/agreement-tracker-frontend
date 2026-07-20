/**
 * MUI v6+/v9 Autocomplete → TextField bridge.
 * Autocomplete still supplies legacy `inputProps` / `InputProps` on render params;
 * spreading those onto TextField forwards `inputProps` to a DOM node and triggers
 * "React does not recognize the 'inputProps' prop on a DOM element".
 */
export function toMuiTextFieldSlotProps(params = {}) {
  const {
    InputProps,
    inputProps,
    InputLabelProps,
    inputLabelProps,
    ...rest
  } = params;

  return {
    ...rest,
    slotProps: {
      ...(rest.slotProps ?? {}),
      input: {
        ...(rest.slotProps?.input ?? {}),
        ...(InputProps ?? {}),
      },
      htmlInput: {
        ...(rest.slotProps?.htmlInput ?? {}),
        ...(inputProps ?? {}),
      },
      inputLabel: {
        ...(rest.slotProps?.inputLabel ?? {}),
        ...(InputLabelProps ?? inputLabelProps ?? {}),
      },
    },
  };
}

/** Blur focused control before opening a modal so aria-hidden on #root is valid. */
export function blurActiveElement() {
  if (typeof document === 'undefined') return;
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    active.blur();
  }
}
