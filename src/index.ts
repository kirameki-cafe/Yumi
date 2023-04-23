import App from './providers/App';
import NativeException from './exception/NativeException';

NativeException.process();

App.loadConfig();
App.loadENV();
App.loadPrisma();
App.loadLocale();
App.loadDiscord();
App.load_osu();
App.loadVRChat();
App.loadExpress();

export default App;
