import React, { useState } from 'react';
import styles from './Login.module.css';

interface LoginProps {
  onLogin: (token: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate token format (32 character hex string)
    if (token.length !== 32 || !/^[a-f0-9]+$/.test(token)) {
      setError('Invalid token format');
      return;
    }
    
    setError('');
    onLogin(token);
  };

  return (
    <div className={styles.container}>
      <div className={styles.dialog}>
        <h1 className={styles.title}>Login</h1>
        <p className={styles.subtitle}>Enter your access token</p>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value.toLowerCase())}
            placeholder="32 character token"
            className={styles.input}
            autoFocus
            spellCheck={false}
            autoComplete="off"
          />
          
          {error && <div className={styles.error}>{error}</div>}
          
          <button 
            type="submit" 
            className={styles.button}
            disabled={!token}
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}