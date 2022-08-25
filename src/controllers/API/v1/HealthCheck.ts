import HTTP_STATUS from "../../../libs/HTTPStatus";
import Environment from "../../../providers/Environment";
import App from "../../../providers/App";

class HealthCheck {
    public static async perform(req: any, res: any, next: any) {
        Promise.resolve().then(async () => { 
            return res.status(HTTP_STATUS.OK).json({
                status: "OK",
                environment: Environment.get().NODE_ENV,
                version: App.versionNumber,
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                cpuUsage: process.cpuUsage(),
                pid: process.pid,
                ppid: process.ppid
            });
        }).catch(next);
    }
}

export default HealthCheck;