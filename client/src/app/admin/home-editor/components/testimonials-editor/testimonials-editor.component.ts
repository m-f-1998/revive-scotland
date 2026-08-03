import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { HttpHeaders } from "@angular/common/http"
import { IconComponent } from "@app/icon/icon.component"
import { ApiService } from "@services/api.service"
import { AuthService } from "@services/auth.service"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { Testimony, DEFAULT_TESTIMONIALS } from "@app/admin/home-editor/config/home-editor.config"

@Component ( {
  selector: "app-home-testimonials-editor",
  imports: [
    IconComponent,
  ],
  templateUrl: "./testimonials-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class TestimonialsEditorComponent implements OnInit {
  public testimonials: WritableSignal<Testimony [ ]> = signal ( [ ] )
  public activeIndex: WritableSignal<number | null> = signal ( null )

  public saving: WritableSignal<boolean> = signal ( false )
  public loading: WritableSignal<boolean> = signal ( true )
  public isDirty: WritableSignal<boolean> = signal ( false )

  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly authSvc: AuthService = inject ( AuthService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  public ngOnInit ( ): void {
    this.apiSvc.get ( "/api/admin/site-content/testimonials" ).then ( d => {
      const res = d as { items?: Testimony [ ] }
      if ( res?.items?.length ) {
        this.testimonials.set ( res.items )
      } else {
        this.testimonials.set ( DEFAULT_TESTIMONIALS.map ( c => ( { ...c } ) ) )
      }
    } ).catch ( ( ) => {
      this.testimonials.set ( DEFAULT_TESTIMONIALS.map ( c => ( { ...c } ) ) )
    } ).finally ( ( ) => this.loading.set ( false ) )
  }

  public toggleExpand ( index: number ): void {
    this.activeIndex.set ( this.activeIndex ( ) === index ? null : index )
  }

  public add ( ): void {
    this.isDirty.set ( true )
    this.testimonials.update ( items => [ ...items, { name: "", testimony: "" } ] )
    this.activeIndex.set ( this.testimonials ( ).length - 1 )
  }

  public remove ( index: number ): void {
    this.isDirty.set ( true )
    this.testimonials.update ( items => items.filter ( ( _, i ) => i !== index ) )
  }

  public moveUp ( index: number ): void {
    if ( index === 0 ) return
    this.isDirty.set ( true )
    this.testimonials.update ( items => {
      const copy = [ ...items ]
      ;[ copy [ index - 1 ], copy [ index ] ] = [ copy [ index ], copy [ index - 1 ] ]
      return copy
    } )
  }

  public moveDown ( index: number ): void {
    if ( index >= this.testimonials ( ).length - 1 ) return
    this.isDirty.set ( true )
    this.testimonials.update ( items => {
      const copy = [ ...items ]
      ;[ copy [ index ], copy [ index + 1 ] ] = [ copy [ index + 1 ], copy [ index ] ]
      return copy
    } )
  }

  public update ( index: number, field: keyof Testimony, value: string ): void {
    this.isDirty.set ( true )
    this.testimonials.update ( items => items.map ( ( item, i ) => i === index ? { ...item, [field]: value } : item ) )
  }

  public hasEmpty ( ): boolean {
    return this.testimonials ( ).some ( item => !item.name.trim ( ) || !item.testimony.trim ( ) )
  }

  public async save ( ): Promise<void> {
    if ( this.hasEmpty ( ) ) {
      this.toastrSvc.error ( "All testimonials need a name and text before saving." )
      return
    }
    this.saving.set ( true )
    try {
      await this.apiSvc.post ( "/api/admin/site-content/testimonials", { items: this.testimonials ( ) }, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || ""}`
      } ) )
      this.toastrSvc.success ( "Saved successfully!" )
      this.isDirty.set ( false )
    } catch {
      this.toastrSvc.error ( "Failed to save. Please try again." )
    } finally {
      this.saving.set ( false )
    }
  }

  public restoreDefaults ( ): void {
    this.testimonials.set ( DEFAULT_TESTIMONIALS.map ( c => ( { ...c } ) ) )
    this.isDirty.set ( true )
    this.activeIndex.set ( null )
  }
}
