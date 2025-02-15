import { Injectable } from "@angular/core"
import { ApiService } from "./api.service"

@Injectable ( {
  providedIn: "root"
} )
export class EventsService {
  private eventbrite: Array<any> | undefined

  public constructor (
    private apiSvc: ApiService
  ) { }

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
    return this.apiSvc.get ( "/events.php" ).then ( ( response: any ) => {
      this.eventbrite = response.filter ( ( x: any ) => {
        return x.status === "live"
      } ).sort ( ( a: any, b: any ) => {
        if ( a.start.local > b.start.local ) {
          return 1
        }
        if ( a.start.local < b.start.local ) {
          return -1
        }
        return 0
      } )
    } )
  }
}