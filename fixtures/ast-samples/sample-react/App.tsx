import React, { useState } from 'react';

interface HeaderProps {
  title: string;
  user?: string;
}

export function Header({ title, user }: HeaderProps) {
  return (
    <header className="site-header">
      <h1 data-testid="app-title">{title}</h1>
      {user ? <span id="user-badge">Hello, {user}</span> : <a href="/login" id="login-link">Sign In</a>}
    </header>
  );
}

export function TodoApp() {
  const [items, setItems] = useState<string[]>([]);
  const [inputVal, setInputVal] = useState('');

  return (
    <div className="todo-container">
      <Header title="My Tasks" user="Tester" />
      <form id="todo-form" onSubmit={(e) => e.preventDefault()}>
        <input
          id="todo-field"
          data-testid="todo-input"
          placeholder="What needs to be done?"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
        />
        <button type="submit" id="submit-todo" data-testid="add-btn">
          Add
        </button>
      </form>
      {items.length === 0 && <p className="empty-msg">No tasks yet</p>}
    </div>
  );
}
