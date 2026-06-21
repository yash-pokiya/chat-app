export const BACKGROUND_PRESETS = [
  { 
    id: 'default', 
    label: 'Default', 
    style: { background: '#FFFFFF' },
    darkStyle: { background: '#090d16' }
  },
  { 
    id: 'lavender', 
    label: 'Lavender', 
    style: { background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)' },
    darkStyle: { background: 'linear-gradient(135deg,#1e1b4b,#090d16)' }
  },
  { 
    id: 'mint', 
    label: 'Mint', 
    style: { background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)' },
    darkStyle: { background: 'linear-gradient(135deg,#064e3b,#090d16)' }
  },
  { 
    id: 'peach', 
    label: 'Peach', 
    style: { background: 'linear-gradient(135deg,#fff7ed,#ffedd5)' },
    darkStyle: { background: 'linear-gradient(135deg,#7c2d12,#090d16)' }
  },
  { 
    id: 'sky', 
    label: 'Sky Blue', 
    style: { background: 'linear-gradient(135deg,#f0f9ff,#e0f2fe)' },
    darkStyle: { background: 'linear-gradient(135deg,#0c4a6e,#090d16)' }
  },
  { 
    id: 'rose', 
    label: 'Rose', 
    style: { background: 'linear-gradient(135deg,#fff1f2,#ffe4e6)' },
    darkStyle: { background: 'linear-gradient(135deg,#881337,#090d16)' }
  },
  {
    id: 'dots', 
    label: 'Dots Pattern',
    style: {
      backgroundImage: 'radial-gradient(#6C63FF22 2px, transparent 1px)',
      backgroundSize: '20px 20px',
      backgroundColor: '#FAFAFA',
    },
    darkStyle: {
      backgroundImage: 'radial-gradient(#6c63ff44 2px, transparent 1px)',
      backgroundSize: '20px 20px',
      backgroundColor: '#090d16',
    }
  },
  {
    id: 'grid', 
    label: 'Grid lines',
    style: {
      backgroundImage: 'linear-gradient(#6C63FF15 1px, transparent 1px), linear-gradient(90deg, #6C63FF15 1px, transparent 1px)',
      backgroundSize: '24px 24px',
      backgroundColor: '#FAFAFA',
    },
    darkStyle: {
      backgroundImage: 'linear-gradient(#6c63ff22 1px, transparent 1px), linear-gradient(90deg, #6c63ff22 1px, transparent 1px)',
      backgroundSize: '24px 24px',
      backgroundColor: '#090d16',
    }
  },
];
