import App from './providers/App';
import NativeException from './exception/NativeException';

NativeException.process();

App.loadConfig();
App.loadENV();
App.loadPrisma();
App.loadDiscord();
App.load_osu();

export default App;
