import React, { useState } from 'react';
import { ArrowUp } from 'lucide-react';
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
      setError('Invalid token');
      return;
    }
    
    setError('');
    onLogin(token);
    // Refresh the page
    window.location.reload();
    
  };

  return (
    <div className={styles.container}>
      <div className={styles.dialog}>
        <h2 className={styles.title}> Access token:</h2>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value.toLowerCase())}
              className={styles.input}
              autoFocus
              spellCheck={false}
              autoComplete="off"
            />
            
            {token && (
              <button 
                type="submit" 
                className={styles.button}
              >
                <ArrowUp size={16} />
              </button>
            )}
          </div>
          
          {error && <div className={styles.error}>{error}</div>}
        </form>
      </div>
    </div>
  );
}