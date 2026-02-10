import { useContext } from 'react';
import { IDEContext } from './IDEContext';

export function useIDE() {
  const context = useContext(IDEContext);
  if (!context) {
    throw new Error('useIDE must be used within IDEProvider');
  }
  return context;
}
