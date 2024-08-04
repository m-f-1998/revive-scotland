import { Injectable } from "@angular/core"
import { format, parse } from "date-fns"

@Injectable ( {
  providedIn: "root"
} )
export class DatesService {
  public reformat ( date: Date, outputFormat: string ) {
    try {
      if ( !date ) return ""
      return format ( date, outputFormat )
    } catch {
      const d = new Date ( )
      const datestring = d.getFullYear ( )  + "/" + ( d.getMonth ( ) + 1 ) + "/" + d.getDate ( )
      return datestring
    }
  }

  public reformatTime ( time: string ) {
    if ( !time ) return ""
    return this.reformat ( parse ( time, "HH:mm:ss", new Date ( ) ), "HH:mm" )
  }
}