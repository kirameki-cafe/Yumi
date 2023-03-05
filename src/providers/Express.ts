import express from 'express';
import cors from 'cors';

import Logger from '../libs/Logger';
import Environment from './Environment';

import ExpressException from '../exception/ExpressException';
import Routes from './Routes';

class Express {
    public server: any;
    public express: express.Application;

    constructor() {
        this.server = null;
        this.express = express();
    }

    public init(): void {
        this.mountMiddlewares();
        this.mountRoutes();
        this.express = this.express.use(ExpressException.errorLogger);

        this.server = this.express.listen(Environment.get().WEB_PORT, Environment.get().WEB_HOST, () => {
            Logger.log(
                'info',
                `Express Webserver listening at ${Environment.get().WEB_HOST}:${Environment.get().WEB_PORT}`
            );
        });
    }

    public end(): void {
        if (this.server) this.server.close();
    }

    private mountRoutes(): void {
        this.express = Routes.mountAPI(this.express);
        this.express = Routes.mountWeb(this.express);
    }

    private mountMiddlewares(): void {
        //this.express = RateLimit.init(this.express);
        this.express = this.express.use(cors());

        //This always have to be at the bottom!
        this.express = this.express.use(express.json());
    }
}

export default new Express();
