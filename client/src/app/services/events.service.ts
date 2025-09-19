import { inject, Injectable } from "@angular/core"
import { ApiService } from "./api.service"
import { Event } from "../interfaces/events.interface"

@Injectable ( {
  providedIn: "root"
} )
export class EventsService {
  private events: Event [ ] | undefined
  private readonly apiSvc: ApiService = inject ( ApiService )

  public async getEvents ( ): Promise<Event[] | undefined> {
    if ( !this.events ) {
      await this.initialize ( )
    }
    return this.events
  }

  public async getNextEvent ( ): Promise<Event | undefined> {
    if ( !this.events ) {
      await this.initialize ( )
    }
    return this.events! [ 0 ]
  }

  private async initialize ( ) {
    try {
      const events = await this.apiSvc.get ( "/api/events" ) as Event [ ]
      this.events = events.sort ( ( a, b ) =>
        new Date ( a.start ?? 0 ).getTime ( ) - new Date ( b.start ?? 0 ).getTime ( )
      )
    } catch ( error: any ) {
      console.error ( error )
      this.events = [ ]
    }
  }
}