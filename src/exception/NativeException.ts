import Logger from '../libs/Logger';

import App from '../providers/App';

class NativeException {


    public process (): void {

        process.on('uncaughtException', exception => {
            Logger.log('critical', 'Critical error, cleaning up and exiting');
            Logger.log('critical', exception.stack);

            Logger.log('info', 'Clean up completed, exiting...');
            process.exit(1);
        });

        process.on('unhandledRejection', exception => {
            throw exception;
        });

    }


}

export default new NativeException;