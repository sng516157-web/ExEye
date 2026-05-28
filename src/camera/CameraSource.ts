export interface CameraSource {
  name: string;
  captureFrame(): Promise<Blob>;
}
