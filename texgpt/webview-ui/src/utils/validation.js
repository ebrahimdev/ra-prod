/**
 * Validation utilities for forms
 */

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password) => {
  return password && password.length >= 6;
};

export const getEmailError = (email) => {
  if (!email || email.trim() === '') {
    return 'Email is required';
  }
  if (!validateEmail(email)) {
    return 'Please enter a valid email address';
  }
  return null;
};

export const getPasswordError = (password) => {
  if (!password || password === '') {
    return 'Password is required';
  }
  if (!validatePassword(password)) {
    return 'Password must be at least 6 characters long';
  }
  return null;
};

export const validateForm = (email, password) => {
  const emailError = getEmailError(email);
  const passwordError = getPasswordError(password);

  return {
    isValid: !emailError && !passwordError,
    errors: {
      email: emailError,
      password: passwordError
    }
  };
};
