import { inject, Service } from "@angular/core"
import { ApiService } from "./api.service"
import { FormlyFieldConfig } from "@ngx-formly/core"

export interface ReviveEvent {
  id: string
  title: string
  description: string
  location: string
  imageUrl?: string
  startDate: Date
  startTime?: string
  endTime?: string
  endDate: Date

  actionType: "webpage" | "contact"
  webpageUrl?: string

  contactFormFields?: FormlyFieldConfig [ ]

  donationRequired?: "none" | "optional" | "required"
}

@Service ( )
export class EventsService {
  private events: Array<ReviveEvent> | undefined

  private readonly apiSvc: ApiService = inject ( ApiService )

  public async getEvents ( ): Promise<ReviveEvent [ ]> {
    if ( !this.events ) {
      await this.initialize ( )
    }
    return this.events!
  }

  public async getNextEvent ( ): Promise<ReviveEvent | undefined> {
    if ( !this.events ) {
      await this.initialize ( )
    }
    return this.events! [ 0 ]
  }

  private async initialize ( ) {
    try {
      const response = await this.apiSvc.get ( "/api/admin/events" ) as { events: ReviveEvent [ ] }
      const currentTime = new Date ( )
      this.events = ( response.events || [ ] )
        .filter ( event => {
          const eventEndDate = new Date ( event.endDate )
          if ( !isNaN ( eventEndDate.getTime ( ) ) ) {
            return eventEndDate >= currentTime
          }
          return true
        } )
        .sort ( ( a, b ) => {
          return new Date ( a.startDate ).getTime ( ) - new Date ( b.startDate ).getTime ( )
        } )
    } catch {
      this.events = [ ]
    }
  }
}