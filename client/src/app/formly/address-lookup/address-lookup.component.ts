import { Component, ChangeDetectionStrategy, signal, WritableSignal, inject } from "@angular/core"
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms"
import { FieldType, FormlyFieldConfig, FormlyModule } from "@ngx-formly/core"
import { NominatimResult } from "./address-lookup.interface"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { IconService } from "../../services/icons.service"
import { FormlyService } from "../../services/formly.service"

// Define the custom field component for address autocomplete
@Component ( {
  selector: "app-formly-address-autocomplete",
  imports: [
    ReactiveFormsModule,
    FormlyModule,
    FaIconComponent
  ],
  standalone: true,
  templateUrl: "./address-lookup.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class AddressAutocompleteComponent extends FieldType<FormlyFieldConfig> {
  public selectAddressForm: FormGroup = new FormGroup ( { } )
  public selectAddressFields: FormlyFieldConfig [ ] = [ ]
  public selectAddressModel: any = { }

  public inputControl = new FormControl ( this.model?.formattedAddress || "", { nonNullable: true } )

  public searchResults: WritableSignal<NominatimResult[]> = signal ( [] )
  public loading: WritableSignal<boolean> = signal ( false )
  public focusedIndex: WritableSignal<number> = signal ( -1 )

  public readonly iconSvc: IconService = inject ( IconService )
  private readonly formlySvc: FormlyService = inject ( FormlyService )

  private debounceTimer: any
  private readonly debounceTimeMs = 300

  public constructor ( ) {
    super ( )
    if ( this.model?.formattedAddress ) {
      this.inputControl.setValue ( this.model.formattedAddress )
    }
    this.selectAddressFields = [
      this.formlySvc.SelectInput ( "addressSelection", {
        label: "Autocomplete Results",
        options: [ ],
        required: true,
        change: ( field: FormlyFieldConfig ) => {
          const selectedResult: NominatimResult = field.formControl?.value
          if ( selectedResult ) {
            this.selectAddress ( selectedResult )
          }
        }
      }, { } )
    ]
  }

  public searchAddress ( ) {
    clearTimeout ( this.debounceTimer )
    const query = this.inputControl.value.trim ( )

    this.formControl.setValue ( null )

    if ( query.length < 3 ) {
      this.searchResults.set ( [ ] )
      this.selectAddressFields [ 0 ].props = {
        ...this.selectAddressFields [ 0 ].props,
        options: [ ]
      }
      return
    }

    this.loading.set ( true )

    this.debounceTimer = setTimeout ( async ( ) => {
      try {
        const response = await fetch ( `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent ( query )}`, {
          headers: {
            "Accept": "application/json"
          }
        } )

        if ( !response.ok ) {
          throw new Error ( "Nominatim API search failed" )
        }

        const results: NominatimResult [ ] = await response.json ( )
        this.searchResults.set ( results )
        this.selectAddressFields [ 0 ].props = {
          ...this.selectAddressFields [ 0 ].props,
          options: results.map ( r => ( {
            label: r.display_name,
            value: r
          } ) )
        }
      } catch ( error ) {
        console.error ( "Error fetching addresses from Nominatim:", error )
        this.searchResults.set ( [ ] )
        this.selectAddressFields [ 0 ].props = {
          ...this.selectAddressFields [ 0 ].props,
          options: [ ]
        }
      } finally {
        this.loading.set ( false )
      }
    }, this.debounceTimeMs )
  }

  public selectAddress ( result: NominatimResult ) {
    this.inputControl.setValue ( result.display_name )
    this.searchResults.set ( [ ] )

    const address = result.address

    const newModel = {
      formattedAddress: result.display_name,
      street: `${address.house_number ? address.house_number + " " : ""}${address.road || ""}`,
      city: address.city || address.town || address.village || "",
      state: address.state || "",
      zip: address.postcode || "",
      country: address.country || "",
      latitude: result.lat,
      longitude: result.lon,
    }

    this.formControl.setValue ( newModel )
  }
}