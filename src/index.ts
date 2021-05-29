import { createLogger, format, transports, Logger as WinstonLogger, LoggerOptions } from 'winston';
import { ConsoleTransportInstance, HttpTransportInstance } from 'winston/lib/winston/transports';
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
  transports: (HttpTransportInstance | ConsoleTransportInstance)[];

  constructor(applicationName: string, apiKey: string, options?: LoggerOptions, overrideTransport?: boolean) {
    this.applicationName = applicationName;
    this.apiKey = apiKey;

    const httpTransport = new transports.Http({
      handleExceptions: overrideTransport ? false : true,
      handleRejections: overrideTransport ? false : true,
      host: 'http-intake.logs.datadoghq.com',
      path: `/v1/input/${apiKey}?ddsource=nodejs&service=${applicationName}`
    });

    const consoleTransport = new transports.Console({ format: format.printf(({ message }) => message) });

    const winstonTransports = (process.env.NODE_ENV && process.env.NODE_ENV.indexOf('prod') > -1) ? [httpTransport, consoleTransport] : [consoleTransport];

    this.transports = winstonTransports;

    this.logger = createLogger({
      level: 'info',
      exitOnError: false,
      format: format.json(),
      transports: winstonTransports,
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
      const keep = [];
      for(let i = 0; i < this.childLoggers.length; i++) {
        const logger = this.childLoggers[i];
        if(logger.id === ingestId) {
          logger.on('finish', () => {
            logger.end();
          });
        } else {
          keep.push(logger);
        }
      }
  
      this.childLoggers = keep;
    } catch(e) {
      this.logger.error(e);
      return false;
    }
    return true;
  }
}