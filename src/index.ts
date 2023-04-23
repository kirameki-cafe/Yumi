import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import App from './providers/App';
import NativeException from './exception/NativeException';

NativeException.process();

App.loadENV();
App.loadConfig();
App.loadPrisma();
App.loadLocale();
App.loadDiscord();
App.load_osu();
App.loadVRChat();
App.loadExpress();

export default App;
