export function getScrollParent(node) {
  if (!node) return null;
  let parent = node.parentElement;
  while (parent) {
    const { overflowY } = window.getComputedStyle(parent);
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

export function scrollElementIntoView(target, offset = 0) {
  if (!target) return;

  const scrollParent = getScrollParent(target);
  if (!scrollParent) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  const targetTop = target.getBoundingClientRect().top;
  const parentTop = scrollParent.getBoundingClientRect().top;

  scrollParent.scrollTo({
    top: scrollParent.scrollTop + targetTop - parentTop - offset,
    behavior: 'smooth',
  });
}
