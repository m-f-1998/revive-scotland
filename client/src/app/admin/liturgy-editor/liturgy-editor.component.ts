import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { AdminNavbarComponent } from "../navbar/navbar.component"
import { AdminFooterComponent } from "../footer/footer.component"
import { IconComponent } from "../../icon/icon.component"
import { ApiService } from "../../services/api.service"
import { AuthService } from "../../services/auth.service"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { HttpHeaders } from "@angular/common/http"
import { Prayer, PrayersEditorComponent } from "./components/prayers-editor.component"
import { Reflection, ReflectionsEditorComponent } from "./components/reflections-editor.component"

@Component ( {
  selector: "app-admin-liturgy-editor",
  imports: [ AdminNavbarComponent, AdminFooterComponent, IconComponent, PrayersEditorComponent, ReflectionsEditorComponent ],
  templateUrl: "./liturgy-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class LiturgyEditorComponent implements OnInit {
  public loading: WritableSignal<boolean> = signal ( true )
  public savingPrayers: WritableSignal<boolean> = signal ( false )
  public savingReflections: WritableSignal<boolean> = signal ( false )

  public prayers: WritableSignal<Prayer [ ]> = signal ( [ ] )
  public reflections: WritableSignal<Reflection [ ]> = signal ( [ ] )

  public activeTab: WritableSignal<"prayers" | "reflections"> = signal ( "prayers" )

  public readonly tabs = [
    { id: "prayers" as const, label: "Prayers", icon: "praying-hands" as const },
    { id: "reflections" as const, label: "Video Reflections", icon: "lightbulb" as const }
  ]

  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly authSvc: AuthService = inject ( AuthService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  public ngOnInit ( ): void {
    Promise.all ( [
      this.apiSvc.get ( "/api/admin/prayers" ).catch ( ( ) => ( { prayers: [ ] } ) ),
      this.apiSvc.get ( "/api/admin/reflections" ).catch ( ( ) => ( { reflections: [ ] } ) )
    ] ).then ( ( [ prayerData, reflectionData ] ) => {
      const pd = prayerData as { prayers?: Prayer [ ] }
      const rd = reflectionData as { reflections?: Reflection [ ] }
      this.prayers.set ( pd.prayers ?? [ ] )
      this.reflections.set ( rd.reflections ?? [ ] )
    } ).catch ( ( ) => {
      this.toastrSvc.error ( "Failed to load resources." )
    } ).finally ( ( ) => this.loading.set ( false ) )
  }

  public setActiveTab ( tab: "prayers" | "reflections" ): void {
    this.activeTab.set ( tab )
  }

  public onPrayersChange ( updated: Prayer [ ] ): void {
    this.prayers.set ( updated )
  }

  public onReflectionsChange ( updated: Reflection [ ] ): void {
    this.reflections.set ( updated )
  }

  public async savePrayers ( ): Promise<void> {
    this.savingPrayers.set ( true )
    try {
      await this.apiSvc.post ( "/api/admin/prayers", { prayers: this.prayers ( ) }, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || ""}`
      } ) )
      this.toastrSvc.success ( "Prayers saved successfully!" )
    } catch {
      this.toastrSvc.error ( "Failed to save prayers." )
    } finally {
      this.savingPrayers.set ( false )
    }
  }

  public async saveReflections ( ): Promise<void> {
    this.savingReflections.set ( true )
    try {
      await this.apiSvc.post ( "/api/admin/reflections", { reflections: this.reflections ( ) }, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || ""}`
      } ) )
      this.toastrSvc.success ( "Reflections saved successfully!" )
    } catch {
      this.toastrSvc.error ( "Failed to save reflections." )
    } finally {
      this.savingReflections.set ( false )
    }
  }
}
