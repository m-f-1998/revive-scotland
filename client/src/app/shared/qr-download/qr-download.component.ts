import { ChangeDetectionStrategy, Component, ElementRef, input, viewChild } from "@angular/core"
import { QrCodeComponent } from "ng-qrcode"
import { IconComponent } from "../../icon/icon.component"

@Component ( {
  selector: "app-qr-download",
  imports: [ QrCodeComponent, IconComponent ],
  templateUrl: "./qr-download.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class QrDownloadComponent {
  public value = input.required<string> ( )
  public filename = input ( "revive-scotland-qr.png" )

  private readonly qrHost = viewChild<ElementRef<HTMLDivElement>> ( "qrHost" )

  public download ( ): void {
    const host = this.qrHost ( )?.nativeElement
    const canvas = host?.querySelector ( "canvas" ) as HTMLCanvasElement | null
    if ( !canvas ) return

    const url = canvas.toDataURL ( "image/png" )
    const link = document.createElement ( "a" )
    link.href = url
    link.download = this.filename ( )
    link.click ( )
  }
}
