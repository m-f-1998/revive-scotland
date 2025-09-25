import { ChangeDetectionStrategy, Component, inject, OnInit } from "@angular/core"
import { FieldType, FormlyFieldConfig, FormlyForm } from "@ngx-formly/core"
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms"
import { FormlyService } from "../../services/formly.service"
import { ApiService } from "../../services/api.service"
import { LocationLookup } from "./location.interface"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { debounceTime, distinctUntilChanged } from "rxjs/operators"

@Component ( {
  selector: "app-location-picker",
  imports: [
    FormsModule,
    ReactiveFormsModule,
    FormlyForm
  ],
  templateUrl: "./location-picker.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class LocationPickerComponent extends FieldType implements OnInit {
  public control: FormControl | undefined

  public locationForm: FormGroup = new FormGroup ( { } )
  public locationModel: any = { }
  public locationFields: FormlyFieldConfig [ ] = [ ]

  private readonly formlySvc: FormlyService = inject ( FormlyService )
  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  public ngOnInit ( ) {
    this.control = this.formControl as FormControl
    this.locationFields = [
      this.formlySvc.TextInput ( "address_lookup", {
        label: "Address Lookup",
        placeholder: "Start typing your address...",
        minLength: 3,
        required: true,
      }, {
        hooks: {
          afterViewInit: ( field: FormlyFieldConfig ) => {
            if ( field.formControl ) {
              field.formControl.valueChanges
                .pipe (
                  debounceTime ( 700 ),
                  distinctUntilChanged ( )
                )
                .subscribe ( value => {
                  this.LookupAddress ( value )
                } )
            }
          }
        }
      } ),
      this.formlySvc.Select ( "address", {
        label: "Address",
        placeholder: "Select your address",
        options: [ ],
        required: true,
        change: ( _field: FormlyFieldConfig ) => {
          this.control?.setValue ( this.locationModel.address )
        }
      }, {
        expressions: {
          hide: ( field: FormlyFieldConfig ) => {
            return !field?.form?.get ( "address_lookup" )?.value || this.locationFields [ 0 ].formControl?.invalid
          }
        }
      } )
    ]
  }

  private async LookupAddress ( _value?: any ): Promise<void> {
    if ( this.locationFields [ 0 ].formControl?.invalid ) return

    const location = this.locationModel.address_lookup
    if ( !location || typeof location !== "string" ) return

    try {
      const data: LocationLookup [ ] = await this.apiSvc.get ( "/api/address/lookup", {
        location
      } ) as any
      console.log ( data )

      this.locationFields [ 1 ].props!.options = data.map ( ( x: LocationLookup ) => {
        return {
          label: x.text,
          value: x.id
        }
      } )
      this.locationFields [ 1 ].formControl?.updateValueAndValidity ( )
    } catch ( e ) {
      console.error ( e )
      this.toastrSvc.error ( "Could not search for addresses at this time." )
    }
  }
}
