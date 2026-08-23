import { Service } from "@angular/core"
import { format, parse, isSameMonth, isSameDay } from "date-fns"

export interface NgbDateStruct {
  year: number
  month: number
  day: number
}

@Service ( )
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
    return isSameDay ( new Date ( date1 ), new Date ( date2 ) )
  }

  public convertToNgbDate ( date: Date ): NgbDateStruct {
    return {
      year: date.getFullYear ( ),
      month: date.getMonth ( ) + 1,
      day: date.getDate ( )
    }
  }

  public formatEventDate ( startDate?: Date, endDate?: Date, startTime?: string, endTime?: string ): string {
    if ( !startDate ) return "Date to be announced"

    const sDate = new Date ( startDate )
    const eDate = endDate ? new Date ( endDate ) : sDate

    let dateStr = ""
    if ( this.sameDay ( sDate, eDate ) ) {
      dateStr = format ( sDate, "EEEE do MMMM" )
    } else if ( isSameMonth ( sDate, eDate ) ) {
      dateStr = `${format ( sDate, "EEEE do" )} - ${format ( eDate, "EEEE do MMMM" )}`
    } else {
      dateStr = `${format ( sDate, "EEEE do MMMM" )} - ${format ( eDate, "EEEE do MMMM" )}`
    }

    if ( startTime ) {
      if ( endTime && endTime !== startTime && this.sameDay ( sDate, eDate ) ) {
        return `${dateStr} @ ${startTime} - ${endTime}`
      }
      return `${dateStr} @ ${startTime}`
    }

    return dateStr
  }

  public convertToDate ( date: NgbDateStruct ): Date {
    return new Date ( date.year, date.month - 1, date.day )
  }
}
