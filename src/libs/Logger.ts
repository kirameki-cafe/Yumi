import winston, { verbose } from 'winston';

const levels = {
    critical: 0,
    error: 1,
    alert: 2,
    warn: 3,
    info: 4,
    http: 5,
    debug: 6,
    verbose: 7
};

const level = () => {
    const env = process.env.NODE_ENV || 'development';
    const isDevelopment = env === 'development';
    const isVerbose = process.env.VERBOSE ? process.env.VERBOSE.toLowerCase() === 'true' && isDevelopment : false;
    if (isVerbose) return 'verbose';

    return isDevelopment ? 'debug' : 'info';
};

const colors = {
    critical: 'red',
    error: 'red',
    alert: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
    verbose: 'gray'
};

winston.addColors(colors);

const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.colorize({ all: true }),
    winston.format.printf((info) => `[${info.timestamp}] [${info.level}] ${info.message}`)
);

const format = winston.format.combine(
    winston.format.timestamp({
        format: new Date().toISOString()
    }),
    winston.format.json()
);

const transports = [
    new winston.transports.Console({
        format: consoleFormat
    }),
    new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error'
    }),
    new winston.transports.File({ filename: 'logs/all.log' })
];

const Logger = winston.createLogger({
    level: level(),
    levels,
    format,
    transports
});

const wrapper = (original: winston.LeveledLogMethod) => {
    return (...args: any) => original(args.join(' '));
};

Logger.error = wrapper(Logger.error);
Logger.warn = wrapper(Logger.warn);
Logger.info = wrapper(Logger.info);
Logger.verbose = wrapper(Logger.verbose);
Logger.debug = wrapper(Logger.debug);
Logger.silly = wrapper(Logger.silly);

export default Logger;
