import React, { useState } from 'react';
import { VSCodeTextField, VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { useAuth } from '../../hooks/useAuth';
import { validateForm } from '../../utils/validation';
import './AuthForm.css';

const SignupForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({ email: null, password: null });
  const { register, loading, error: authError } = useAuth();

  const handleSubmit = (e) => {
    e.preventDefault();

    const validation = validateForm(email, password);

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({ email: null, password: null });
    register(email, password);
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <div className="auth-form-fields">
        <div className="input-wrapper">
          <VSCodeTextField
            type="email"
            value={email}
            onInput={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors({ ...errors, email: null });
            }}
            placeholder="Email"
            className="input-full-width"
          />
          {errors.email && <span className="input-error-text">{errors.email}</span>}
        </div>
        <div className="input-wrapper">
          <VSCodeTextField
            type="password"
            value={password}
            onInput={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors({ ...errors, password: null });
            }}
            placeholder="Password"
            className="input-full-width"
          />
          {errors.password && <span className="input-error-text">{errors.password}</span>}
        </div>
      </div>

      <VSCodeButton
        type="submit"
        appearance="primary"
        disabled={loading}
        className="signup-btn"
      >
        <b>Sign up</b>
      </VSCodeButton>
    </form>
  );
};

export default SignupForm;
