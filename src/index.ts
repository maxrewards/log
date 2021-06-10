import { createLogger, format, transports, Logger as WinstonLogger, LoggerOptions, LeveledLogMethod } from 'winston';
import { ConsoleTransportInstance, ConsoleTransportOptions, HttpTransportInstance, HttpTransportOptions } from 'winston/lib/winston/transports';
import { v4 } from 'uuid';

interface WLogger extends WinstonLogger {
  id?: string;
  serviceName?: string;
}

interface TransportOptions {
  http: Partial<HttpTransportOptions>;
  console: Partial<ConsoleTransportOptions>;
}

export default class Logger {
  public DEBUG_MODE: boolean = Boolean(process.env.DEBUG_LOG);
  public applicationName: string;
  public apiKey: string;
  public logger: WinstonLogger;

  childLoggers: WLogger[];
  transports: (HttpTransportInstance | ConsoleTransportInstance)[];

  constructor(applicationName: string, apiKey: string, options?: LoggerOptions, overrideTransport?: boolean, transportOptions?: TransportOptions) {
    this.applicationName = applicationName;
    this.apiKey = apiKey;

    let httpTransportOptions: HttpTransportOptions = {
      handleExceptions: !overrideTransport,
      handleRejections: !overrideTransport,
      host: 'http-intake.logs.datadoghq.com',
      path: `/v1/input/${apiKey}?ddsource=nodejs&service=${applicationName}`,
    };

    let consoleTransportOptions: ConsoleTransportOptions = {
      format: format.combine(format.printf(({ message, level, stack }) => {
        if(level === 'error') {
          return stack;
        } else {
          return message;
        }
      }))
    };

    if(transportOptions) {
      if(transportOptions.http && typeof transportOptions.http === 'object') {
        httpTransportOptions = { ...httpTransportOptions, ...transportOptions.http };
      }
      if(transportOptions.console && typeof transportOptions.console === 'object') {
        consoleTransportOptions = { ...consoleTransportOptions, ...transportOptions.console };
      }
    }

    const httpTransport = new transports.Http(httpTransportOptions);

    const consoleTransport = new transports.Console(consoleTransportOptions);

    const winstonTransports = ((process.env.NODE_ENV && process.env.NODE_ENV.indexOf('prod') > -1) || overrideTransport) ? [httpTransport, consoleTransport] : [consoleTransport];

    this.transports = winstonTransports;

    this.logger = createLogger({
      level: 'info',
      exitOnError: false,
      format: format.combine(
        format.errors({ stack: true }),
        format.json()
      ),
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
