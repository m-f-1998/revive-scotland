import { Injectable } from "@angular/core"
import { format, parse } from "date-fns"

@Injectable ( {
  providedIn: "root"
} )
export class DatesService {
  public reformat ( date: Date | string, outputFormat: string ) {
    try {
      if ( !date ) return ""
      return format ( date, outputFormat )
    } catch {
      return format ( new Date ( ), "yyyy/MM/dd" )
    }
  }

  public reformatTime ( time: string ) {
    if ( !time ) return ""
    return this.reformat ( parse ( time, "HH:mm:ss", new Date ( ) ), "HH:mm" )
  }

  public sameDay ( date1: Date, date2: Date ) {
    return new Date ( date1 ).getDate ( ) === new Date ( date2 ).getDate ( )
  }
}