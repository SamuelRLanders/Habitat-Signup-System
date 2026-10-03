// Spots used by a shift's confirmed signups: each takes its registration's size.
export function spotsTaken(signups: { registration: { size: number } }[]) {
  return signups.reduce((sum, s) => sum + s.registration.size, 0);
}
