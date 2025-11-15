// utils/authErrorMessages.js
export const getAuthErrorMessage = (errorCode) => {
  const errorMessages = {
    // Login Errors
    'auth/invalid-credential': 'Invalid email or password. Please check your credentials and try again.',
    'auth/user-not-found': 'No account found with this email address.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-disabled': 'This account has been disabled. Please contact support.',
    'auth/too-many-requests': 'Too many failed login attempts. Please try again later.',
    
    // Registration Errors
    'auth/email-already-in-use': 'An account with this email already exists. Please login instead.',
    'auth/weak-password': 'Password is too weak. Please use at least 6 characters with a mix of letters and numbers.',
    'auth/operation-not-allowed': 'Registration is currently disabled. Please contact support.',
    
    // Password Reset Errors
    'auth/expired-action-code': 'This reset link has expired. Please request a new one.',
    'auth/invalid-action-code': 'This reset link is invalid. Please request a new one.',
    
    // Network Errors
    'auth/network-request-failed': 'Network error. Please check your internet connection and try again.',
    
    // Generic Errors
    'auth/internal-error': 'Something went wrong. Please try again.',
    'auth/invalid-api-key': 'Configuration error. Please contact support.',
  };

  return errorMessages[errorCode] || 'An unexpected error occurred. Please try again.';
};