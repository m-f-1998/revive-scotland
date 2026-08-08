import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { HttpHeaders } from "@angular/common/http"
import { IconComponent } from "../../../../icon/icon.component"
import { IconPickerComponent } from "../../../icon-picker/icon-picker.component"
import { ApiService } from "../../../../services/api.service"
import { AuthService } from "../../../../services/auth.service"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { AboutCard, DEFAULT_ABOUT_CARDS } from "../../config/home-editor.config"

@Component ( {
  selector: "app-home-about-editor",
  imports: [ IconComponent, IconPickerComponent ],
  templateUrl: "./about-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class AboutEditorComponent implements OnInit {
  public cards: WritableSignal<AboutCard[]> = signal ( [ ] )
  public activeIndex: WritableSignal<number> = signal ( 0 )

  public saving: WritableSignal<boolean> = signal ( false )
  public loading: WritableSignal<boolean> = signal ( true )
  public isDirty: WritableSignal<boolean> = signal ( false )

  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly authSvc: AuthService = inject ( AuthService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  public ngOnInit ( ): void {
    this.apiSvc.get ( "/api/admin/site-content/about-us" ).then ( d => {
      const res = d as { cards?: AboutCard[] }
      if ( res?.cards?.length ) {
        this.cards.set ( res.cards )
      } else {
        this.cards.set ( DEFAULT_ABOUT_CARDS.map ( c => ( { ...c } ) ) )
      }
    } ).catch ( ( ) => {
      this.cards.set ( DEFAULT_ABOUT_CARDS.map ( c => ( { ...c } ) ) )
    } ).finally ( ( ) => this.loading.set ( false ) )
  }

  public updateCard ( index: number, field: keyof AboutCard, value: string ): void {
    this.isDirty.set ( true )
    this.cards.update ( cards => cards.map ( ( c, i ) => i === index ? { ...c, [field]: value } : c ) )
  }

  public async save ( ): Promise<void> {
    this.saving.set ( true )
    try {
      await this.apiSvc.post ( "/api/admin/site-content/about-us", { cards: this.cards ( ) }, new HttpHeaders ( {
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
    this.cards.set ( DEFAULT_ABOUT_CARDS.map ( c => ( { ...c } ) ) )
    this.isDirty.set ( true )
    this.activeIndex.set ( 0 )
  }
}
