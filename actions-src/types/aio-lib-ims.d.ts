declare module '@adobe/aio-lib-ims' {
  export const context: {
    setCurrent: (configName: string) => Promise<void>;
    set: (configName: string, config: Record<string, any>) => Promise<void>;
  };
  export const getToken: () => Promise<string>;
}