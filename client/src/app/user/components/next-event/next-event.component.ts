import { CommonModule } from "@angular/common"
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, NgZone, OnInit, signal, WritableSignal } from "@angular/core"
import { HttpService } from "@services/HttpService.service"
import { intervalToDuration } from "date-fns"

@Component ( {
  selector: "app-next-event",
  imports: [
    CommonModule
  ],
  templateUrl: "./next-event.component.html",
  styleUrl: "./next-event.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class NextEventComponent implements OnInit {
  public nextEvent = new Date ( 1900, 1, 1 )
  public today = new Date ( )

  public months: WritableSignal<string> = signal ( "0" )
  public days: WritableSignal<string> = signal ( "0" )
  public hours: WritableSignal<string> = signal ( "0" )
  public minutes: WritableSignal<string> = signal ( "0" )
  public seconds: WritableSignal<string> = signal ( "0" )
  public locationName: WritableSignal<string> = signal ( "" )

  public constructor (
    private _ngZone: NgZone,
    private changeDetector: ChangeDetectorRef,
    private httpSvc: HttpService
  ) {
    this.httpSvc.request ( "/events.php", { } ).then ( ( res: any ) => {
      const events = res.sort ( ( a: any, b: any ) => b.date_from - a.date_from )
      if ( events.length > 0 && new Date ( events [ 0 ].date_from ) > this.today ) {
        this.nextEvent = new Date ( events [ 0 ].date_from )
      } else {
        this.nextEvent = new Date ( 1900, 1, 1 )
      }
    } )
  }

  public ngOnInit ( ) {
    this._ngZone.runOutsideAngular ( ( ) => {
      setInterval ( ( ) => {
        this.updateComponent ( )
        this.changeDetector.detectChanges ( )
      }, 1000 )
    } )
  }

  public updateComponent ( ) {
    const diff = intervalToDuration ( {
      start: new Date ( ),
      end: this.nextEvent
    } )
    this.months.set ( diff.months?.toString ( ).padStart ( 2, "0" ) ?? "0" )
    this.days.set ( diff.days?.toString ( ).padStart ( 2, "0" ) ?? "0" )
    this.hours.set ( diff.hours?.toString ( ).padStart ( 2, "0" ) ?? "0" )
    this.minutes.set ( diff.minutes?.toString ( ).padStart ( 2, "0" ) ?? "0" )
    this.seconds.set ( diff.seconds?.toString ( ).padStart ( 2, "0" ) ?? "0" )
  }
}
