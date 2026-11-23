declare module "qrcode" {
  export interface QRCodeToStringOptions {
    type?: "svg" | "utf8" | "terminal";
    width?: number;
    margin?: number;
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    color?: {
      dark?: string;
      light?: string;
    };
  }

  export interface QRCodeModules {
    size: number;
    data: Uint8Array;
    get(row: number, col: number): boolean | number;
  }

  export interface QRCodeObject {
    modules: QRCodeModules;
    version: number;
    errorCorrectionLevel: { bit: number };
  }

  export interface QRCodeCreateOptions {
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    version?: number;
    maskPattern?: number;
  }

  const QRCode: {
    toString(text: string, options?: QRCodeToStringOptions): Promise<string>;
    create(text: string, options?: QRCodeCreateOptions): QRCodeObject;
  };

  export default QRCode;
}
