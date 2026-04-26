export default function Button({ children, variant = 'primary', className = '', onClick, type = 'button' }) {
  const styles = {
    primary:   { background: 'var(--primary)',  color: 'white',             border: 'none' },
    secondary: { background: 'transparent',     color: 'var(--text-h)',     border: '1px solid var(--border)' },
    danger:    { background: 'var(--danger)',    color: 'white',             border: 'none' },
    ghost:     { background: 'var(--primary-bg)', color: 'var(--primary)',   border: 'none' },
  }

  return (
    <button
      type={type}
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-opacity hover:opacity-85 ${className}`}
      style={styles[variant] || styles.primary}
    >
      {children}
    </button>
  )
}
