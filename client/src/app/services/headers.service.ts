import { inject, Injectable } from "@angular/core"
import { ApiService } from "./api.service"
import { Header } from "../interfaces/headers.interface"

@Injectable ( {
  providedIn: "root"
} )
export class HeadersService {
  private readonly apiSvc: ApiService = inject ( ApiService )

  public async getHeaders ( location: string ): Promise<Header[] | undefined> {
    return await this.initialize ( location )
  }

  private async initialize ( location: string ) {
    try {
      return await this.apiSvc.get ( "/api/headers", {
        location
      } ) as Header [ ]
    } catch ( error: any ) {
      console.error ( error )
      return [ ]
    }
  }
}