import express, { Application } from 'express';
import Logger from '../libs/Logger';
import apiv1Router from '../routes/API/v1';

class Routes {
    public mountWeb(_express: express.Application): Application {
        Logger.log('info', 'Mounting Web routes');
        return _express;
    }

    public mountAPI(_express: express.Application): Application {
        Logger.log('info', 'Mounting API routes');

        _express.use('/api/v1/', apiv1Router);

        return _express;
    }
}

export default new Routes();
