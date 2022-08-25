import HTTP_STATUS from "../libs/HTTPStatus";
import Logger from "../libs/Logger";
import { ServiceError } from "./Errors";

class ExpressExceptionHandler {
    public static errorLogger(error: any, req: any, res: any, next: any) {
        if(error instanceof ServiceError) {
            res.status(error.statusCode).json({
                error: error.message
            })
        }
        else {
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: "Internal server error"
            })
            throw error;
        }
    }
}

export default ExpressExceptionHandler;