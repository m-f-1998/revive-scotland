import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core"
import { DialogRef } from "@angular/cdk/dialog"
import { DatesService } from "@services/dates.service"
import { ReviveEvent } from "@services/events.service"
import { IconComponent } from "../../../icon/icon.component"
import { downloadEventIcs, downloadEventPoster, getGoogleMapsUrl } from "../event-download.utils"

@Component ( {
  selector: "app-event-details-modal",
  imports: [ IconComponent ],
  templateUrl: "./event-details-modal.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class EventDetailsModalComponent {
  public event = input.required<ReviveEvent> ( )

  public readonly dateSvc = inject ( DatesService )
  private readonly dialogRef = inject ( DialogRef )

  public close ( ): void {
    this.dialogRef.close ( )
  }

  public mapsUrl ( location: string ): string {
    return getGoogleMapsUrl ( location )
  }

  public addToCalendar ( ): void {
    downloadEventIcs ( this.event ( ) )
  }

  public async savePoster ( ): Promise<void> {
    await downloadEventPoster ( this.event ( ) )
  }

  public hasLongDescription ( ): boolean {
    return !!this.event ( ).longDescription?.trim ( )
  }
}
