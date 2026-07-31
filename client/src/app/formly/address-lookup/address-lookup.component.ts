import { Component, ChangeDetectionStrategy, OnInit } from "@angular/core"
import { FormControl, ReactiveFormsModule } from "@angular/forms"
import { FieldType, FormlyFieldConfig, FormlyValidationMessage } from "@ngx-formly/core"

@Component ( {
  selector: "app-formly-address-autocomplete",
  imports: [
    ReactiveFormsModule,
    FormlyValidationMessage
  ],
  standalone: true,
  templateUrl: "./address-lookup.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class AddressAutocompleteComponent extends FieldType<FormlyFieldConfig> implements OnInit {
  // Split manual entry form fields
  public line1Control: FormControl = new FormControl ( "" )
  public line2Control: FormControl = new FormControl ( "" )
  public cityControl: FormControl = new FormControl ( "" )
  public postcodeFieldControl: FormControl = new FormControl ( "" )

  public ngOnInit ( ): void {
    const initialValue = this.formControl?.value || ""
    if ( initialValue ) {
      this.parseAndSetAddress ( initialValue )
    }
  }

  public onAddressFieldChange ( ): void {
    const line1 = ( this.line1Control.value || "" ).trim ( )
    const line2 = ( this.line2Control.value || "" ).trim ( )
    const city = ( this.cityControl.value || "" ).trim ( )
    const postcode = ( this.postcodeFieldControl.value || "" ).trim ( )

    const parts = [ ]
    if ( line1 ) parts.push ( line1 )
    if ( line2 ) parts.push ( line2 )
    if ( city ) parts.push ( city )
    if ( postcode ) parts.push ( postcode )

    const combinedAddress = parts.join ( ", " )
    this.formControl.setValue ( combinedAddress )
    this.formControl.markAsDirty ( )
    this.formControl.markAsTouched ( )
  }

  private parseAndSetAddress ( addressStr: string ): void {
    const parts = addressStr.split ( "," ).map ( p => p.trim ( ) )
    if ( parts.length >= 4 ) {
      this.line1Control.setValue ( parts [ 0 ], { emitEvent: false } )
      this.line2Control.setValue ( parts [ 1 ], { emitEvent: false } )
      this.cityControl.setValue ( parts [ 2 ], { emitEvent: false } )
      this.postcodeFieldControl.setValue ( parts [ 3 ], { emitEvent: false } )
    } else if ( parts.length === 3 ) {
      this.line1Control.setValue ( parts [ 0 ], { emitEvent: false } )
      this.line2Control.setValue ( "", { emitEvent: false } )
      this.cityControl.setValue ( parts [ 1 ], { emitEvent: false } )
      this.postcodeFieldControl.setValue ( parts [ 2 ], { emitEvent: false } )
    } else {
      this.line1Control.setValue ( addressStr, { emitEvent: false } )
      this.line2Control.setValue ( "", { emitEvent: false } )
      this.cityControl.setValue ( "", { emitEvent: false } )
      this.postcodeFieldControl.setValue ( "", { emitEvent: false } )
    }
  }
}
