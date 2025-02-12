import { CommonModule } from "@angular/common"
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, NgZone, OnInit, signal, WritableSignal } from "@angular/core"
import { EventsService } from "@services/events.service"
import { intervalToDuration } from "date-fns"

interface TimeRemaining {
  months: string
  days: string
  hours: string
  minutes: string
  seconds: string
}

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

  public readonly timeRemaining: WritableSignal<TimeRemaining> = signal ( {
    months: "0",
    days: "0",
    hours: "0",
    minutes: "0",
    seconds: "0"
  } )
  public readonly locationName: WritableSignal<string> = signal ( "" )
  public readonly eventLink: WritableSignal<string> = signal ( "" )
  public readonly title: WritableSignal<string> = signal ( "Next Event" )

  public constructor (
    private _ngZone: NgZone,
    private changeDetector: ChangeDetectorRef,
    private eventSvc: EventsService
  ) { }

  public ngOnInit ( ) {
    this._ngZone.runOutsideAngular ( ( ) => {
      this.eventSvc.getNextEvent ( ).then ( ( nextEvent: any ) => {
        if ( nextEvent ) {
          this.nextEvent = new Date ( nextEvent.start.local )
          this.title.set ( nextEvent.name.text )

          if ( nextEvent.url ) {
            this.eventLink.set ( nextEvent.url )
          }

          if ( nextEvent.venue ) {
            this.locationName.set ( nextEvent.venue.address.localized_address_display )
          } else {
            this.locationName.set ( "Online Event" )
          }

          setInterval ( ( ) => {
            this.getTimeRemaining ( )
            this.changeDetector.detectChanges ( )
          }, 1000 )
        }
      } )
    } )
  }

  public getTimeRemaining ( ) {
    const diff = intervalToDuration ( {
      start: new Date ( ),
      end: this.nextEvent
    } )

    this.timeRemaining.set ( {
      months: diff.months?.toString ( ).padStart ( 2, "0" ) ?? "0",
      days: diff.days?.toString ( ).padStart ( 2, "0" ) ?? "0",
      hours: diff.hours?.toString ( ).padStart ( 2, "0" ) ?? "0",
      minutes: diff.minutes?.toString ( ).padStart ( 2, "0" ) ?? "0",
      seconds: diff.seconds?.toString ( ).padStart ( 2, "0" ) ?? "0"
    } )
  }
}
