import { Service } from "@angular/core"

@Service ( )
export class QrDownloadService {
  public downloadFromCanvas ( canvas: HTMLCanvasElement, filename: string ): void {
    const url = canvas.toDataURL ( "image/png" )
    const link = document.createElement ( "a" )
    link.href = url
    link.download = filename
    link.click ( )
  }

  public generateDataUrl ( canvas: HTMLCanvasElement ): string {
    return canvas.toDataURL ( "image/png" )
  }

  public downloadPng ( canvas: HTMLCanvasElement, filename: string ): void {
    this.downloadFromCanvas ( canvas, filename )
  }
}
