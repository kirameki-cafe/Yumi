import { CustomError } from 'ts-custom-error'
 

export class ServiceError extends CustomError {
    public constructor(
        public statusCode: number,
        message: string
    ) {
        super(message)
    }
}

export class DatabaseError extends CustomError {
    public constructor(
        message: string
    ) {
        super(message)
    }
}