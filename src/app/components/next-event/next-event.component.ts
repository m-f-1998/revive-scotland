import { CommonModule } from "@angular/common"
import { ChangeDetectorRef, Component, NgZone, OnInit } from "@angular/core"
import { intervalToDuration } from "date-fns"

@Component ( {
  selector: "app-next-event",
  standalone: true,
  imports: [
    CommonModule
  ],
  templateUrl: "./next-event.component.html",
  styleUrl: "./next-event.component.scss"
} )
export class NextEventComponent implements OnInit {
  public nextEvent = new Date ( 2025, 1, 1 )

  public months = "0"
  public days = "0"
  public hours = "0"
  public minutes = "0"
  public seconds = "0"
  public locationName = ""

  constructor (
    private _ngZone: NgZone,
    private changeDetector: ChangeDetectorRef
  ) { }

  public updateComponent ( ) {
    const diff = intervalToDuration ( {
      start: new Date ( ),
      end: this.nextEvent
    } )
    this.months = diff.months?.toString ( ).padStart ( 2, "0" ) ?? "0"
    this.days = diff.days?.toString ( ).padStart ( 2, "0" ) ?? "0"
    this.hours = diff.hours?.toString ( ).padStart ( 2, "0" ) ?? "0"
    this.minutes = diff.minutes?.toString ( ).padStart ( 2, "0" ) ?? "0"
    this.seconds = diff.seconds?.toString ( ).padStart ( 2, "0" ) ?? "0"
  }

  ngOnInit ( ) {
    this._ngZone.runOutsideAngular ( ( ) => {
      setInterval ( ( ) => {
        this.updateComponent ( )
        this.changeDetector.detectChanges ( )
      }, 1000 )
    } )
  }
}
