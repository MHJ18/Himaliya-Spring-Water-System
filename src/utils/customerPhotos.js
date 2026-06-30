const AVATAR_COLORS = ['#2e96ff', '#35ead3', '#5b8def', '#72ecff', '#3198ff', '#1a7fd4', '#4ecdc4'];
const AVATAR_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

function createAvatarDataUri(color, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="${color}"/><text x="48" y="58" text-anchor="middle" fill="#ffffff" font-size="34" font-family="Arial,sans-serif" font-weight="700">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const CUSTOMER_AVATARS = AVATAR_COLORS.map((color, index) => createAvatarDataUri(color, AVATAR_LABELS[index]));
export const ADMIN_AVATAR = CUSTOMER_AVATARS[5];

export function getCustomerAvatar(index) {
  return CUSTOMER_AVATARS[index % CUSTOMER_AVATARS.length];
}
