import { Injectable } from "@angular/core"

@Injectable ( {
  providedIn: "root"
} )
export class EventsService {
  private eventbrite: Array<any> | undefined

  public async getEvents ( ): Promise<any> {
    if ( !this.eventbrite ) {
      await this.initialize ( )
    }
    return this.eventbrite
  }

  public async getNextEvent ( ): Promise<any> {
    if ( !this.eventbrite ) {
      await this.initialize ( )
    }
    return this.eventbrite! [ 0 ]
  }

  private initialize ( ) {
    // Update with new API when available
    this.eventbrite = [ ]
  }
}