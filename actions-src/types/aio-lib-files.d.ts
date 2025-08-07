declare module '@adobe/aio-lib-files' {
  export interface FileProperties {
    name: string;
    creationTime: Date;
    lastModified: Date;
    etag: string;
    contentLength: number;
    contentType: string;
    isDirectory: boolean;
    isPublic: boolean;
    url: string;
    internalUrl?: string;
  }

  export interface InitOptions {
    ow?: {
      namespace: string;
      auth: string;
    };
    azure?: {
      storageAccount: string;
      storageAccessKey: string;
      containerName: string;
    };
  }

  export interface PresignURLOptions {
    expiryInSeconds: number;
    permissions?: string;
    urltype?: UrlType;
  }

  export interface CopyOptions {
    localSrc?: boolean;
    localDest?: boolean;
  }

  export enum UrlType {
    external = 'external',
    internal = 'internal'
  }

  export interface FilesClient {
    write(path: string, content: string | Buffer | NodeJS.ReadableStream): Promise<void>;
    read(path: string): Promise<Buffer>;
    createReadStream(path: string): Promise<NodeJS.ReadableStream>;
    list(path: string): Promise<FileProperties[]>;
    getProperties(path: string): Promise<FileProperties>;
    delete(path: string): Promise<void>;
    copy(
      src: string,
      dest: string,
      options?: CopyOptions
    ): Promise<void>;
    generatePresignURL(
      path: string,
      options: PresignURLOptions
    ): Promise<string>;
  }

  export function init(options?: InitOptions): Promise<FilesClient>;
  
  export default {
    init,
    UrlType
  };
} 