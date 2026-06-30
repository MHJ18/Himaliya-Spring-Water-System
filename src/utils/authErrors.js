export function mapLoginError(error) {
  const message = (error && error.message) || '';
  const status = error && error.status;
  const normalized = message.toLowerCase();

  if (
    status === 400
    || status === 401
    || normalized.includes('invalid login credentials')
    || normalized.includes('invalid email or password')
    || normalized.includes('invalid_grant')
  ) {
    return 'Incorrect username or password.';
  }

  if (normalized.includes('email not confirmed')) {
    return 'Your email is not confirmed yet. Check your inbox, then try again.';
  }

  if (normalized.includes('not allowed to access')) {
    return 'This account does not have admin access to the dashboard.';
  }

  if (normalized.includes('supabase is not configured') || normalized.includes('configuration is required')) {
    return 'Sign-in is unavailable because Supabase is not configured for this app.';
  }

  if (normalized.includes('network') || normalized.includes('failed to fetch')) {
    return 'Could not reach the sign-in service. Check your internet connection and try again.';
  }

  if (message && !normalized.includes('supabase request failed')) {
    return message;
  }

  return 'Unable to sign in right now. Please try again in a moment.';
}
