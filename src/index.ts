import App from './providers/App';
import NativeException from './exception/NativeException';

NativeException.process();

App.loadENV();
App.loadPrisma();
App.loadDiscord();
App.load_osu();

export default App;