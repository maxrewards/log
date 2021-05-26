import { createLogger, format, transports, Logger as WinstonLogger, LoggerOptions } from 'winston';
import { v4 } from 'uuid';

interface WLogger extends WinstonLogger {
  id?: string;
  serviceName?: string;
}

export default class Logger {
  applicationName: string;
  apiKey: string;
  logger: WinstonLogger;
  childLoggers: WLogger[];

  constructor(applicationName: string, apiKey: string, options?: LoggerOptions, overrideTransport?: boolean) {
    this.applicationName = applicationName;
    this.apiKey = apiKey;

    const httpTransport = new transports.Http({
      handleExceptions: overrideTransport ? false : true,
      handleRejections: overrideTransport ? false : true,
      host: 'http-intake.logs.datadoghq.com',
      path: `/v1/input/${apiKey}?ddsource=nodejs&service=${applicationName}`
    });

    const consoleTransport = new transports.Console({ format: format.simple() });

    const transport = (process.env.NODE_ENV === 'production')
      ? [httpTransport]
      : overrideTransport
        ? [httpTransport, consoleTransport]
        : [consoleTransport];

    this.logger = createLogger({
      level: 'info',
      exitOnError: false,
      format: format.json(),
      transports: transport,
      ...options
    });

    this.childLoggers = [];
  }

  public create = (userId?: string, otherOpts?: { [key: string]: string | number | boolean }, ingestId?: string): WLogger => {
    let options: { reqId: string, [key: string]: any } = { reqId: ingestId ? ingestId : v4() };

    if(userId) {
      options.userId = userId;
    }

    if(otherOpts && typeof otherOpts === 'object') {
      options = { ...options, ...otherOpts };
    }

    const childLogger: WLogger = this.logger.child(options);
    childLogger.id = options.reqId;
    childLogger.serviceName = this.applicationName;

    this.childLoggers.push(childLogger);

    return childLogger;
  }

  public destroy = (ingestId?: string): boolean => {
    try {
      const logger = this.childLoggers.find(logger => logger.id === ingestId);
      if(logger) {
        logger.on('finish', () => {
          logger.end();
        });
      }
      this.childLoggers = this.childLoggers.filter(logger => logger.id !== ingestId);
    } catch(e) {
      return false;
    }
    return true;
  }
}