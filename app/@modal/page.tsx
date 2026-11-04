// Soft navigation keeps a slot's previous content unless the new URL matches
// it, so `/` needs its own empty page for the issue panel to close.
export default function NoPanel() {
  return null;
}
