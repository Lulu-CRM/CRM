import { Theme } from './settings/types';
import { LuluCRM } from './components/generated/LuluCRM';

let theme: Theme = 'light';

function App() {
  function setTheme(theme: Theme) {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  setTheme(theme);

  return (
    <>
      <LuluCRM />
    </>
  ); // %EXPORT_STATEMENT%
}

export default App;
