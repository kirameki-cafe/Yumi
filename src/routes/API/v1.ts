import * as express from 'express';
import Environment from '../../providers/Environment'

import HealthCheck from '../../controllers/API/v1/HealthCheck';

const router = express.Router();

let isDevEnv = (req: any, res: any, next: any) => {
    if(Environment.get().NODE_ENV == 'development') {
        return next();
    }
    else {
        return res.sendStatus(403);
    }
};


router.get('/health', HealthCheck.perform);

export default router;