import { inject, Injectable } from "@angular/core"
import { ApiService } from "./api.service"

export interface ReviveEvent {
  id: string
  title: string
  description: string
  location: string
  imageUrl?: string
  startDate: Date
  endDate: Date

  actionType: "webpage" | "contact"
  webpageUrl?: string

  contactFormFields?: any [ ]
}

@Injectable ( {
  providedIn: "root"
} )
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
      this.events = ( response.events || [ ] ).sort ( ( a, b ) => {
        return new Date ( a.startDate ).getTime ( ) - new Date ( b.startDate ).getTime ( )
      } )
    } catch {
      this.events = [ ]
    }
  }
}