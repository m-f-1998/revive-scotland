import { ChangeDetectionStrategy, Component, Injectable, OnInit, signal, WritableSignal, inject, viewChild } from "@angular/core"
import { FieldType } from "@ngx-formly/core"
import { NgbDateParserFormatter, NgbDateStruct, NgbInputDatepicker } from "@ng-bootstrap/ng-bootstrap"
import { addYears, subYears } from "date-fns"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { FormControl, FormsModule, ReactiveFormsModule } from "@angular/forms"
import { isWithinInterval } from "date-fns"
import { IconService } from "../../services/icons.service"
import { DatesService } from "../../services/dates.service"

/**
 * This Service handles how the date is rendered and parsed from keyboard i.e. in the bound input field.
 */
@Injectable ( {
  providedIn: "root"
} )
class CustomDateParserFormatter extends NgbDateParserFormatter {
  public readonly DELIMITER = "/"

  public parse ( value: string ): NgbDateStruct | null {
    if ( value && value.length === 10 ) {
      const date = value.split ( this.DELIMITER )
      return {
        day: parseInt ( date [ 0 ], 10 ),
        month: parseInt ( date [ 1 ], 10 ),
        year: parseInt ( date [ 2 ], 10 )
      }
    }
    return null
  }

  public format ( date: NgbDateStruct | null ): string {
    return date ? ( "0" + date.day ).slice ( -2 ) + this.DELIMITER + ( "0" + date.month ).slice ( -2 ) + this.DELIMITER + date.year : ""
  }
}

@Component ( {
  selector: "app-formly-date-picker",
  imports: [
    NgbInputDatepicker,
    FormsModule,
    ReactiveFormsModule,
    FaIconComponent
  ],
  templateUrl: "./date-picker.component.html",
  providers: [
    { provide: NgbDateParserFormatter, useClass: CustomDateParserFormatter },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class DatePickerComponent extends FieldType implements OnInit {
  public readonly iconSvc: IconService = inject ( IconService )
  public readonly datesSvc: DatesService = inject ( DatesService )

  public control: FormControl | undefined
  public dateModel: WritableSignal<NgbDateStruct | undefined> = signal ( undefined )
  public datePicker = viewChild ( NgbInputDatepicker )

  public ngOnInit ( ) {
    this.control = this.formControl as FormControl
    if ( this.control && this.control.value ) {
      if ( typeof this.control.value === "string" ) {
        const date = new Date ( this.control.value )
        if ( !isNaN ( date.getTime ( ) ) ) {
          this.dateModel.set ( this.datesSvc.convertToNgbDate ( date ) )
        }
      } else if ( this.control.value instanceof Date ) {
        this.dateModel.set ( this.datesSvc.convertToNgbDate ( this.control.value ) )
      }
    }

    if ( this.field.props?. [ "startDate" ] && !this.dateModel ( ) ) {
      const startDate = this.datesSvc.convertToNgbDate ( this.field.props?. [ "startDate" ] )
      if ( isWithinInterval ( this.field.props?. [ "startDate" ], {
        start: this.field.props?. [ "minDate" ] || subYears ( new Date ( ), 100 ),
        end: this.field.props?. [ "maxDate" ] || addYears ( new Date ( ), 100 )
      } ) ) {
        this.dateModel.set ( startDate )
        this.formControl.setValue ( this.datesSvc.convertToDate ( startDate ) )
      }
    }

    if ( this.formControl ) {
      this.formControl.valueChanges.subscribe ( ( value: any ) => {
        if ( !value ) {
          this.dateModel.set ( undefined )
          return
        }

        if ( !this.dateModel ( ) ) {
          return
        }

        if ( this.compareNgbDate ( this.dateModel ( )!, this.datesSvc.convertToNgbDate ( value ) ) ) {
          return
        }

        if ( value instanceof Date ) {
          this.datePicker ( )?.navigateTo ( this.datesSvc.convertToNgbDate ( value ) )
          this.dateModel.set ( this.datesSvc.convertToNgbDate ( value ) )
        }
      } )
    }
  }

  public openPopup ( ) {
    if ( this.field.props?.readonly ) {
      return
    }
    this.datePicker ( )?.open ( )
    if ( this.datePicker ( )?.isOpen ( ) && this.dateModel ( ) ) {
      this.datePicker ( )?.navigateTo ( this.dateModel ( )! )
    }
  }

  public compareNgbDate ( date1: NgbDateStruct, date2: NgbDateStruct ): boolean {
    if ( !date1 || !date2 ) {
      return false
    }
    return date1.year === date2.year && date1.month === date2.month && date1.day === date2.day
  }

  public onDateInput ( event: Event ) {
    const input = ( event.target as HTMLInputElement ).value
    if ( input.length === 3 && !input.includes ( "/" ) ) {
      const formattedInput = input.slice ( 0, 2 ) +  "/" + input.slice ( 2 );
      ( event.target as HTMLInputElement ).value = formattedInput
    }

    if ( input.length === 6 && input.indexOf ( "/" ) === 2 && !input.endsWith ( "/" ) ) {
      const formattedInput = input.slice ( 0, 5 ) + "/" + input.slice ( 5 );
      ( event.target as HTMLInputElement ).value = formattedInput
    }
  }

  public onDateChange ( event: NgbDateStruct | string | null ) {
    this.field.formControl?.markAsDirty ( )

    if ( event && typeof event === "object" ) {
      this.formControl.setValue (
        new Date ( event.year, event.month - 1, event.day )
      )
    }

    if ( typeof event === "string" ) {
      this.field.formControl?.setErrors ( { ngbDate: true } )
    }

    if ( !event ) {
      this.formControl.setValue ( null )
    }
  }

  public minDate ( ) {
    return this.datesSvc.convertToNgbDate (
      this.field.props?. [ "minDate" ] || subYears ( new Date ( ), 100 )
    )
  }

  public maxDate ( ) {
    return this.datesSvc.convertToNgbDate (
      this.field.props?. [ "maxDate" ] || addYears ( new Date ( ), 100 )
    )
  }
}