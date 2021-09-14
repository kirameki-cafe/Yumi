import App from './providers/App';
import NativeException from './exception/NativeException';

NativeException.process();

App.loadENV();
App.loadPrisma();
App.loadDiscord();

export default App;