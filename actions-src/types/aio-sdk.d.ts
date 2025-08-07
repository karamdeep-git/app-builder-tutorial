
  declare module "@adobe/aio-sdk" {
    export namespace Core {
      interface LoggerOptions {
        level?: string;
        [key: string]: any;
      }
  
      interface LoggerInstance {
        error(message: any): void;
        debug(message: any): void;
        info(message: any, ...args: any[]): void;
      }
  
      const Logger: {
        (name: string, options?: LoggerOptions): LoggerInstance;
        new (name: string, options?: LoggerOptions): LoggerInstance;
      };
    }
  
    export namespace Events {
      /**
       * Initialize the Events client
       * @param orgId - The Adobe organization ID
       * @param clientId - The Adobe client ID
       * @param accessToken - The Adobe access token
       * @returns A promise that resolves to an Events client instance
       */
      function init(
        orgId: string,
        clientId: string,
        accessToken: string
      ): Promise<EventsClient>;
  
      interface EventsClient {
        /**
         * Publish an event to Adobe I/O Events
         * @param event - The CloudEvent to publish
         * @returns A promise that resolves when the event is successfully published
         */
        publishEvent(event: CloudEvent): Promise<void>;
      }
    }
  }