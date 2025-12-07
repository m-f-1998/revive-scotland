
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal, WritableSignal } from "@angular/core"
import { EventsService, ReviveEvent } from "@services/events.service"
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
  imports: [],
  templateUrl: "./next-event.component.html",
  styleUrl: "./next-event.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class NextEventComponent {
  public readonly nextEvent: WritableSignal<ReviveEvent | null> = signal ( null )
  public readonly timeRemaining: WritableSignal<TimeRemaining> = signal ( {
    months: "0",
    days: "0",
    hours: "0",
    minutes: "0",
    seconds: "0"
  } )

  private readonly eventSvc: EventsService = inject ( EventsService )
  private readonly changeDetector: ChangeDetectorRef = inject ( ChangeDetectorRef )

  public constructor (  ) {
    this.eventSvc.getNextEvent ( ).then ( ( nextEvent: ReviveEvent | undefined ) => {
      if ( nextEvent ) {
        this.nextEvent.set ( nextEvent )

        setInterval ( ( ) => {
          this.getTimeRemaining ( )
          this.changeDetector.detectChanges ( )
        }, 1000 )
      }
    } )
  }

  public get validNextEvent ( ) : boolean {
    return this.nextEvent ( ) !== null && this.nextEvent ( )!.startDate > new Date ( )
  }

  public getTimeRemaining ( ) {
    const diff = intervalToDuration ( {
      start: new Date ( ),
      end: new Date ( this.nextEvent ( )?.startDate ?? new Date ( ) )
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
