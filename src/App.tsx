import { IDE } from './IDE';
import { ToastProvider } from './toasts/ToastContext';
import './App.css';
import { IDEProvider } from './IDE/IDEStore';

export default function App() {
  return (
    <ToastProvider>
      <IDEProvider>
        <IDE />
      </IDEProvider>
    </ToastProvider>
  );
}
